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

// v1.10.0でメモリ効率化のため逐次転置方式に変更。v2.0.0でも同様の実装を維持。
// 総資産・現金・ドローダウンを1種類ずつ計算し、不要になった転置結果はGCに解放させる。
export function aggregateResultsProduction({
    totalsBuffer, cashesBuffer, ddsBuffer,
    maxDdPerPath, maxUwPerPath,
    belowInitPeriods,        // v2.3.0: パスごとの初期総資産割れ最長継続期間
    consecutiveSellPeriods,  // v2.3.0: パスごとのリスク資産最長連続売却期間
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

    // 総資産(totals)のパーセンタイル計算
    {
        const totalT = transposeFlat(totalsBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(totalT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) totalPercentileData[i][t] = resultBuf[i];
        }
        // totalT はこのスコープを抜けると解放される
    }

    // 現金バッファ(cashes)のパーセンタイル計算
    {
        const cashT = transposeFlat(cashesBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(cashT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) cashPercentileData[i][t] = resultBuf[i];
        }
    }

    // ドローダウン(dds)のパーセンタイル計算
    {
        const ddT = transposeFlat(ddsBuffer, simPaths, dataLen);
        for (let t = 0; t < dataLen; t++) {
            workBuffer.set(ddT[t]);
            multiSelectTrue(workBuffer, ks, resultBuf);
            for (let i = 0; i < ks.length; i++) ddPercentileData[i][t] = resultBuf[i];
        }
    }

    // 破壊的操作(quickselect)から保護するためコピーを作成
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

    // 目標資産維持確率の計算
    // targetAssetThreshold = 初期総資産 × targetAssetRatio
    // 最終月（インデックス dataLen-1）の総資産が閾値以上か判定
    // 注意: successRate の計算式は変更しない（別指標として追加）
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
        belowInitPeriods,        // v2.3.0: パスごとの初期総資産割れ最長継続期間を戻り値に追加
        consecutiveSellPeriods,  // v2.3.0: パスごとのリスク資産最長連続売却期間を戻り値に追加
        params: { simPaths, totalMonths: dataLen - 1 },
        dataLen,
        targetAssetMaintainRate,
        targetAssetRatio
    };
}