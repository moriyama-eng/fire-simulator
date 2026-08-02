#!/usr/bin/env node
// cli.js
// FIRE Simulator CLI entry point.
// ESM top-level return is prohibited. All branching is done inside main().
// Subcommands: run (default) / list-factors
// Options: --help / --version / --stdout / --out <path> / --no-file / --compact

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { normalizeHeadlessParams, normalizeHeadlessPercentiles, HEADLESS_DEFAULTS } from './js/core/headless-params.js';
import { runSimulationHeadless } from './js/headless.js';
import { FACTORS } from './js/core/factors.js';

// Read version from package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const VERSION = pkg.version;

// ---- toPlain: recursively convert TypedArrays to plain JS arrays ----
/**
 * Recursively converts TypedArray / Array / Object to plain JSON-serializable values.
 * Float32Array and similar cannot be serialized by JSON.stringify directly.
 * @param {*} v
 * @returns {*}
 */
function toPlain(v) {
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (Array.isArray(v)) return v.map(toPlain);
    if (v !== null && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v)) o[k] = toPlain(v[k]);
        return o;
    }
    return v;
}

// ---- buildProvenanceParams: whitelist-pick normalized params using HEADLESS_DEFAULTS keys ----
/**
 * Returns a new object containing only the keys defined in HEADLESS_DEFAULTS,
 * taken from the already-normalized params object.
 * This ensures provenance params are stable across unknown-key noise and stay
 * in sync with HEADLESS_DEFAULTS automatically (no hand-maintained key list).
 * @param {Object} normalizedParams - Output of normalizeHeadlessParams()
 * @returns {Object} Whitelist-picked provenance snapshot
 */
function buildProvenanceParams(normalizedParams) {
    const result = {};
    for (const key of Object.keys(HEADLESS_DEFAULTS)) {
        result[key] = normalizedParams[key];
    }
    return result;
}

// ---- buildMeta: construct tool metadata for output provenance ----
/**
 * Returns a metadata object with tool version and ISO8601 UTC timestamp.
 * Call once per run and share the same object across all output modes.
 * @returns {{ toolVersion: string, generatedAt: string }}
 */
function buildMeta() {
    return {
        toolVersion: VERSION,
        generatedAt: new Date().toISOString(),
    };
}

// ---- readStdin: read UTF-8 text from stdin with TTY detection ----
/**
 * Reads UTF-8 text from stdin.
 * If stdin is a TTY (interactive terminal), prints usage to stderr and exits with code 1.
 * @returns {string}
 */
function readStdin() {
    if (process.stdin.isTTY) {
        process.stderr.write(
            'Error: Cannot read JSON from stdin (TTY mode).\n' +
            'Usage: node cli.js run <params.json>\n' +
            '    or: cat params.json | node cli.js run\n'
        );
        process.exit(1);
    }
    return readFileSync(0, 'utf-8');
}

// ---- printHelp: display usage information ----
function printHelp() {
    process.stdout.write(`
fire-sim v${VERSION} - FIRE Monte Carlo Simulator CLI

Usage:
  node cli.js run [<params.json>] [options]
  node cli.js list-factors
  node cli.js --help
  node cli.js --version

Subcommands:
  run              Run simulation (default)
  list-factors     Output factor definitions as JSON

Options (run subcommand):
  --stdout         Output full result to stdout (no file write)
  --out <path>     Specify output file path (default: .temp/fire-sim/run-<timestamp>-seed<seed>.json)
  --no-file        Skip file write; output summary to stdout only
  --compact        Output JSON without indentation (single line)
  --help           Show this help
  --version        Show version

Input JSON (base currency units):
  All monetary values must be in base currency units (JPY or USD).
  No fixed-rate conversion ($1=100JPY) is applied.
  Example: { "initialRiskAsset": 100000000, "monthlyExpense": 300000 }

Output:
  The .temp/fire-sim/ directory is gitignored.
  If --out points outside .temp/, the file is NOT gitignored (user responsibility).
`);
}

