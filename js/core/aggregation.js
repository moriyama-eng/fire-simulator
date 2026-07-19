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

// Changed to sequential transposition method in v1.10.0 for memory efficiency. Same implementation maintained in v2.0.0.
// Calculate and release each of the three types of buffers (total assets, cash, drawdown) one at a time.
export function aggregateResultsProduction({
    totalsBuffer, cashesBuffer, ddsBuffer,
    maxDdPerPath, maxUwPerPath,
    belowInitPeriods,        // v2.3.0: Longest consecutive period below initial total assets per path
    consecutiveSellPeriods,  // v2.3.0: Longest consecutive risk asset sell period per path
    simPaths, dataLen, percentiles, bankruptCount,
    targetAssetRatio,
    initialTotalAssets
}) {
    const totalPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const cashPercentileData = percentiles.map(() => new Float32Array(dataLen));
    const ddPercentileData = percentiles.map(() => new Float32Array(dataLen));

    const ks = new Int32Array(percentiles.length);
    for (let i = 0; i < percentiles.length; i++) ks[i] = Math.floor((percentiles[i] / 100) * (simPaths - 1));

    const workBuffer = new Float32Array(simPaths);
    const resultBuf = new Float32Array(percentiles.length);

    // Percentile calculation for total assets (totals)
    {
        const totalT = transposeFlat(totalsBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(totalT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) totalPercentileData[i][t] = resultBuf[i];
        }
        // totalT is released when this scope exits
    }

    // Percentile calculation for cash buffer (cashes)
    {
        const cashT = transposeFlat(cashesBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(cashT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) cashPercentileData[i][t] = resultBuf[i];
        }
    }

    // Percentile calculation for drawdown (dds)
    {
        const ddT = transposeFlat(ddsBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(ddT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) ddPercentileData[i][t] = resultBuf[i];
        }
    }

    // Create copies to protect from destructive operations (quickselect)
    const ddCopy = Float32Array.from(maxDdPerPath);
    const uwCopy = Float32Array.from(maxUwPerPath);
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

    // Calculation of target asset maintenance probability
    // targetAssetThreshold = initial total assets × targetAssetRatio
    // Determine if the total assets in the final month (index dataLen-1) are at or above the threshold
    // Note: Do not change the successRate calculation formula (added as a separate indicator)
    const targetThreshold = initialTotalAssets * (targetAssetRatio / 100);
    let maintainCount = 0;
    const totalsArray = new Float32Array(totalsBuffer);
    for (let p = 0; p < simPaths; p++) {
        const finalAsset = totalsArray[p * dataLen + (dataLen - 1)];
        if (finalAsset >= targetThreshold) {
            maintainCount++;
        }
    }
    const targetAssetMaintainRate = (maintainCount / simPaths) * 100;

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
        belowInitPeriods,        // v2.3.0: Added longest consecutive period below initial total assets per path to return value
        consecutiveSellPeriods,  // v2.3.0: Added longest consecutive risk asset sell period per path to return value
        params: { simPaths, totalMonths: dataLen - 1 },
        dataLen,
        targetAssetMaintainRate,
        targetAssetRatio
    };
}