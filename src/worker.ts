// src/worker.ts
// Web Worker for parallel Monte Carlo FIRE simulations.

import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from './core/random.js';
import { runSinglePath } from './core/simulation.js';
import type { SimulationParams } from './types/params.js';
import type { BatchResult } from './types/simulation.js';

export interface WorkerInputMessage {
  params: SimulationParams;
  pathsCount: number;
  seedOffset: number;
  dataLen: number;
}

export interface WorkerProgressMessage {
  type: 'progress';
  completed: number;
  pathsCompleted?: number;
}

export interface WorkerCompleteMessage {
  type: 'complete';
  totalsBuffer: ArrayBufferLike;
  cashesBuffer: ArrayBufferLike;
  ddsBuffer: ArrayBufferLike;
  maxDdsBuffer: ArrayBufferLike;
  maxUwsBuffer: ArrayBufferLike;
  belowInitPeriodsBuffer: ArrayBufferLike;
  consecutiveSellPeriodsBuffer: ArrayBufferLike;
  bankruptCount: number;
}

export type WorkerOutputMessage = WorkerProgressMessage | WorkerCompleteMessage;

export function runWorkerBatch(
  params: SimulationParams,
  pathsCount: number,
  seedOffset: number,
  dataLen: number,
  onProgress?: (completed: number) => void
): BatchResult {
  const totals = new Float32Array(pathsCount * dataLen);
  const cashes = new Float32Array(pathsCount * dataLen);
  const dds = new Float32Array(pathsCount * dataLen);
  const maxDds = new Float32Array(pathsCount);
  const maxUws = new Float32Array(pathsCount);
  const belowInitPeriods = new Float32Array(pathsCount);
  const consecutiveSellPeriods = new Float32Array(pathsCount);
  let bankruptCount = 0;

  for (let p = 0; p < pathsCount; p++) {
    const rng = xoshiro128ss(params.seedNum + seedOffset + p);
    const normalGen = createNormalGenerator(rng);
    const gammaRand = createGammaGenerator(rng, normalGen);
    const tRand = createTGenerator(normalGen, gammaRand);

    const result = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);

    const baseIdx = p * dataLen;
    totals.set(result.totals, baseIdx);
    cashes.set(result.cashes, baseIdx);
    dds.set(result.dds, baseIdx);
    maxDds[p] = result.maxDD;
    maxUws[p] = result.maxUW;
    belowInitPeriods[p] = result.maxBelowInitPeriod;
    consecutiveSellPeriods[p] = result.maxConsecutiveSellPeriod;
    if (result.bankrupt) bankruptCount++;

    if (p % 100 === 0 && typeof onProgress === 'function') {
      onProgress(p);
    }
  }

  return {
    totals,
    cashes,
    dds,
    maxDds,
    maxUws,
    belowInitPeriods,
    consecutiveSellPeriods,
    bankruptCount,
  };
}

declare const WorkerGlobalScope: (new () => unknown) | undefined;

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerInputMessage>) => void) | null;
  postMessage(message: WorkerOutputMessage, transfer?: Transferable[]): void;
}

const isWorkerGlobal =
  typeof WorkerGlobalScope !== 'undefined' &&
  (self as unknown) instanceof (WorkerGlobalScope as unknown as { new (): unknown });

if (isWorkerGlobal) {
  const workerScope = self as unknown as WorkerScope;
  workerScope.onmessage = function (e: MessageEvent<WorkerInputMessage>) {
    const { params, pathsCount, seedOffset, dataLen } = e.data;
    const batch = runWorkerBatch(params, pathsCount, seedOffset, dataLen, (completed) => {
      const progressMsg: WorkerProgressMessage = {
        type: 'progress',
        completed,
        pathsCompleted: completed,
      };
      workerScope.postMessage(progressMsg);
    });

    const completeMsg: WorkerCompleteMessage = {
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

    workerScope.postMessage(completeMsg, [
      batch.totals.buffer as ArrayBuffer,
      batch.cashes.buffer as ArrayBuffer,
      batch.dds.buffer as ArrayBuffer,
      batch.maxDds.buffer as ArrayBuffer,
      batch.maxUws.buffer as ArrayBuffer,
      batch.belowInitPeriods.buffer as ArrayBuffer,
      batch.consecutiveSellPeriods.buffer as ArrayBuffer,
    ]);
  };
}
