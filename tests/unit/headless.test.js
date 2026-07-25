import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { runSimulationHeadless, normalizeLegacyParams, LEGACY_DEFAULTS } from '../../js/headless.js';

const referenceResults = JSON.parse(readFileSync('tests/fixtures/reference-results.json', 'utf-8'));

// Legacy (yen unit) equivalent of the default UI inputs used by simulation.test.js
const baseParams = {
    initialRiskAsset: 1.0 * 100_000_000,
    initialCashBuffer: 1000 * 10_000,
    monthlyExpense: 30 * 10_000,
    expectedReturn: 10.0,
    volatility: 18.0,
    inflationRate: 2.0,
    simYears: 30,
    simPaths: 1000,
    cashBufferToggle: true,
    drawdownTrigger: -20.0,
    drawdownReplenish: -5.0,
    replenishPace: 5.0,
    guardrailToggle: false,
    guardrailTrigger: -20.0,
    guardrailReduction: -20.0,
    guardrailRelease: -15.0,
    useArInflation: false,
    infVol: 2.0,
    infAr: 0.5,
    useTDistribution: true,
    simDfManual: false,
    simDfNum: 4.0,
    useFixedSeed: true,
    seedNum: 123456,
    targetAssetRatio: 100.0
};

describe('normalizeLegacyParams', () => {
    it('fills missing keys with legacy (yen unit) defaults', () => {
        const p = normalizeLegacyParams({});
        expect(p.initialRiskAsset).toBe(LEGACY_DEFAULTS.initialRiskAsset);
        expect(p.monthlyExpense).toBe(LEGACY_DEFAULTS.monthlyExpense);
        expect(p.cashBufferToggle).toBe(true);
        expect(p.guardrailToggle).toBe(false);
        expect(p.useTDistribution).toBe(true);
        expect(p.simDfManual).toBe(false);
    });

    it('applies the same clamps as getParamsFromInputs', () => {
        const p = normalizeLegacyParams({
            simPaths: 10,
            drawdownTrigger: 30,
            guardrailReduction: 10,
            replenishPace: -3,
            simDfNum: 1,
            targetAssetRatio: 999
        });
        expect(p.simPaths).toBe(5000);
        expect(p.drawdownTrigger).toBe(0);
        expect(p.guardrailReduction).toBe(0);
        expect(p.replenishPace).toBe(0);
        expect(p.simDfNum).toBe(2.5);
        expect(p.targetAssetRatio).toBe(500);
        expect(normalizeLegacyParams({ simPaths: 999999 }).simPaths).toBe(50000);
    });

    it('zeroes the cash buffer when the toggle is off', () => {
        const p = normalizeLegacyParams({ cashBufferToggle: false, initialCashBuffer: 10_000_000 });
        expect(p.initialCashBuffer).toBe(0);
    });
});

describe('runSimulationHeadless', () => {
    // Bypass the simPaths clamp (min 5000): the reference fixture was generated with 1000 paths
    it('matches reference data with fixed seed 123456', () => {
        const params = { ...normalizeLegacyParams(baseParams), simPaths: 1000 };
        const res = runSimulationHeadless(params);
        expect(res.successRate).toBeCloseTo(referenceResults.successRate, 1);
        expect(res.finalMedian).toBeCloseTo(referenceResults.finalMedian, 0);
        expect(res.modelType).toBe(referenceResults.modelType);
        expect(res.usedSeed).toBe(referenceResults.seed);
        expect(res.usedDf).toBeCloseTo(referenceResults.usedDf, 5);
    });

    it('is deterministic for the same seed', () => {
        const params = { ...normalizeLegacyParams(baseParams), simPaths: 200 };
        const a = runSimulationHeadless(params);
        const b = runSimulationHeadless(params);
        expect(a.successRate).toBe(b.successRate);
        expect(a.finalMedian).toBe(b.finalMedian);
        expect(Array.from(a.totalPercentileData[2])).toEqual(Array.from(b.totalPercentileData[2]));
        expect(Array.from(a.maxDdPerPath)).toEqual(Array.from(b.maxDdPerPath));
    });

    it('differs for a different seed', () => {
        const a = runSimulationHeadless({ ...normalizeLegacyParams(baseParams), simPaths: 200 });
        const b = runSimulationHeadless({ ...normalizeLegacyParams({ ...baseParams, seedNum: 999 }), simPaths: 200 });
        expect(a.finalMedian).not.toBe(b.finalMedian);
    });

    it('uses default percentiles [10,25,50,75,90]', () => {
        const res = runSimulationHeadless({ ...normalizeLegacyParams(baseParams), simPaths: 50 });
        expect(res.percentiles).toEqual([10, 25, 50, 75, 90]);
        expect(res.dataLen).toBe(30 * 12 + 1);
    });
});
