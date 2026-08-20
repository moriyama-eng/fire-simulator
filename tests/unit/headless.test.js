// tests/unit/headless.test.js
// T1-T2, T6-T8: Unit tests for headless simulation runner and parameter normalization

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    HEADLESS_DEFAULTS,
    normalizeHeadlessParams,
    normalizeHeadlessPercentiles,
} from '../../js/core/headless-params.js';
import { runSimulationHeadless } from '../../js/headless.js';
import { runWorkerBatch } from '../../js/worker.js';
import { aggregateResultsProduction } from '../../js/core/aggregation.js';
import { calcAutoDf } from '../../js/core/params.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load reference data for T1
const refPath = join(__dirname, '../fixtures/headless-reference-results.json');
let refData;
beforeAll(() => {
    refData = JSON.parse(readFileSync(refPath, 'utf-8'));
});

// ===== T7: normalizeHeadlessParams =====
describe('T7: normalizeHeadlessParams', () => {
    it('fills missing fields with HEADLESS_DEFAULTS (initialRiskAsset, monthlyExpense)', () => {
        const p = normalizeHeadlessParams({});
        expect(p.initialRiskAsset).toBe(100_000_000);
        expect(p.monthlyExpense).toBe(300_000);
        expect(p.initialCashBuffer).toBe(10_000_000);
    });

    it.each([
        ['simPaths', { simPaths: 100 }, 'simPaths', 5000],
        ['simPaths', { simPaths: 99999 }, 'simPaths', 50000],
        ['drawdownTrigger', { drawdownTrigger: 5 }, 'drawdownTrigger', 0],
        ['targetAssetRatio', { targetAssetRatio: 600 }, 'targetAssetRatio', 500],
        ['simDfNum', { simDfNum: 1 }, 'simDfNum', 2.5],
        ['replenishPace', { replenishPace: -5 }, 'replenishPace', 0],
        ['infAr high', { infAr: 1.5 }, 'infAr', 1.0],
        ['infAr low', { infAr: -0.5 }, 'infAr', 0],
        ['simYears', { simYears: 0 }, 'simYears', 1],
        ['initialRiskAsset', { initialRiskAsset: -1000 }, 'initialRiskAsset', 0],
    ])('clamps %s via normalizeHeadlessParams', (_label, input, key, expected) => {
        const p = normalizeHeadlessParams(input);
        expect(p[key]).toBe(expected);
    });

    it('seedNum clamp: 0 / negative / out of bounds', () => {
        expect(normalizeHeadlessParams({ seedNum: 0 }).seedNum).toBe(123456);
        expect(normalizeHeadlessParams({ seedNum: -10 }).seedNum).toBe(1);
        expect(normalizeHeadlessParams({ seedNum: 999999999 }).seedNum).toBe(99999999);
    });

    it('currency validation: non-JPY/USD falls back to default JPY', () => {
        expect(normalizeHeadlessParams({ currency: 'EUR' }).currency).toBe('JPY');
        expect(normalizeHeadlessParams({ currency: 'USD' }).currency).toBe('USD');
    });

    it('unspecified booleans -> all false', () => {
        const p = normalizeHeadlessParams({});
        expect(p.cashBufferToggle).toBe(false);
        expect(p.guardrailToggle).toBe(false);
        expect(p.useArInflation).toBe(false);
        expect(p.useTDistribution).toBe(false);
        expect(p.simDfManual).toBe(false);
    });

    it('guardrail cross-validation (guardrailRelease < guardrailTrigger -> release=trigger)', () => {
        const p = normalizeHeadlessParams({
            guardrailToggle: true,
            guardrailTrigger: -20,
            guardrailRelease: -25,
        });
        expect(p.guardrailRelease).toBe(p.guardrailTrigger);
        expect(p.guardrailRelease).toBe(-20);
    });

    it('skip cross-validation when guardrailToggle=false', () => {
        const p = normalizeHeadlessParams({
            guardrailToggle: false,
            guardrailTrigger: -20,
            guardrailRelease: -25,
        });
        // When guardrailToggle is false, guardrailRelease stays -25 (clamped <= 0)
        expect(p.guardrailRelease).toBe(-25);
    });

});

