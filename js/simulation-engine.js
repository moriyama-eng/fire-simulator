// ====================================================================
// js/simulation-engine.js
// ====================================================================

import { aggregateResultsProduction } from './core/aggregation.js';
import { calcAutoDf } from './core/params.js';

let onProgress = null;
export function setProgressCallback(fn) { onProgress = fn; }
export function getProgressCallback() { return onProgress; }

export async function runSimulation(params, userPercentiles) {
    if (!userPercentiles) userPercentiles = [10, 25, 50, 75, 90];
    const { simYears, simPaths, volatility, simDfManual, simDfNum, seedNum } = params;

    // Guarantee at least 1 Worker in environments where hardwareConcurrency is 0
    const numWorkers = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));
    const basePaths = Math.floor(simPaths / numWorkers);
    const remainder = simPaths % numWorkers;
    const totalMonths = simYears * 12;
    const dataLen = totalMonths + 1;

    let currentSeedOffset = 0;
    const workerPromises = [];
    const workers = [];
    const workerProgress = new Array(numWorkers).fill(0);
    let hasFailed = false;

    for (let i = 0; i < numWorkers; i++) {
        const pathsCount = basePaths + (i < remainder ? 1 : 0);
        if (pathsCount === 0) break;

        const worker = new Worker('js/worker.js', { type: 'module' });
        workers.push(worker);

        const p = new Promise((resW, rejW) => {
            worker.onmessage = (e) => {
                if (e.data.type === 'complete') {
                    workerProgress[i] = pathsCount;
                    worker.terminate();
                    resW(e.data);
                } else if (e.data.type === 'progress') {
                    workerProgress[i] = e.data.completed;
                    const totalCompleted = workerProgress.reduce((a, b) => a + b, 0);
                    const progress = Math.round((totalCompleted / simPaths) * 100);
                    if (onProgress) onProgress(progress);
                }
            };
            worker.onerror = (err) => {
                if (hasFailed) return;
                hasFailed = true;
                // Remove alert and re-throw error to propagate to the caller
                workers.forEach(w => w.terminate());
                err.message = 'error.simFailed';
                rejW(err);
            };
        });

        worker.postMessage({ params, pathsCount, seedOffset: currentSeedOffset, dataLen });
        workerPromises.push(p);
        currentSeedOffset += pathsCount;
    }

    const results = await Promise.all(workerPromises);
    if (hasFailed) return;

    // Merge
    const mergedTotals = new Float32Array(simPaths * dataLen);
    const mergedCashes = new Float32Array(simPaths * dataLen);
    const mergedDds = new Float32Array(simPaths * dataLen);
    const maxDdPerPath = new Float32Array(simPaths);
    const maxUwPerPath = new Float32Array(simPaths);
    // v2.3.0: Arrays for merging new indicator buffers
    const belowInitPeriods = new Float32Array(simPaths);
    const consecutiveSellPeriods = new Float32Array(simPaths);
    let bankruptCount = 0, globalPathIndex = 0;

    for (const res of results) {
        const pathsCountInWorker = res.totalsBuffer.byteLength / (dataLen * 4);
        const offset = globalPathIndex * dataLen;
        mergedTotals.set(new Float32Array(res.totalsBuffer), offset);
        mergedCashes.set(new Float32Array(res.cashesBuffer), offset);
        mergedDds.set(new Float32Array(res.ddsBuffer), offset);
        maxDdPerPath.set(new Float32Array(res.maxDdsBuffer), globalPathIndex);
        maxUwPerPath.set(new Float32Array(res.maxUwsBuffer), globalPathIndex);
        // v2.3.0: Merge new indicator buffers
        belowInitPeriods.set(new Float32Array(res.belowInitPeriodsBuffer), globalPathIndex);
        consecutiveSellPeriods.set(new Float32Array(res.consecutiveSellPeriodsBuffer), globalPathIndex);
        bankruptCount += res.bankruptCount;
        globalPathIndex += pathsCountInWorker;
    }

    // Calculate initial total assets (in yen): risk assets + cash buffer (only when CB is ON)
    // When CB is OFF, params.initialCashBuffer is 0 (guaranteed by getParamsFromInputs)
    const initialTotalAssets = params.initialRiskAsset + (params.cashBufferToggle ? params.initialCashBuffer : 0);

    const result = aggregateResultsProduction({
        totalsBuffer: mergedTotals.buffer,
        cashesBuffer: mergedCashes.buffer,
        ddsBuffer: mergedDds.buffer,
        maxDdPerPath, maxUwPerPath,
        belowInitPeriods,          // v2.3.0: New indicator (longest consecutive period below initial assets per path)
        consecutiveSellPeriods,    // v2.3.0: New indicator (longest consecutive sell period per path)
        simPaths, dataLen, percentiles: userPercentiles, bankruptCount,
        targetAssetRatio: params.targetAssetRatio,
        initialTotalAssets: initialTotalAssets,
    });

    result.usedSeed = params.seedNum;
    result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
    result.usedDf = Math.max(2.1, params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility));
    return result;
}