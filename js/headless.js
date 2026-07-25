// ====================================================================
// js/headless.js
// Headless (browser-free) simulation runner.
// Input params must be in the "legacy / canonical yen unit" format
// produced by getParamsFromInputs (js/core/params.js) or
// convertToLegacyParams (js/analysis-runner.js).
// ====================================================================

import { aggregateResultsProduction } from './core/aggregation.js';
import { calcAutoDf, safeNumber } from './core/params.js';
import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from './core/random.js';
import { runSinglePath } from './core/simulation.js';

// Defaults expressed in the legacy (yen) unit system, NOT the UI display unit
// system used by DEFAULTS in js/core/params.js.
export const LEGACY_DEFAULTS = Object.freeze({
    initialRiskAsset: 100_000_000,   // 1.0 oku yen
    initialCashBuffer: 10_000_000,   // 1000 man yen
    monthlyExpense: 300_000,         // 30 man yen
    expectedReturn: 10.0,
    volatility: 18.0,
    inflationRate: 2.0,
    simYears: 30,
    simPaths: 10000,
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
});

function bool(val, fallback) {
    return typeof val === 'boolean' ? val : fallback;
}

/**
 * Normalize a raw legacy-format (yen unit) parameter object:
 * fill in missing keys with legacy defaults and apply the same clamps
 * as getParamsFromInputs.
 */
export function normalizeLegacyParams(raw) {
    const src = raw || {};
    const num = (key) => safeNumber(src[key] ?? LEGACY_DEFAULTS[key], LEGACY_DEFAULTS[key]);

    const cashBufferToggle = bool(src.cashBufferToggle, LEGACY_DEFAULTS.cashBufferToggle);

    return {
        initialRiskAsset: num('initialRiskAsset'),
        initialCashBuffer: cashBufferToggle ? num('initialCashBuffer') : 0,
        monthlyExpense: num('monthlyExpense'),
        expectedReturn: num('expectedReturn'),
        volatility: num('volatility'),
        inflationRate: num('inflationRate'),
        simYears: num('simYears'),
        simPaths: Math.max(5000, Math.min(50000, Math.round(num('simPaths')))),
        cashBufferToggle,
        drawdownTrigger: Math.min(0, num('drawdownTrigger')),
        drawdownReplenish: Math.min(0, num('drawdownReplenish')),
        replenishPace: Math.max(0, num('replenishPace')),
        guardrailToggle: bool(src.guardrailToggle, LEGACY_DEFAULTS.guardrailToggle),
        guardrailTrigger: Math.min(0, num('guardrailTrigger')),
        guardrailReduction: Math.min(0, num('guardrailReduction')),
        guardrailRelease: Math.min(0, num('guardrailRelease')),
        useArInflation: bool(src.useArInflation, LEGACY_DEFAULTS.useArInflation),
        infVol: num('infVol'),
        infAr: num('infAr'),
        useTDistribution: bool(src.useTDistribution, LEGACY_DEFAULTS.useTDistribution),
        simDfManual: bool(src.simDfManual, LEGACY_DEFAULTS.simDfManual),
        simDfNum: Math.max(2.5, num('simDfNum')),
        useFixedSeed: bool(src.useFixedSeed, LEGACY_DEFAULTS.useFixedSeed),
        seedNum: num('seedNum'),
        targetAssetRatio: Math.max(0, Math.min(500, num('targetAssetRatio')))
    };
}

/**
 * Run the Monte Carlo simulation synchronously without Workers or DOM.
 * @param {object} params legacy (yen unit) params
 * @param {number[]} [userPercentiles]
 */
export function runSimulationHeadless(params, userPercentiles) {
    if (!userPercentiles) userPercentiles = [10, 25, 50, 75, 90];
    const simPaths = params.simPaths;
    const dataLen = params.simYears * 12 + 1;

    const totals = new Float32Array(simPaths * dataLen);
    const cashes = new Float32Array(simPaths * dataLen);
    const dds = new Float32Array(simPaths * dataLen);
    const maxDdPerPath = new Float32Array(simPaths);
    const maxUwPerPath = new Float32Array(simPaths);
    const belowInitPeriods = new Float32Array(simPaths);
    const consecutiveSellPeriods = new Float32Array(simPaths);
    let bankruptCount = 0;

    for (let p = 0; p < simPaths; p++) {
        const rng = xoshiro128ss(params.seedNum + p);
        const normalGen = createNormalGenerator(rng);
        const gammaRand = createGammaGenerator(rng, normalGen);
        const tRand = createTGenerator(normalGen, gammaRand);

        const result = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);

        const baseIdx = p * dataLen;
        totals.set(result.totals, baseIdx);
        cashes.set(result.cashes, baseIdx);
        dds.set(result.dds, baseIdx);
        maxDdPerPath[p] = result.maxDD;
        maxUwPerPath[p] = result.maxUW;
        belowInitPeriods[p] = result.maxBelowInitPeriod;
        consecutiveSellPeriods[p] = result.maxConsecutiveSellPeriod;
        if (result.bankrupt) bankruptCount++;
    }

    const initialTotalAssets = params.initialRiskAsset + (params.cashBufferToggle ? params.initialCashBuffer : 0);

    const result = aggregateResultsProduction({
        totalsBuffer: totals.buffer,
        cashesBuffer: cashes.buffer,
        ddsBuffer: dds.buffer,
        maxDdPerPath, maxUwPerPath,
        belowInitPeriods,
        consecutiveSellPeriods,
        simPaths, dataLen, percentiles: userPercentiles, bankruptCount,
        targetAssetRatio: params.targetAssetRatio,
        initialTotalAssets
    });

    result.usedSeed = params.seedNum;
    result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
    result.usedDf = Math.max(2.1, params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility));
    return result;
}