// ===== normalizeHeadlessPercentiles =====
describe('normalizeHeadlessPercentiles', () => {
    it('empty array -> default [10,30,50,70,90]', () => {
        expect(normalizeHeadlessPercentiles([])).toEqual([10, 30, 50, 70, 90]);
    });

    it('undefined -> default [10,30,50,70,90]', () => {
        expect(normalizeHeadlessPercentiles(undefined)).toEqual([10, 30, 50, 70, 90]);
    });

    it('deduplicate and sort ascending', () => {
        expect(normalizeHeadlessPercentiles([50, 10, 50, 90])).toEqual([10, 50, 90]);
    });

    it('limit to maximum 5 items', () => {
        const result = normalizeHeadlessPercentiles([5, 10, 20, 30, 50, 70, 90]);
        expect(result.length).toBe(5);
    });

    it('exclude out of bounds (0, 100)', () => {
        expect(normalizeHeadlessPercentiles([0, 50, 100])).toEqual([50]);
    });
});

// ===== T1: Reproducibility Test =====
describe('T1: runSimulationHeadless Reproducibility (matches reference data)', () => {
    it('successRate and finalMedian match reference data', () => {
        const params = normalizeHeadlessParams({ simPaths: 1000, seedNum: 123456 });
        const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
        expect(Math.round(result.successRate * 10)).toBe(Math.round(refData.successRate * 10));
        expect(Math.round(result.finalMedian)).toBe(Math.round(refData.finalMedian));
    });
});

// ===== T2: Determinism Test =====
describe('T2: runSimulationHeadless Determinism', () => {
    it('identical runs with same params produce equal successRate, finalMedian, and totalPercentileData', () => {
        const params = normalizeHeadlessParams({ simPaths: 5000, seedNum: 42 });
        const pcts = [10, 30, 50, 70, 90];
        const r1 = runSimulationHeadless(params, pcts);
        const r2 = runSimulationHeadless(params, pcts);
        expect(r1.successRate).toEqual(r2.successRate);
        expect(r1.finalMedian).toEqual(r2.finalMedian);
        r1.totalPercentileData.forEach((arr1, i) => {
            const arr2 = r2.totalPercentileData[i];
            expect(arr1.length).toBe(arr2.length);
            for (let t = 0; t < arr1.length; t++) {
                expect(arr1[t]).toBe(arr2[t]);
            }
        });
    });
});

// ===== T6: currency=USD Test =====
describe('T6: currency=USD', () => {
    it('result.currency === "USD"', () => {
        const params = normalizeHeadlessParams({
            simPaths: 5000,
            currency: 'USD',
            initialRiskAsset: 1_000_000,
            monthlyExpense: 3_000,
        });
        const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
        expect(result.currency).toBe('USD');
    });
});

// ===== T8: Worker vs Headless equivalence check =====
// Split/merge orchestration stays in the test. Path work calls production runWorkerBatch.
function runWorkerHarness(params, userPercentiles, numWorkers) {
    const { simYears, simPaths } = params;
    const basePaths = Math.floor(simPaths / numWorkers);
    const remainder = simPaths % numWorkers;
    const totalMonths = simYears * 12;
    const dataLen = totalMonths + 1;

    let currentSeedOffset = 0;
    const results = [];

    for (let i = 0; i < numWorkers; i++) {
        const pathsCount = basePaths + (i < remainder ? 1 : 0);
        if (pathsCount === 0) break;

        const batch = runWorkerBatch(params, pathsCount, currentSeedOffset, dataLen);
        results.push({
            totalsBuffer: batch.totals.buffer,
            cashesBuffer: batch.cashes.buffer,
            ddsBuffer: batch.dds.buffer,
            maxDdsBuffer: batch.maxDds.buffer,
            maxUwsBuffer: batch.maxUws.buffer,
            belowInitPeriodsBuffer: batch.belowInitPeriods.buffer,
            consecutiveSellPeriodsBuffer: batch.consecutiveSellPeriods.buffer,
            bankruptCount: batch.bankruptCount,
        });

        currentSeedOffset += pathsCount;
    }

    // Merge buffers
    const mergedTotals = new Float32Array(simPaths * dataLen);
    const mergedCashes = new Float32Array(simPaths * dataLen);
    const mergedDds = new Float32Array(simPaths * dataLen);
    const maxDdPerPath = new Float32Array(simPaths);
    const maxUwPerPath = new Float32Array(simPaths);
    const belowInitPeriods = new Float32Array(simPaths);
    const consecutiveSellPeriods = new Float32Array(simPaths);
    let bankruptCount = 0;
    let globalPathIndex = 0;

    for (const res of results) {
        const pathsCountInWorker = res.totalsBuffer.byteLength / (dataLen * 4);
        const offset = globalPathIndex * dataLen;
        mergedTotals.set(new Float32Array(res.totalsBuffer), offset);
        mergedCashes.set(new Float32Array(res.cashesBuffer), offset);
        mergedDds.set(new Float32Array(res.ddsBuffer), offset);
        maxDdPerPath.set(new Float32Array(res.maxDdsBuffer), globalPathIndex);
        maxUwPerPath.set(new Float32Array(res.maxUwsBuffer), globalPathIndex);
        belowInitPeriods.set(new Float32Array(res.belowInitPeriodsBuffer), globalPathIndex);
        consecutiveSellPeriods.set(new Float32Array(res.consecutiveSellPeriodsBuffer), globalPathIndex);
        bankruptCount += res.bankruptCount;
        globalPathIndex += pathsCountInWorker;
    }

    const initialTotalAssets = params.initialRiskAsset + (params.cashBufferToggle ? params.initialCashBuffer : 0);

    const result = aggregateResultsProduction({
        totalsBuffer: mergedTotals.buffer,
        cashesBuffer: mergedCashes.buffer,
        ddsBuffer: mergedDds.buffer,
        maxDdPerPath,
        maxUwPerPath,
        belowInitPeriods,
        consecutiveSellPeriods,
        simPaths,
        dataLen,
        percentiles: userPercentiles,
        bankruptCount,
        targetAssetRatio: params.targetAssetRatio,
        initialTotalAssets,
    });

    result.usedSeed = params.seedNum;
    result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
    result.usedDf = Math.max(2.1, params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility));
    result.currency = params.currency ?? 'JPY';

    return result;
}

