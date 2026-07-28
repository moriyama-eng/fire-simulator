// js/headless.js
// Headless simulation execution module.
// Runs the simulation in a single process without Web Workers.
// Results are bit-for-bit identical to the Worker version (js/simulation-engine.js + js/worker.js).
//
// Memory note: holding 3 Float32Array buffers (totals/cashes/dds) x simPaths x dataLen.
// At 50,000 paths x 361 months (30 years), peak memory usage is approximately 350 MB.

import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from './core/random.js';
import { runSinglePath } from './core/simulation.js';
import { aggregateResultsProduction } from './core/aggregation.js';
import { calcAutoDf } from './core/params.js';

/**
 * Run headless simulation.
 * Accepts normalized params and does NOT clamp them
 * (clamping is fully handled by normalizeHeadlessParams).
 * Produces bit-identical results to the Worker-based runSimulation.
 *
 * @param {Object} params - Normalized simulation parameters (base currency units).
 * @param {number[]} [percentiles=[10,30,50,70,90]] - Percentiles to compute (integers 1-99, max 5).
 * @param {Object} [options={}] - Optional settings.
 * @param {Function} [options.onProgress] - Progress callback: (percent: number) => void. Called every 100 paths.
 * @returns {Object} Aggregated simulation result with meta fields attached.
 */
export function runSimulationHeadless(params, percentiles = [10, 30, 50, 70, 90], options = {}) {
    const {
        simYears, simPaths, seedNum, cashBufferToggle,
        initialRiskAsset, initialCashBuffer,
        targetAssetRatio,
    } = params;

    // ---- Step 1: Allocate buffers (same layout as Worker version) ----
    const totalMonths = simYears * 12;
    const dataLen = totalMonths + 1;

    // Three time-series buffers: paths × dataLen
    const totalsBuffer = new Float32Array(simPaths * dataLen);
    const cashesBuffer = new Float32Array(simPaths * dataLen);
    const ddsBuffer    = new Float32Array(simPaths * dataLen);

    // Per-path scalar stat buffers
    const maxDdPerPath           = new Float32Array(simPaths);
    const maxUwPerPath           = new Float32Array(simPaths);
    const belowInitPeriods       = new Float32Array(simPaths);
    const consecutiveSellPeriods = new Float32Array(simPaths);
    let bankruptCount = 0;

    // ---- Step 2: Per-path simulation ----
    for (let p = 0; p < simPaths; p++) {
        // Generator creation order must exactly match worker.js (critical for bit-identical results)
        const rng       = xoshiro128ss(seedNum + p);
        const normalGen = createNormalGenerator(rng);
        const gammaRand = createGammaGenerator(rng, normalGen);
        const tRand     = createTGenerator(normalGen, gammaRand);

        const result = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);

        // Store results at the correct buffer offset (same layout as worker.js)
        const baseIdx = p * dataLen;
        totalsBuffer.set(result.totals, baseIdx);
        cashesBuffer.set(result.cashes, baseIdx);
        ddsBuffer.set(result.dds,    baseIdx);

        maxDdPerPath[p]           = result.maxDD;
        maxUwPerPath[p]           = result.maxUW;
        belowInitPeriods[p]       = result.maxBelowInitPeriod;
        consecutiveSellPeriods[p] = result.maxConsecutiveSellPeriod;
        if (result.bankrupt) bankruptCount++;

        // Progress callback matches worker.js cadence (every 100 paths)
        if (options.onProgress && p % 100 === 0) {
            options.onProgress(Math.round((p / simPaths) * 100));
        }
    }

    // Report final 100% progress (loop may stop at ~98% depending on simPaths)
    if (options.onProgress) options.onProgress(100);

    // ---- Step 3: Compute initial total assets ----
    // When CB is OFF, cashBufferToggle is false so activeInitialCashBuffer = 0
    const initialTotalAssets =
        initialRiskAsset + (cashBufferToggle ? initialCashBuffer : 0);

    // ---- Step 4: Aggregate results (pass .buffer to match simulation-engine.js) ----
    const result = aggregateResultsProduction({
        totalsBuffer: totalsBuffer.buffer,
        cashesBuffer: cashesBuffer.buffer,
        ddsBuffer:    ddsBuffer.buffer,
        maxDdPerPath,
        maxUwPerPath,
        belowInitPeriods,
        consecutiveSellPeriods,
        simPaths,
        dataLen,
        percentiles,
        bankruptCount,
        targetAssetRatio,
        initialTotalAssets,
    });

    // ---- Step 5: Attach meta fields (same as simulation-engine.js) ----
    result.usedSeed  = params.seedNum;
    result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
    result.usedDf    = Math.max(
        2.1,
        params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility)
    );
    result.currency  = params.currency ?? 'JPY';

    return result;
}
