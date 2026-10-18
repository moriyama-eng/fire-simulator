// src/cli.ts
// FIRE Simulator CLI entry point.
// Subcommands: run (default) / list-factors
// Options: --help / --version / --stdout / --out <path> / --no-file / --compact

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { normalizeHeadlessParams, normalizeHeadlessPercentiles, HEADLESS_DEFAULTS } from './core/headless-params.js';
import { runSimulationHeadless } from './headless.js';
import { FACTORS } from './core/factors.js';
import type { SimulationParams } from './types/params.js';

// Read version from package.json with robust path resolution
function getPackageVersion(): string {
  const candidateUrls = [
    new URL('../package.json', import.meta.url),
    new URL('./package.json', import.meta.url),
  ];
  for (const url of candidateUrls) {
    try {
      const content = readFileSync(url, 'utf-8');
      const parsed = JSON.parse(content) as { version?: string };
      if (typeof parsed.version === 'string') {
        return parsed.version;
      }
    } catch (_) {
      // Continue to next candidate
    }
  }
  return '3.0.1';
}

const VERSION = getPackageVersion();

// ---- toPlain: recursively convert TypedArrays to plain JS arrays ----
/**
 * Recursively converts TypedArray / Array / Object to plain JSON-serializable values.
 * Float32Array and similar cannot be serialized by JSON.stringify directly.
 */
function toPlain(v: unknown): unknown {
  if (ArrayBuffer.isView(v)) {
    return Array.from(v as unknown as ArrayLike<number>);
  }
  if (Array.isArray(v)) {
    return v.map(toPlain);
  }
  if (v !== null && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = toPlain(val);
    }
    return o;
  }
  return v;
}

// ---- buildProvenanceParams: whitelist-pick normalized params using HEADLESS_DEFAULTS keys ----
/**
 * Returns a new object containing only the keys defined in HEADLESS_DEFAULTS,
 * taken from the already-normalized params object.
 */
function buildProvenanceParams(normalizedParams: SimulationParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const record = normalizedParams as unknown as Record<string, unknown>;
  for (const key of Object.keys(HEADLESS_DEFAULTS)) {
    result[key] = record[key];
  }
  return result;
}

// ---- buildMeta: construct tool metadata for output provenance ----
interface CliMeta {
  toolVersion: string;
  generatedAt: string;
}