function assertFloatArrayEqual(a, b) {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).toBe(b[i]);
    }
}

function assertFloatArraysEqual(a, b) {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
        assertFloatArrayEqual(a[i], b[i]);
    }
}

describe('T8: Worker vs Headless equivalence check', () => {
    it('produces identical bit-for-bit output for numWorkers in [1, 3, 8]', () => {
        const params = normalizeHeadlessParams({ simPaths: 5000, seedNum: 42, simYears: 5 });
        const pcts = [10, 30, 50, 70, 90];
        const headless = runSimulationHeadless(params, pcts);
        for (const numWorkers of [1, 3, 8]) {
            const worker = runWorkerHarness(params, pcts, numWorkers);
            expect(worker.successRate).toBe(headless.successRate);
            expect(worker.finalMedian).toBe(headless.finalMedian);
            expect(worker.targetAssetMaintainRate).toBe(headless.targetAssetMaintainRate);
            expect(worker.worst10MaxDd).toBe(headless.worst10MaxDd);
            expect(worker.worst5MaxDd).toBe(headless.worst5MaxDd);
            expect(worker.medianMaxUw).toBe(headless.medianMaxUw);
            expect(worker.worst10MaxUw).toBe(headless.worst10MaxUw);
            assertFloatArraysEqual(worker.totalPercentileData, headless.totalPercentileData);
            assertFloatArraysEqual(worker.cashPercentileData, headless.cashPercentileData);
            assertFloatArraysEqual(worker.ddPercentileData, headless.ddPercentileData);
            assertFloatArrayEqual(worker.maxDdPerPath, headless.maxDdPerPath);
            assertFloatArrayEqual(worker.maxUwPerPath, headless.maxUwPerPath);
            assertFloatArrayEqual(worker.belowInitPeriods, headless.belowInitPeriods);
            assertFloatArrayEqual(worker.consecutiveSellPeriods, headless.consecutiveSellPeriods);
        }
    });

    it('complete payload keys match the worker message contract', () => {
        const params = normalizeHeadlessParams({ simPaths: 5000, seedNum: 42, simYears: 1 });
        const dataLen = params.simYears * 12 + 1;
        const batch = runWorkerBatch(params, 1, 0, dataLen);
        const payload = {
            type: 'complete',
            totalsBuffer: batch.totals.buffer,
            cashesBuffer: batch.cashes.buffer,
            ddsBuffer: batch.dds.buffer,
            maxDdsBuffer: batch.maxDds.buffer,
            maxUwsBuffer: batch.maxUws.buffer,
            belowInitPeriodsBuffer: batch.belowInitPeriods.buffer,
            consecutiveSellPeriodsBuffer: batch.consecutiveSellPeriods.buffer,
            bankruptCount: batch.bankruptCount,
        };
        expect(Object.keys(payload).sort()).toEqual([
            'bankruptCount',
            'belowInitPeriodsBuffer',
            'cashesBuffer',
            'consecutiveSellPeriodsBuffer',
            'ddsBuffer',
            'maxDdsBuffer',
            'maxUwsBuffer',
            'totalsBuffer',
            'type',
        ]);
        expect(payload.type).toBe('complete');
        expect(payload.totalsBuffer).toBeInstanceOf(ArrayBuffer);
    });
});

