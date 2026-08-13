// tests/integration/cli.test.js
// T3 (CLI integration), T4 (Float32Array conversion), T5 (list-factors),
// T9 (round-trip reproducibility) integration tests

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTORS } from '../../js/core/factors.js';
import { HEADLESS_DEFAULTS } from '../../js/core/headless-params.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

// Sample test parameters JSON content
const SAMPLE_PARAMS = {
    simPaths: 5000,
    seedNum: 42,
    initialRiskAsset: 100_000_000,
    monthlyExpense: 300_000,
    simYears: 10,  // Shortened for test speed
};

// Temporary directories
const TMP_DIR = join(ROOT, '.agent', 'scratch', 'test-cli-tmp');
const CUSTOM_OUT_DIR = join(ROOT, '.agent', 'scratch', 'custom-dir');
let tmpParamsPath;
let createdFiles = [];

// Helper to set up temporary parameters file before test
function setupTmpParams(overrides = {}) {
    mkdirSync(TMP_DIR, { recursive: true });
    tmpParamsPath = join(TMP_DIR, `params-${Date.now()}.json`);
    writeFileSync(tmpParamsPath, JSON.stringify({ ...SAMPLE_PARAMS, ...overrides }), 'utf-8');
    return tmpParamsPath;
}

// Cleanup created test artifacts after each test
afterEach(() => {
    for (const f of createdFiles) {
        try { rmSync(f, { recursive: true, force: true }); } catch (_) {}
    }
    createdFiles = [];
    if (tmpParamsPath) {
        try { rmSync(tmpParamsPath, { force: true }); } catch (_) {}
        tmpParamsPath = null;
    }
});

afterAll(() => {
    // Clean up temporary directories under .agent/scratch/
    try { rmSync(join(ROOT, '.agent', 'scratch', 'fire-sim'), { recursive: true, force: true }); } catch (_) {}
    try { rmSync(join(ROOT, '.agent', 'scratch', 'custom-dir'), { recursive: true, force: true }); } catch (_) {}
    try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) {}
});


/**
 * Execute node cli.js via execFileSync and return stdout string.
 * Throws error on non-zero exit code.
 */
function runCli(args, options = {}) {
    return execFileSync('node', ['cli.js', ...args], {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 60000,
        ...options,
    });
}

// ===== T5: list-factors =====
describe('T5: list-factors', () => {
    it('--list-factors option: outputs JSON matching FACTORS length and paramKey', () => {
        const stdout = runCli(['--list-factors']);
        const parsed = JSON.parse(stdout);
        expect(Array.isArray(parsed.factors)).toBe(true);
        expect(parsed.factors.length).toBe(FACTORS.length);
        FACTORS.forEach((f, i) => {
            expect(parsed.factors[i].paramKey).toBe(f.paramKey);
        });
    });

    it('list-factors subcommand: outputs JSON matching FACTORS length', () => {
        const stdout = runCli(['list-factors']);
        const parsed = JSON.parse(stdout);
        expect(parsed.factors.length).toBe(FACTORS.length);
    });
});

