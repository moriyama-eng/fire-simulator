#!/usr/bin/env node
// ====================================================================
// cli.js - headless FIRE Monte Carlo simulator CLI
// Usage:
//   node cli.js run params.json
//   cat params.json | node cli.js run
//   node cli.js --list-factors
//   node cli.js --help
// Params JSON must be in the legacy (yen unit) format. See docs/headless-api.md
// ====================================================================

import { readFileSync } from 'fs';
import { runSimulationHeadless, normalizeLegacyParams, LEGACY_DEFAULTS } from './js/headless.js';
import { FACTORS } from './js/core/factors.js';

const USAGE = `fire-sim - headless FIRE Monte Carlo simulator

Usage:
  fire-sim run [params.json]      Run a simulation (reads stdin when no file given)
  fire-sim --list-factors         Print the sensitivity-analysis factor definitions
  fire-sim --defaults             Print the legacy (yen unit) default parameters
  fire-sim --help                 Show this help

Options for "run":
  --percentiles 10,25,50,75,90    Percentiles to aggregate (default 10,25,50,75,90)

Parameters are in the legacy yen-unit format (e.g. initialRiskAsset: 100000000).
`;

function readStdin() {
    try {
        return readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

function toPlain(value) {
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (Array.isArray(value)) return value.map(toPlain);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
        return out;
    }
    return value;
}

function parsePercentiles(argv) {
    const idx = argv.indexOf('--percentiles');
    if (idx === -1) return undefined;
    const raw = argv[idx + 1];
    if (!raw) throw new Error('--percentiles requires a comma separated list');
    const pcts = raw.split(',').map(s => Number(s.trim()));
    if (pcts.some(n => !Number.isFinite(n))) throw new Error(`invalid --percentiles value: ${raw}`);
    return pcts;
}

function positionalArgs(argv) {
    const out = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--percentiles') { i++; continue; }
        if (argv[i].startsWith('--')) continue;
        out.push(argv[i]);
    }
    return out;
}

function runCommand(argv) {
    const percentiles = parsePercentiles(argv);
    const fileArg = positionalArgs(argv)[0];
    const json = fileArg ? readFileSync(fileArg, 'utf-8') : readStdin();
    if (!json.trim()) throw new Error('no parameters provided (pass a JSON file or pipe JSON via stdin)');
    const params = normalizeLegacyParams(JSON.parse(json));
    const result = runSimulationHeadless(params, percentiles);
    return { params, result: toPlain(result) };
}

function main() {
    const argv = process.argv.slice(2);
    const cmd = argv[0];

    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
        process.stdout.write(USAGE);
    } else if (cmd === '--list-factors') {
        process.stdout.write(JSON.stringify(FACTORS, null, 2) + '\n');
    } else if (cmd === '--defaults') {
        process.stdout.write(JSON.stringify(LEGACY_DEFAULTS, null, 2) + '\n');
    } else if (cmd === 'run') {
        const { params, result } = runCommand(argv.slice(1));
        process.stdout.write(JSON.stringify({ params, result }, null, 2) + '\n');
    } else {
        process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
        process.exitCode = 1;
    }
}

try {
    main();
} catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exitCode = 1;
}
