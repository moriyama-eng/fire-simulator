// tests/helpers/stub-worker.js
import { runWorkerBatch } from '../../js/worker.js';

export class StubWorker {
  static posts = [];

  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(data) {
    StubWorker.posts.push({ ...data });
    const { params, pathsCount, seedOffset, dataLen } = data;
    const batch = runWorkerBatch(params, pathsCount, seedOffset, dataLen, (completed) => {
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

  terminate() {}
}
