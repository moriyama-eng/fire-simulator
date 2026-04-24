// ====================================================================
// js/core/aggregation.js
// ====================================================================

import { multiSelectTrue, quickselectSafe } from './percentile.js';

export function transposeFlat(buffer, simPaths, dataLen) {
    const result = new Array(dataLen);
    const flatArray = new Float32Array(buffer);
    for (let t = 0; t < dataLen; t++) result[t] = new Float32Array(simPaths);
    for (let p = 0; p < simPaths; p++) {
        const base = p * dataLen;
        for (let t = 0; t < dataLen; t++) result[t][p] = flatArray[base + t];
    }
    return result;
}

export function aggregateResultsProduction({
    totalsBuffer, cashesBuffer, ddsBuffer,
    maxDdPerPath, maxUwPerPath, simPaths, dataLen, percentiles, bankruptCount
}) {
    const totalT = transposeFlat(totalsBuffer, simPaths, dataLen);
    const cashT = transposeFlat(cashesBuffer, simPaths, dataLen);
    const ddT = transposeFlat(ddsBuffer, simPaths, dataLen);

    const totalPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const cashPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const ddPercentileData = percentiles.map(() => new Float32Array(dataLen));

    const ks = new Int32Array(percentiles.length);
    for (let i = 0; i < percentiles.length; i++) ks[i] = Math.floor((percentiles[i] / 100) * (simPaths - 1));

    const workBuffer = new Float32Array(simPaths);
    const resultBuf = new Float32Array(percentiles.length);

    for (let t = 0; t < dataLen; t++) {
        workBuffer.set(totalT[t]);
        multiSelectTrue(workBuffer, ks, resultBuf);
        for (let i = 0; i < ks.length; i++) totalPercentileData[i][t] = resultBuf[i];

        workBuffer.set(cashT[t]);
        multiSelectTrue(workBuffer, ks, resultBuf);
        for (let i = 0; i < ks.length; i++) cashPercentileData[i][t] = resultBuf[i];

        workBuffer.set(ddT[t]);
        multiSelectTrue(workBuffer, ks, resultBuf);
        for (let i = 0; i < ks.length; i++) ddPercentileData[i][t] = resultBuf[i];
    }

    const ddCopy = new Float32Array(maxDdPerPath);
    const uwCopy = new Float32Array(maxUwPerPath);
    const worst5Idx = Math.floor(0.05 * (simPaths - 1));
    const worst10Idx = Math.floor(0.10 * (simPaths - 1));
    const medianIdx = Math.floor(0.50 * (simPaths - 1));
    const worst10UwIdx = Math.floor(0.90 * (simPaths - 1));

    const worst5MaxDd = quickselectSafe(ddCopy, worst5Idx, 0, ddCopy.length - 1);
    const worst10MaxDd = quickselectSafe(ddCopy, worst10Idx, 0, ddCopy.length - 1);
    const medianMaxUw = quickselectSafe(uwCopy, medianIdx, 0, uwCopy.length - 1);
    const worst10MaxUw = quickselectSafe(uwCopy, worst10UwIdx, 0, uwCopy.length - 1);

    let medianPIdx = percentiles.indexOf(50);
    if (medianPIdx === -1) medianPIdx = Math.floor(percentiles.length / 2);

    return {
        percentiles,
        totalPercentileData,
        cashPercentileData,
        ddPercentileData,
        successRate: ((simPaths - bankruptCount) / simPaths * 100),
        finalMedian: totalPercentileData[medianPIdx][dataLen - 1],
        worst10MaxDd, worst5MaxDd,
        medianMaxUw, worst10MaxUw,
        maxDdPerPath, maxUwPerPath,
        params: { simPaths, totalMonths: dataLen - 1 },
        dataLen
    };
}