// ===== T3: CLI integration test =====
describe('T3: CLI run subcommand', () => {
    it('contains all required scalar summary keys', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile]);
        const parsed = JSON.parse(stdout);

        expect(parsed).toHaveProperty('successRate');
        expect(parsed).toHaveProperty('finalMedian');
        expect(parsed).toHaveProperty('worst10MaxDd');
        expect(parsed).toHaveProperty('worst5MaxDd');
        expect(parsed).toHaveProperty('medianMaxUw');
        expect(parsed).toHaveProperty('worst10MaxUw');
        expect(parsed).toHaveProperty('targetAssetMaintainRate');
        expect(parsed).toHaveProperty('usedSeed');
        expect(parsed).toHaveProperty('modelType');
        expect(parsed).toHaveProperty('usedDf');
        expect(parsed).toHaveProperty('currency');
        expect(parsed).toHaveProperty('outputFile');
        expect(parsed).toHaveProperty('params');
        expect(parsed).toHaveProperty('dataLen');
    });

    it('outputFile is a string pointing under .temp/fire-sim/', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile]);
        const parsed = JSON.parse(stdout);
        expect(typeof parsed.outputFile).toBe('string');
        expect(parsed.outputFile).toContain('fire-sim');
        expect(existsSync(parsed.outputFile)).toBe(true);
        createdFiles.push(parsed.outputFile);
    });

    it('outputs to custom directory specified by --out (auto-creates directory)', () => {
        const paramsFile = setupTmpParams();
        const customOut = join(CUSTOM_OUT_DIR, 'test-output.json');
        const stdout = runCli(['run', paramsFile, '--out', customOut]);
        const parsed = JSON.parse(stdout);
        expect(parsed.outputFile).toBe(resolve(customOut));
        expect(existsSync(parsed.outputFile)).toBe(true);
        createdFiles.push(parsed.outputFile);
    });

    it('--no-file: skips file write and sets outputFile=null', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file']);
        const parsed = JSON.parse(stdout);
        expect(parsed.outputFile).toBeNull();
    });

    it('exits with code 1 when given a non-existent file', () => {
        expect(() => {
            runCli(['run', 'nonexistent-file.json']);
        }).toThrow();
    });

    it('exits with code 1 when given invalid JSON', () => {
        const badParamsPath = join(TMP_DIR, 'bad.json');
        mkdirSync(TMP_DIR, { recursive: true });
        writeFileSync(badParamsPath, '{ invalid json }', 'utf-8');
        expect(() => {
            runCli(['run', badParamsPath]);
        }).toThrow();
        rmSync(badParamsPath, { force: true });
    });

    it('summary params contains all HEADLESS_DEFAULTS keys (full provenance params)', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file']);
        const parsed = JSON.parse(stdout);

        // Verify that params contains all HEADLESS_DEFAULTS keys
        const defaultKeys = Object.keys(HEADLESS_DEFAULTS);
        for (const key of defaultKeys) {
            expect(parsed.params).toHaveProperty(key);
        }

        // Verify key params beyond the old 4-field subset are present
        expect(parsed.params).toHaveProperty('expectedReturn');
        expect(parsed.params).toHaveProperty('volatility');
        expect(parsed.params).toHaveProperty('useTDistribution');
        expect(parsed.params).toHaveProperty('inflationRate');
        expect(parsed.params).toHaveProperty('cashBufferToggle');
        expect(parsed.params).toHaveProperty('guardrailToggle');
    });

    it('summary output includes top-level percentiles array', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file']);
        const parsed = JSON.parse(stdout);

        expect(Array.isArray(parsed.percentiles)).toBe(true);
        expect(parsed.percentiles.length).toBeGreaterThan(0);
    });

    it('summary output includes meta with toolVersion and generatedAt', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file']);
        const parsed = JSON.parse(stdout);

        expect(parsed).toHaveProperty('meta');
        expect(parsed.meta).toHaveProperty('toolVersion');
        expect(parsed.meta).toHaveProperty('generatedAt');
        expect(typeof parsed.meta.toolVersion).toBe('string');
        expect(parsed.meta.toolVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('meta.generatedAt is a valid ISO8601 UTC timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file']);
        const parsed = JSON.parse(stdout);

        const iso8601UtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(parsed.meta.generatedAt).toMatch(iso8601UtcRegex);
        // Also verify it parses as a valid date
        expect(Number.isNaN(Date.parse(parsed.meta.generatedAt))).toBe(false);
    });

    it('--stdout mode: contains complete provenance params with all HEADLESS_DEFAULTS keys', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--stdout']);
        const parsed = JSON.parse(stdout);

        // params must exist and contain every key from HEADLESS_DEFAULTS
        const defaultKeys = Object.keys(HEADLESS_DEFAULTS);
        for (const key of defaultKeys) {
            expect(parsed.params).toHaveProperty(key);
        }
        // Spot-check keys beyond the old 4-field subset
        expect(parsed.params).toHaveProperty('expectedReturn');
        expect(parsed.params).toHaveProperty('volatility');
        expect(parsed.params).toHaveProperty('useTDistribution');
        expect(parsed.params).toHaveProperty('inflationRate');
        expect(parsed.params).toHaveProperty('cashBufferToggle');
        expect(parsed.params).toHaveProperty('guardrailToggle');
    });

    it('--stdout mode: includes top-level percentiles array and meta', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--stdout']);
        const parsed = JSON.parse(stdout);

        // Top-level percentiles must be a non-empty array
        expect(Array.isArray(parsed.percentiles)).toBe(true);
        expect(parsed.percentiles.length).toBeGreaterThan(0);

        // meta must contain toolVersion (semver) and generatedAt (ISO 8601 UTC)
        expect(parsed).toHaveProperty('meta');
        expect(typeof parsed.meta.toolVersion).toBe('string');
        expect(parsed.meta.toolVersion).toMatch(/^\d+\.\d+\.\d+$/);
        const iso8601UtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(parsed.meta.generatedAt).toMatch(iso8601UtcRegex);
    });

    it('file mode (default): written file contains complete provenance params, percentiles, and meta', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile]);
        const summary = JSON.parse(stdout);

        // Track the output file for cleanup
        expect(typeof summary.outputFile).toBe('string');
        createdFiles.push(summary.outputFile);

        // Read the full JSON written to disk using already-imported readFileSync
        const fullOutput = JSON.parse(readFileSync(summary.outputFile, 'utf-8'));

        // params must contain all HEADLESS_DEFAULTS keys
        const defaultKeys = Object.keys(HEADLESS_DEFAULTS);
        for (const key of defaultKeys) {
            expect(fullOutput.params).toHaveProperty(key);
        }

        // top-level percentiles
        expect(Array.isArray(fullOutput.percentiles)).toBe(true);
        expect(fullOutput.percentiles.length).toBeGreaterThan(0);

        // meta
        expect(fullOutput).toHaveProperty('meta');
        expect(typeof fullOutput.meta.toolVersion).toBe('string');
        expect(typeof fullOutput.meta.generatedAt).toBe('string');
    });
});

