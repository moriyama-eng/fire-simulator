// tests/integration/cli.test.js
// T3 (CLI integration), T4 (Float32Array conversion), T5 (list-factors) integration tests

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTORS } from '../../js/core/factors.js';

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
const TMP_DIR = join(ROOT, '.temp', 'test-cli-tmp');
const CUSTOM_OUT_DIR = join(ROOT, '.temp', 'custom-dir');
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
    // Clean up temporary directories under .temp/
    try { rmSync(join(ROOT, '.temp', 'fire-sim'), { recursive: true, force: true }); } catch (_) {}
    try { rmSync(join(ROOT, '.temp', 'custom-dir'), { recursive: true, force: true }); } catch (_) {}
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