function buildMeta(): CliMeta {
  return {
    toolVersion: VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ---- readStdin: read UTF-8 text from stdin with TTY detection ----
function readStdin(): string {
  if (process.stdin.isTTY) {
    process.stderr.write(
      'Error: Cannot read JSON from stdin (TTY mode).\n' +
      'Usage: node dist/cli.js run <params.json>\n' +
      '    or: cat params.json | node dist/cli.js run\n'
    );
    process.exit(1);
  }
  return readFileSync(0, 'utf-8');
}

// ---- printHelp: display usage information ----
function printHelp(): void {
  process.stdout.write(`
fire-sim v${VERSION} - FIRE Monte Carlo Simulator CLI

Usage:
  node dist/cli.js run [<params.json>] [options]
  node dist/cli.js list-factors
  node dist/cli.js --help
  node dist/cli.js --version

Subcommands:
  run              Run simulation (default)
  list-factors     Output factor definitions as JSON

Options (run subcommand):
  --stdout         Output full result to stdout (no file write)
  --out <path>     Specify output file path (default: output/fire-sim/run-<timestamp>-seed<seed>.json)
  --no-file        Skip file write; output summary to stdout only
  --compact        Output JSON without indentation (single line)
  --help           Show this help
  --version        Show version

Input JSON (base currency units):
  All monetary values must be in base currency units (JPY or USD).
  No fixed-rate conversion ($1=100JPY) is applied.
  Example: { "initialRiskAsset": 100000000, "monthlyExpense": 300000 }

Output:
  The output/fire-sim/ directory is gitignored.
  If --out points outside output/, the file is NOT gitignored (user responsibility).
`);
}

// ---- main: entry point ----
async function main(): Promise<void> {
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
  let outPath: string | null = null;
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && i + 1 < args.length) {
      outPath = args[i + 1];
      i++; // skip the value token
    } else {
      filteredArgs.push(args[i]);
    }
  }

  // Separate flags and positional args after removing --out
  const flags = new Set(filteredArgs.filter((a) => a.startsWith('--')));
  const positional = filteredArgs.filter((a) => !a.startsWith('--'));

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
  let rawJson: string;
  const paramFile = positional[1];
  if (paramFile) {
    try {
      rawJson = readFileSync(resolve(paramFile), 'utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: Cannot read file: ${paramFile}\n${msg}\n`);
      process.exit(1);
    }
  } else {
    rawJson = readStdin();
  }

  // Parse JSON
  let rawParams: unknown;
  try {
    rawParams = JSON.parse(rawJson);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: JSON parse failed.\n${msg}\n`);
    process.exit(1);
  }

  if (typeof rawParams !== 'object' || rawParams === null) {
    process.stderr.write('Error: JSON parse failed.\nExpected object.\n');
    process.exit(1);
  }

  const rawRecord = rawParams as Record<string, unknown>;

  // Extract and normalize percentiles
  const percentilesInput = rawRecord.percentiles;
  const percentiles = normalizeHeadlessPercentiles(
    Array.isArray(percentilesInput) ? (percentilesInput as number[]) : undefined
  );

  // Normalize params (clamp aggregation layer; strip percentiles from rawParams)
  const { percentiles: _p, ...rawWithoutPercentiles } = rawRecord;
  const params = normalizeHeadlessParams(rawWithoutPercentiles);

  // Run simulation
  let simResult: ReturnType<typeof runSimulationHeadless>;
  try {
    simResult = runSimulationHeadless(params, percentiles, {
      onProgress: (pct: number) => {
        process.stderr.write(`\rProgress: ${pct}%`);
      },
    });
    process.stderr.write('\r                    \r'); // 20 spaces to clear "Progress: 100%"
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: Simulation failed.\n${msg}\n`);
    process.exit(2);
  }

  // Convert result to plain JSON-serializable object (toPlain)
  const plainResult = toPlain(simResult) as Record<string, unknown>;

  // Determine output mode
  const isStdout = flags.has('--stdout');
  const isNoFile = flags.has('--no-file');
  const isCompact = flags.has('--compact');
  const indent = isCompact ? 0 : 2;

  // Build provenance params and meta once; shared across all output modes
  const provenanceParams = buildProvenanceParams(params);
  const meta = buildMeta();

  // --stdout: output full result to stdout; skip file write (overrides --out)
  if (isStdout) {
    if (outPath) {
      process.stderr.write('Warning: --stdout overrides --out. File will not be written.\n');
    }
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
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultFileName = `run-${ts}-seed${params.seedNum}.json`;
  const defaultOutputPath = join('output', 'fire-sim', defaultFileName);
  const outputPath = outPath ? resolve(outPath) : resolve(defaultOutputPath);

  const fullOutput = {
    ...plainResult,
    params: provenanceParams,
    meta,
    dataLen: simResult.dataLen,
  };

  if (!isNoFile) {
    try {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(fullOutput, null, indent), 'utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: File write failed: ${outputPath}\n${msg}\n`);
      process.exit(2);
    }
  }

  // Output scalar summary JSON to stdout
  const summary = {
    successRate: simResult.successRate,
    finalMedian: simResult.finalMedian,
    worst10MaxDd: simResult.worst10MaxDd,
    worst5MaxDd: simResult.worst5MaxDd,
    medianMaxUw: simResult.medianMaxUw,
    worst10MaxUw: simResult.worst10MaxUw,
    targetAssetMaintainRate: simResult.targetAssetMaintainRate,
    usedSeed: simResult.usedSeed,
    modelType: simResult.modelType,
    usedDf: simResult.usedDf,
    currency: simResult.currency,
    outputFile: isNoFile ? null : outputPath,
    percentiles,
    params: provenanceParams,
    meta,
    dataLen: simResult.dataLen,
  };
  process.stdout.write(JSON.stringify(summary, null, indent) + '\n');
}

// Execute main
main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack : '';
  process.stderr.write(`Fatal error: ${msg}\n${stack}\n`);
  process.exit(2);
});
