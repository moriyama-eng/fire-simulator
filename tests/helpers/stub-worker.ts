// tests/helpers/stub-worker.ts
import { runWorkerBatch } from '../../src/worker.js';
import type { SimulationParams } from '../../src/types/params.js';

export interface WorkerInputMessageData {
  params: SimulationParams;
  pathsCount: number;
  seedOffset: number;
  dataLen: number;
}

export type WorkerOutputMessageData =
  | { type: 'progress'; completed: number }
  | {
      type: 'complete';
      totalsBuffer: ArrayBufferLike;
      cashesBuffer: ArrayBufferLike;
      ddsBuffer: ArrayBufferLike;
      maxDdsBuffer: ArrayBufferLike;
      maxUwsBuffer: ArrayBufferLike;
      belowInitPeriodsBuffer: ArrayBufferLike;
      consecutiveSellPeriodsBuffer: ArrayBufferLike;
      bankruptCount: number;
    };

export interface WorkerMessageEvent<T = WorkerOutputMessageData> {
  data: T;
}

export class StubWorker {
  static posts: WorkerInputMessageData[] = [];

  onmessage: ((event: WorkerMessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(data: WorkerInputMessageData): void {
    StubWorker.posts.push({ ...data });
    const { params, pathsCount, seedOffset, dataLen } = data;
    const batch = runWorkerBatch(params, pathsCount, seedOffset, dataLen, (completed: number) => {
      if (this.onmessage) {
        this.onmessage({ data: { type: 'progress', completed } });
      }
    });
    if (this.onmessage) {
      this.onmessage({
        data: {
          type: 'complete',
          totalsBuffer: batch.totals.buffer,
          cashesBuffer: batch.cashes.buffer,
          ddsBuffer: batch.dds.buffer,
          maxDdsBuffer: batch.maxDds.buffer,
          maxUwsBuffer: batch.maxUws.buffer,
          belowInitPeriodsBuffer: batch.belowInitPeriods.buffer,
          consecutiveSellPeriodsBuffer: batch.consecutiveSellPeriods.buffer,
          bankruptCount: batch.bankruptCount,
        },
      });
    }
  }

  terminate(): void {}
}
