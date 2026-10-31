// src/simulation-engine.ts
// Parallel simulation engine orchestrating Web Workers in the browser.

import { aggregateResultsProduction } from './core/aggregation.js';
import { calcAutoDf } from './core/params.js';
import type { SimulationParams } from './types/params.js';
import type { AggregatedMetrics } from './types/simulation.js';
import type { WorkerCompleteMessage, WorkerOutputMessage } from './worker.js';

export type ProgressCallback = (progress: number) => void;

let onProgress: ProgressCallback | null = null;
export function setProgressCallback(fn: ProgressCallback | null): void {
  onProgress = fn;
}
export function getProgressCallback(): ProgressCallback | null {
  return onProgress;
}

export async function runSimulation(
  params: SimulationParams,
  userPercentiles?: number[]
): Promise<AggregatedMetrics> {
  const percentiles =
    userPercentiles && userPercentiles.length > 0 ? userPercentiles : [10, 25, 50, 75, 90];
  const { simYears, simPaths } = params;

  // Guarantee at least 1 Worker in environments where hardwareConcurrency is 0
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  const numWorkers = Math.max(1, Math.min(hardwareConcurrency, 8));
  const basePaths = Math.floor(simPaths / numWorkers);
  const remainder = simPaths % numWorkers;
  const totalMonths = simYears * 12;
  const dataLen = totalMonths + 1;

  let currentSeedOffset = 0;
  const workerPromises: Promise<WorkerCompleteMessage>[] = [];
  const workers: Worker[] = [];
  const workerProgress = new Array<number>(numWorkers).fill(0);
  let hasFailed = false;

  for (let i = 0; i < numWorkers; i++) {
    const pathsCount = basePaths + (i < remainder ? 1 : 0);
    if (pathsCount === 0) break;

    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workers.push(worker);

    const p = new Promise<WorkerCompleteMessage>((resW, rejW) => {
      worker.onmessage = (e: MessageEvent<WorkerOutputMessage>) => {
        const data = e.data;
        if (data.type === 'complete') {
          workerProgress[i] = pathsCount;
          worker.terminate();
          resW(data);
        } else if (data.type === 'progress') {
          workerProgress[i] = data.completed;
          const totalCompleted = workerProgress.reduce((a, b) => a + b, 0);
          const progress = Math.round((totalCompleted / simPaths) * 100);
          if (onProgress) onProgress(progress);
        }
      };
      worker.onerror = (err: unknown) => {
        if (hasFailed) return;
        hasFailed = true;
        workers.forEach((w) => {
          try {
            w.terminate();
          } catch (_) {}
        });
        const error = err instanceof Error ? err : new Error('error.simFailed');
        error.message = 'error.simFailed';
        rejW(error);
      };
    });

    worker.postMessage({
      params,
      pathsCount,
      seedOffset: currentSeedOffset,
      dataLen,
    });
    workerPromises.push(p);
    currentSeedOffset += pathsCount;
  }

  const results = await Promise.all(workerPromises);

  // Merge
  const mergedTotals = new Float32Array(simPaths * dataLen);
  const mergedCashes = new Float32Array(simPaths * dataLen);
  const mergedDds = new Float32Array(simPaths * dataLen);
  const maxDdPerPath = new Float32Array(simPaths);
  const maxUwPerPath = new Float32Array(simPaths);
  // Arrays for merging below-initial and consecutive sell indicator buffers
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
    // Merge below-initial and consecutive sell indicator buffers
    belowInitPeriods.set(new Float32Array(res.belowInitPeriodsBuffer), globalPathIndex);
    consecutiveSellPeriods.set(new Float32Array(res.consecutiveSellPeriodsBuffer), globalPathIndex);
    bankruptCount += res.bankruptCount;
    globalPathIndex += pathsCountInWorker;
  }

  // Calculate initial total assets (in yen): risk assets + cash buffer (only when CB is ON)
  // When CB is OFF, params.initialCashBuffer is 0 (guaranteed by getParamsFromInputs)
  const initialTotalAssets =
    params.initialRiskAsset + (params.cashBufferToggle ? params.initialCashBuffer : 0);

  const result = aggregateResultsProduction({
    totalsBuffer: mergedTotals.buffer,
    cashesBuffer: mergedCashes.buffer,
    ddsBuffer: mergedDds.buffer,
    maxDdPerPath,
    maxUwPerPath,
    belowInitPeriods, // Longest consecutive period below initial assets per path
    consecutiveSellPeriods, // Longest consecutive sell period per path
    simPaths,
    dataLen,
    percentiles,
    bankruptCount,
    targetAssetRatio: params.targetAssetRatio,
    initialTotalAssets,
  });

  result.usedSeed = params.seedNum;
  result.modelType = params.useTDistribution ? 'log-t' : 'log-normal';
  result.usedDf = Math.max(
    2.1,
    params.simDfManual ? params.simDfNum : calcAutoDf(params.volatility)
  );
  return result;
}
