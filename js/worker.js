// ====================================================================
// js/worker.js
// ====================================================================

import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from './core/random.js';
import { runSinglePath } from './core/simulation.js';

self.onmessage = function (e) {
    const { params, pathsCount, seedOffset, dataLen } = e.data;

    const totals = new Float32Array(pathsCount * dataLen);
    const cashes = new Float32Array(pathsCount * dataLen);
    const dds = new Float32Array(pathsCount * dataLen);
    const maxDds = new Float32Array(pathsCount);
    const maxUws = new Float32Array(pathsCount);
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
        if (result.bankrupt) bankruptCount++;

        if (p % 100 === 0) self.postMessage({ type: "progress", completed: p });
    }

    self.postMessage({
        type: "complete",
        totalsBuffer: totals.buffer,
        cashesBuffer: cashes.buffer,
        ddsBuffer: dds.buffer,
        maxDdsBuffer: maxDds.buffer,
        maxUwsBuffer: maxUws.buffer,
        bankruptCount
    }, [totals.buffer, cashes.buffer, dds.buffer, maxDds.buffer, maxUws.buffer]);
};