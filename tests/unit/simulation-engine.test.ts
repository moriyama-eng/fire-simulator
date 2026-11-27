// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runSimulation, setProgressCallback } from '../../src/simulation-engine.js';
import { normalizeHeadlessPercentiles } from '../../src/core/headless-params.js';
import { StubWorker } from '../helpers/stub-worker.js';
import type { SimulationParams } from '../../src/types/params.js';

function makeEngineParams(overrides: Partial<SimulationParams> = {}): SimulationParams {
  return {
    initialRiskAsset: 100_000_000,
    initialCashBuffer: 0,
    monthlyExpense: 300_000,
    expectedReturn: 10,
    volatility: 18,
    inflationRate: 2,
    simYears: 1,
    simPaths: 8,
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
    targetAssetRatio: 100,
    ...overrides,
  };
}

describe('runSimulation Worker stub orchestration', () => {
  const originalWorker = globalThis.Worker;
  let originalHw: PropertyDescriptor | undefined;

  beforeEach(() => {
    StubWorker.posts.length = 0;
    originalHw = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 3 });
    globalThis.Worker = StubWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    if (originalHw) {
      Object.defineProperty(navigator, 'hardwareConcurrency', originalHw);
    } else {
      delete (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency;
    }
  });

  it('splits paths, accumulates seedOffset, and merges successRate plus a buffer field', async () => {
    const params = makeEngineParams({ simPaths: 8 });
    const result = await runSimulation(params, [10, 50, 90]);
    expect(StubWorker.posts.length).toBe(3);
    const counts = StubWorker.posts.map((p) => p.pathsCount);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1]);
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2]);
    expect(StubWorker.posts[0].seedOffset).toBe(0);
    expect(StubWorker.posts[1].seedOffset).toBe(StubWorker.posts[0].pathsCount);
    expect(StubWorker.posts[2].seedOffset).toBe(
      StubWorker.posts[0].pathsCount + StubWorker.posts[1].pathsCount
    );
    expect(typeof result.successRate).toBe('number');
    expect(Array.isArray(result.totalPercentileData)).toBe(true);
    expect(result.totalPercentileData.length).toBe(3);
  });

  it('uses UI default percentiles when omitted, different from headless default', async () => {
    const result = await runSimulation(makeEngineParams());
    const headlessDefault = normalizeHeadlessPercentiles(undefined);
    expect(result.percentiles).toEqual([10, 25, 50, 75, 90]);
    expect(headlessDefault).toEqual([10, 30, 50, 70, 90]);
    expect(result.percentiles).not.toEqual(headlessDefault);
  });

  it('supports optional per-call progressCallback (undefined fallback, null suppression, custom callback)', async () => {
    const globalCb = vi.fn();
    const customCb = vi.fn();
    setProgressCallback(globalCb);
    try {
      await runSimulation(makeEngineParams({ simPaths: 100 }), [50], null);
      expect(globalCb).not.toHaveBeenCalled();

      await runSimulation(makeEngineParams({ simPaths: 100 }), [50], customCb);
      expect(globalCb).not.toHaveBeenCalled();
      expect(customCb).toHaveBeenCalled();

      await runSimulation(makeEngineParams({ simPaths: 100 }), [50]);
      expect(globalCb).toHaveBeenCalled();
    } finally {
      setProgressCallback(null);
    }
  });

  it('rejects non-positive or non-finite simPaths with RangeError', async () => {
    await expect(runSimulation(makeEngineParams({ simPaths: 0 }))).rejects.toThrow(RangeError);
    await expect(runSimulation(makeEngineParams({ simPaths: -10 }))).rejects.toThrow(RangeError);
    await expect(runSimulation(makeEngineParams({ simPaths: Number.NaN }))).rejects.toThrow(RangeError);
  });

  it('reports 100% progress on completion and clamps usedDf to >= 2.5', async () => {
    const progressValues: number[] = [];
    const result = await runSimulation(
      makeEngineParams({ simPaths: 8, simDfManual: true, simDfNum: 1.5 }),
      [50],
      (p) => progressValues.push(p)
    );
    expect(progressValues[progressValues.length - 1]).toBe(100);
    expect(result.usedDf).toBe(2.5);
  });

  it('handles worker.onerror and worker.onmessageerror without mutating original error or hanging', async () => {
    class ErrorWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      onmessageerror: ((err: unknown) => void) | null = null;
      terminated = false;
      postMessage(): void {
        queueMicrotask(() => {
          this.onmessageerror?.(new Error('deserialization failed'));
        });
      }
      terminate(): void {
        this.terminated = true;
      }
    }
    globalThis.Worker = ErrorWorker as unknown as typeof Worker;
    await expect(runSimulation(makeEngineParams({ simPaths: 3 }), [50], null)).rejects.toMatchObject({
      message: 'error.simFailed',
      cause: expect.objectContaining({ message: 'deserialization failed' }),
    });
  });

  it('aborts immediately when AbortSignal is already aborted or aborts mid-run', async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    await expect(
      runSimulation(makeEngineParams({ simPaths: 8 }), [50], null, preAborted.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });

    let terminatedCount = 0;
    class HangingWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      onmessageerror: ((err: unknown) => void) | null = null;
      postMessage(): void {}
      terminate(): void {
        terminatedCount++;
      }
    }
    globalThis.Worker = HangingWorker as unknown as typeof Worker;
    const midController = new AbortController();
    const pending = runSimulation(makeEngineParams({ simPaths: 3 }), [50], null, midController.signal);
    midController.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminatedCount).toBe(3);
  });
});
