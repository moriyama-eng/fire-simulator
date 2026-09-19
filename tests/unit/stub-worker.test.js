import { describe, it, expect, vi } from 'vitest';
import { StubWorker } from '../helpers/stub-worker.js';

describe('StubWorker helper', () => {
  it('handles postMessage with onmessage callback, progress, and completion', () => {
    const worker = new StubWorker();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();

    const messages = [];
    worker.onmessage = (e) => messages.push(e.data);

    StubWorker.posts.length = 0;
    const params = {
      initialRiskAsset: 10_000_000,
      initialCashBuffer: 0,
      monthlyExpense: 100_000,
      expectedReturn: 5,
      volatility: 15,
      inflationRate: 2,
      simYears: 1,
      simPaths: 10,
      cashBufferToggle: false,
      drawdownTrigger: -20,
      drawdownReplenish: -5,
      replenishPace: 5,
      guardrailToggle: false,
      guardrailTrigger: -20,
      guardrailReduction: -20,
      guardrailRelease: -15,
      useArInflation: false,
      infVol: 2,
      infAr: 0.5,
      useTDistribution: false,
      simDfManual: false,
      simDfNum: 4,
      seedNum: 42,
      targetAssetRatio: 100
    };

    worker.postMessage({
      params,
      pathsCount: 10,
      seedOffset: 0,
      dataLen: 13
    });

    expect(StubWorker.posts.length).toBe(1);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const completeMsg = messages.find(m => m.type === 'complete');
    expect(completeMsg).toBeDefined();
    expect(completeMsg.totalsBuffer).toBeInstanceOf(ArrayBuffer);

    worker.terminate();
  });

  it('handles postMessage when onmessage is null (false branch of if (this.onmessage))', () => {
    const worker = new StubWorker();
    worker.onmessage = null;

    const params = {
      initialRiskAsset: 10_000_000,
      initialCashBuffer: 0,
      monthlyExpense: 100_000,
      expectedReturn: 5,
      volatility: 15,
      inflationRate: 2,
      simYears: 1,
      simPaths: 10,
      cashBufferToggle: false,
      drawdownTrigger: -20,
      drawdownReplenish: -5,
      replenishPace: 5,
      guardrailToggle: false,
      guardrailTrigger: -20,
      guardrailReduction: -20,
      guardrailRelease: -15,
      useArInflation: false,
      infVol: 2,
      infAr: 0.5,
      useTDistribution: false,
      simDfManual: false,
      simDfNum: 4,
      seedNum: 42,
      targetAssetRatio: 100
    };

    expect(() => {
      worker.postMessage({
        params,
        pathsCount: 10,
        seedOffset: 0,
        dataLen: 13
      });
    }).not.toThrow();
  });
});