// ===== T4: Float32Array conversion =====
describe('T4: Float32Array conversion with --stdout', () => {
    it('totalPercentileData[0] is a plain array', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--stdout']);
        const parsed = JSON.parse(stdout);
        expect(Array.isArray(parsed.totalPercentileData)).toBe(true);
        expect(Array.isArray(parsed.totalPercentileData[0])).toBe(true);
    });

    it('maxDdPerPath elements are numbers', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--stdout']);
        const parsed = JSON.parse(stdout);
        expect(typeof parsed.maxDdPerPath[0]).toBe('number');
    });

    it('skips file write when --stdout is specified (outputFile is undefined)', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--stdout']);
        const parsed = JSON.parse(stdout);
        expect(parsed.outputFile).toBeUndefined();
    });
});

// ===== CLI Option auxiliary tests =====
describe('CLI Options', () => {
    it('--version outputs version string', () => {
        const stdout = runCli(['--version']);
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('--help outputs help text', () => {
        const stdout = runCli(['--help']);
        expect(stdout).toContain('fire-sim');
        expect(stdout).toContain('run');
    });

    it('--compact outputs single line JSON without indentation', () => {
        const paramsFile = setupTmpParams();
        const stdout = runCli(['run', paramsFile, '--no-file', '--compact']);
        const lines = stdout.trim().split('\n');
        expect(lines.length).toBe(1);
    });
});

// ===== T9: round-trip reproducibility =====
describe('T9: round-trip reproducibility', () => {
    it('re-running with output params+percentiles produces identical results', () => {
        // First run with non-default percentiles
        const firstParams = {
            ...SAMPLE_PARAMS,
            percentiles: [5, 25, 50, 75, 95],
        };
        const firstParamsFile = join(TMP_DIR, `round-trip-first-${Date.now()}.json`);
        mkdirSync(TMP_DIR, { recursive: true });
        writeFileSync(firstParamsFile, JSON.stringify(firstParams), 'utf-8');

        const firstStdout = runCli(['run', firstParamsFile, '--stdout']);
        const firstResult = JSON.parse(firstStdout);

        // Construct second input by spreading params to top-level and attaching percentiles
        const secondParams = {
            ...firstResult.params,
            percentiles: firstResult.percentiles,
        };
        const secondParamsFile = join(TMP_DIR, `round-trip-second-${Date.now()}.json`);
        writeFileSync(secondParamsFile, JSON.stringify(secondParams), 'utf-8');

        const secondStdout = runCli(['run', secondParamsFile, '--stdout']);
        const secondResult = JSON.parse(secondStdout);

        // usedSeed must be identical
        expect(secondResult.usedSeed).toBe(firstResult.usedSeed);

        // Key scalar metrics must be identical
        expect(secondResult.successRate).toBe(firstResult.successRate);
        expect(secondResult.finalMedian).toBe(firstResult.finalMedian);
        expect(secondResult.worst10MaxDd).toBe(firstResult.worst10MaxDd);
        expect(secondResult.worst5MaxDd).toBe(firstResult.worst5MaxDd);
        expect(secondResult.medianMaxUw).toBe(firstResult.medianMaxUw);
        expect(secondResult.worst10MaxUw).toBe(firstResult.worst10MaxUw);

        // percentiles must be identical
        expect(secondResult.percentiles).toEqual(firstResult.percentiles);

        // Verify non-default percentiles were actually used (not default [10,30,50,70,90])
        expect(firstResult.percentiles).toEqual([5, 25, 50, 75, 95]);

        // All params keys must be identical
        const defaultKeys = Object.keys(HEADLESS_DEFAULTS);
        for (const key of defaultKeys) {
            expect(secondResult.params[key]).toEqual(firstResult.params[key]);
        }

        // Cleanup
        try { rmSync(firstParamsFile, { force: true }); } catch (_) {}
        try { rmSync(secondParamsFile, { force: true }); } catch (_) {}
    });
});
