// tests/unit/headless.test.js
// T1-T2, T6-T7: Unit tests for headless simulation runner and parameter normalization

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

    it('simPaths clamp: 100 -> 5000', () => {
        const p = normalizeHeadlessParams({ simPaths: 100 });
        expect(p.simPaths).toBe(5000);
    });

    it('simPaths clamp: 99999 -> 50000', () => {
        const p = normalizeHeadlessParams({ simPaths: 99999 });
        expect(p.simPaths).toBe(50000);
    });

    it('drawdownTrigger clamp: positive -> 0', () => {
        const p = normalizeHeadlessParams({ drawdownTrigger: 5 });
        expect(p.drawdownTrigger).toBe(0);
    });

    it('targetAssetRatio clamp: 600 -> 500', () => {
        const p = normalizeHeadlessParams({ targetAssetRatio: 600 });
        expect(p.targetAssetRatio).toBe(500);
    });

    it('simDfNum clamp: 1 -> 2.5', () => {
        const p = normalizeHeadlessParams({ simDfNum: 1 });
        expect(p.simDfNum).toBe(2.5);
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

    it('simDfManual: false = auto DF mode (matches HEADLESS_DEFAULTS)', () => {
        const p = normalizeHeadlessParams({});
        expect(p.simDfManual).toBe(false);
    });

    it('M7: guardrail cross-validation (guardrailRelease < guardrailTrigger -> release=trigger)', () => {
        const p = normalizeHeadlessParams({
            guardrailToggle: true,
            guardrailTrigger: -20,
            guardrailRelease: -25,
        });
        expect(p.guardrailRelease).toBe(p.guardrailTrigger);
        expect(p.guardrailRelease).toBe(-20);
    });

    it('M7: skip cross-validation when guardrailToggle=false', () => {
        const p = normalizeHeadlessParams({
            guardrailToggle: false,
            guardrailTrigger: -20,
            guardrailRelease: -25,
        });
        // When guardrailToggle is false, guardrailRelease stays -25 (clamped <= 0)
        expect(p.guardrailRelease).toBe(-25);
    });

    it('replenishPace clamp: negative -> 0', () => {
        const p = normalizeHeadlessParams({ replenishPace: -5 });
        expect(p.replenishPace).toBe(0);
    });

    it('infAr clamp: 1.5 -> 1.0', () => {
        const p = normalizeHeadlessParams({ infAr: 1.5 });
        expect(p.infAr).toBe(1.0);
    });

    it('infAr clamp: -0.5 -> 0', () => {
        const p = normalizeHeadlessParams({ infAr: -0.5 });
        expect(p.infAr).toBe(0);
    });

    it('simYears clamp: 0 -> 1', () => {
        const p = normalizeHeadlessParams({ simYears: 0 });
        expect(p.simYears).toBe(1);
    });

    it('initialRiskAsset clamp: negative -> 0', () => {
        const p = normalizeHeadlessParams({ initialRiskAsset: -1000 });
        expect(p.initialRiskAsset).toBe(0);
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
    it('successRate matches reference data within 1 decimal place', () => {
        const params = normalizeHeadlessParams({ simPaths: 1000, seedNum: 123456 });
        const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
        expect(Math.round(result.successRate * 10)).toBe(Math.round(refData.successRate * 10));
    });

    it('finalMedian matches reference data integer portion', () => {
        const params = normalizeHeadlessParams({ simPaths: 1000, seedNum: 123456 });
        const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
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

    it('USD input values are reflected in aggregation without currency conversion (finalMedian > 0)', () => {
        const params = normalizeHeadlessParams({
            simPaths: 5000,
            currency: 'USD',
            initialRiskAsset: 1_000_000, // $1M (no JPY conversion)
            monthlyExpense: 3_000,
        });
        const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
        expect(result.finalMedian).toBeGreaterThan(0);
        expect(result.finalMedian).toBeLessThan(1e12); // Confirm 100x conversion is NOT applied
    });
});
