// ====================================================================
// js/worker.js
// ====================================================================

import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from './core/random.js';
import { runSinglePath } from './core/simulation.js';

export function runWorkerBatch(params, pathsCount, seedOffset, dataLen, onProgress) {
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

        if (p % 100 === 0 && typeof onProgress === 'function') onProgress(p);
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

const isWorkerGlobal = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (isWorkerGlobal) {
    self.onmessage = function (e) {
        const { params, pathsCount, seedOffset, dataLen } = e.data;
        const batch = runWorkerBatch(params, pathsCount, seedOffset, dataLen, (completed) => {
            self.postMessage({ type: 'progress', completed });
        });
        self.postMessage({
            type: 'complete',
            totalsBuffer: batch.totals.buffer,
            cashesBuffer: batch.cashes.buffer,
            ddsBuffer: batch.dds.buffer,
            maxDdsBuffer: batch.maxDds.buffer,
            maxUwsBuffer: batch.maxUws.buffer,
            belowInitPeriodsBuffer: batch.belowInitPeriods.buffer,
            consecutiveSellPeriodsBuffer: batch.consecutiveSellPeriods.buffer,
            bankruptCount: batch.bankruptCount,
        }, [batch.totals.buffer, batch.cashes.buffer, batch.dds.buffer, batch.maxDds.buffer, batch.maxUws.buffer,
            batch.belowInitPeriods.buffer, batch.consecutiveSellPeriods.buffer]);
    };
}
