import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runWorkerBatch } from '../../js/worker.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { normalizeHeadlessPercentiles } from '../../js/core/headless-params.js';

const workerPosts = [];

class StubWorker {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
    }
    postMessage(data) {
        workerPosts.push({ ...data });
        const { params, pathsCount, seedOffset, dataLen } = data;
        const batch = runWorkerBatch(params, pathsCount, seedOffset, dataLen, (completed) => {
            if (this.onmessage) this.onmessage({ data: { type: 'progress', completed } });
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

function makeEngineParams(overrides = {}) {
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
    let originalHw;

    beforeEach(() => {
        workerPosts.length = 0;
        originalHw = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 3 });
        globalThis.Worker = StubWorker;
    });

    afterEach(() => {
        globalThis.Worker = originalWorker;
        if (originalHw) Object.defineProperty(navigator, 'hardwareConcurrency', originalHw);
        else delete navigator.hardwareConcurrency;
    });

    it('splits paths, accumulates seedOffset, and merges successRate plus a buffer field', async () => {
        const params = makeEngineParams({ simPaths: 8 });
        const result = await runSimulation(params, [10, 50, 90]);
        expect(workerPosts.length).toBe(3);
        const counts = workerPosts.map((p) => p.pathsCount);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(8);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        expect(counts[0]).toBeGreaterThanOrEqual(counts[1]);
        expect(counts[1]).toBeGreaterThanOrEqual(counts[2]);
        expect(workerPosts[0].seedOffset).toBe(0);
        expect(workerPosts[1].seedOffset).toBe(workerPosts[0].pathsCount);
        expect(workerPosts[2].seedOffset).toBe(workerPosts[0].pathsCount + workerPosts[1].pathsCount);
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
});