// ---- main: entry point ----
async function main() {
    const args = process.argv.slice(2);

    // Handle --help / --version early
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }
    if (args.includes('--version') || args.includes('-v')) {
        process.stdout.write(`${VERSION}\n`);
        return;
    }

    // ---- Parse --out first to avoid collision with positional/flag parsing ----
    let outPath = null;
    const filteredArgs = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--out' && i + 1 < args.length) {
            outPath = args[i + 1];
            i++; // skip the value token
        } else {
            filteredArgs.push(args[i]);
        }
    }
    // Separate flags and positional args after removing --out
    const flags = new Set(filteredArgs.filter(a => a.startsWith('--')));
    const positional = filteredArgs.filter(a => !a.startsWith('--'));

    // Determine subcommand from first positional arg
    const subCommand = positional[0] || 'run';

    // ---- list-factors subcommand ----
    if (subCommand === 'list-factors' || args.includes('--list-factors')) {
        // Output FACTORS as-is; i18n keys (labelKey etc.) are not resolved.
        const indent = flags.has('--compact') ? 0 : 2;
        process.stdout.write(JSON.stringify({ factors: FACTORS }, null, indent) + '\n');
        return;
    }

    // ---- run subcommand ----

    // Params source: file path (positional[1]) or stdin
    let rawJson;
    const paramFile = positional[1];
    if (paramFile) {
        // Read from file
        try {
            rawJson = readFileSync(resolve(paramFile), 'utf-8');
        } catch (err) {
            process.stderr.write(`Error: Cannot read file: ${paramFile}\n${err.message}\n`);
            process.exit(1);
        }
    } else {
        // Read from stdin (with TTY detection)
        rawJson = readStdin();
    }

    // Parse JSON
    let rawParams;
    try {
        rawParams = JSON.parse(rawJson);
    } catch (err) {
        process.stderr.write(`Error: JSON parse failed.\n${err.message}\n`);
        process.exit(1);
    }

    // Extract and normalize percentiles
    const percentilesInput = rawParams.percentiles;
    const percentiles = normalizeHeadlessPercentiles(percentilesInput);

    // Normalize params (clamp aggregation layer; strip percentiles from rawParams)
    const { percentiles: _p, ...rawWithoutPercentiles } = rawParams;
    const params = normalizeHeadlessParams(rawWithoutPercentiles);

    // Run simulation
    let simResult;
    try {
        simResult = runSimulationHeadless(params, percentiles, {
            onProgress: (pct) => {
                // Write progress to stderr (stdout is reserved for results)
                process.stderr.write(`\rProgress: ${pct}%`);
            },
        });
        process.stderr.write('\r                    \r'); // 20 spaces to clear "Progress: 100%"
    } catch (err) {
        process.stderr.write(`Error: Simulation failed.\n${err.message}\n`);
        process.exit(2);
    }

    // Convert result to plain JSON-serializable object (toPlain)
    const plainResult = toPlain(simResult);

    // Determine output mode
    const isStdout  = flags.has('--stdout');
    const isNoFile  = flags.has('--no-file');
    const isCompact = flags.has('--compact');
    const indent    = isCompact ? 0 : 2;

    // Build provenance params and meta once; shared across all output modes
    const provenanceParams = buildProvenanceParams(params);
    const meta = buildMeta();

    // --stdout: output full result to stdout; skip file write (overrides --out)
    if (isStdout) {
        if (outPath) {
            process.stderr.write('Warning: --stdout overrides --out. File will not be written.\n');
        }
        // outputFile is intentionally omitted from --stdout output (existing tests rely on this)
        const output = {
            ...plainResult,
            params: provenanceParams,
            meta,
            dataLen: simResult.dataLen,
        };
        process.stdout.write(JSON.stringify(output, null, indent) + '\n');
        return;
    }

    // ---- File write ----
    // Generate timestamped default filename
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFileName = `run-${ts}-seed${params.seedNum}.json`;
    const defaultOutputPath = join('.temp', 'fire-sim', defaultFileName);
    const outputPath = outPath ? resolve(outPath) : resolve(defaultOutputPath);

    // Full result JSON (toPlain already applied)
    const fullOutput = {
        ...plainResult,
        params: provenanceParams,
        meta,
        dataLen: simResult.dataLen,
    };

    if (!isNoFile) {
        // Auto-create output directory
        try {
            mkdirSync(dirname(outputPath), { recursive: true });
            writeFileSync(outputPath, JSON.stringify(fullOutput, null, indent), 'utf-8');
        } catch (err) {
            process.stderr.write(`Error: File write failed: ${outputPath}\n${err.message}\n`);
            process.exit(2);
        }
    }


    // Output scalar summary JSON to stdout
    const summary = {
        successRate:             simResult.successRate,
        finalMedian:             simResult.finalMedian,
        worst10MaxDd:            simResult.worst10MaxDd,
        worst5MaxDd:             simResult.worst5MaxDd,
        medianMaxUw:             simResult.medianMaxUw,
        worst10MaxUw:            simResult.worst10MaxUw,
        targetAssetMaintainRate: simResult.targetAssetMaintainRate,
        usedSeed:                simResult.usedSeed,
        modelType:               simResult.modelType,
        usedDf:                  simResult.usedDf,
        currency:                simResult.currency,
        outputFile:              isNoFile ? null : outputPath,
        percentiles,
        params:                  provenanceParams,
        meta,
        dataLen:                 simResult.dataLen,
    };
    process.stdout.write(JSON.stringify(summary, null, indent) + '\n');
}

// Execute main
main().catch((err) => {
    process.stderr.write(`Fatal error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
});
