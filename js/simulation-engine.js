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

    // Bug #13: hardwareConcurrency = 0 の環境で最低1Workerを保証
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
                // Bug #29: alert を削除し、エラーを再throwで呼び出し元に伝播
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

    // マージ
    const mergedTotals = new Float32Array(simPaths * dataLen);
    const mergedCashes = new Float32Array(simPaths * dataLen);
    const mergedDds = new Float32Array(simPaths * dataLen);
    const maxDdPerPath = new Float32Array(simPaths);
    const maxUwPerPath = new Float32Array(simPaths);
    let bankruptCount = 0, globalPathIndex = 0;

    for (const res of results) {
        const pathsCountInWorker = res.totalsBuffer.byteLength / (dataLen * 4);
        const offset = globalPathIndex * dataLen;
        mergedTotals.set(new Float32Array(res.totalsBuffer), offset);
        mergedCashes.set(new Float32Array(res.cashesBuffer), offset);
        mergedDds.set(new Float32Array(res.ddsBuffer), offset);
        maxDdPerPath.set(new Float32Array(res.maxDdsBuffer), globalPathIndex);
        maxUwPerPath.set(new Float32Array(res.maxUwsBuffer), globalPathIndex);
        bankruptCount += res.bankruptCount;
        globalPathIndex += pathsCountInWorker;
    }

    // 初期総資産（円単位）を計算：リスク資産 + 現金バッファ（CB ON時のみ）
    // CB OFF時は params.initialCashBuffer が 0 になる（getParamsFromInputs で保証される）
    const initialTotalAssets = params.initialRiskAsset + (params.cashBufferToggle ? params.initialCashBuffer : 0);

    const result = aggregateResultsProduction({
        totalsBuffer: mergedTotals.buffer,
        cashesBuffer: mergedCashes.buffer,
        ddsBuffer: mergedDds.buffer,
        maxDdPerPath, maxUwPerPath,
        simPaths, dataLen, percentiles: userPercentiles, bankruptCount,
        targetAssetRatio: params.targetAssetRatio,
        initialTotalAssets: initialTotalAssets,
    });

    result.usedSeed = params.seedNum;
    result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
    result.usedDf = Math.max(2.1, params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility));
    return result;
}