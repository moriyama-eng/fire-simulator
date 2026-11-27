import { describe, it, expect } from 'vitest';
import { transposeFlat, aggregateResultsProduction } from '../../src/core/aggregation.js';

describe('transposeFlat', () => {
    it('transposeFlat preserves values', () => {
        const data = new Float32Array([1, 2, 3, 4, 5, 6]);
        const result = transposeFlat(data.buffer, 2, 3);
        expect(result[0][0]).toBe(1);
        expect(result[0][1]).toBe(4);
    });
});

// ===== Target asset maintenance rate tests =====
describe('aggregateResultsProduction - targetAssetMaintainRate', () => {
    // Helper function: create mock buffers
    const createMockBuffers = (simPaths: number, dataLen: number, finalAssets: number[]) => {
        const totalsBuffer = new Float32Array(simPaths * dataLen);
        for (let p = 0; p < simPaths; p++) {
            totalsBuffer[p * dataLen + (dataLen - 1)] = finalAssets[p];
        }
        return {
            totalsBuffer: totalsBuffer.buffer,
            cashesBuffer: new Float32Array(simPaths * dataLen).buffer,
            ddsBuffer: new Float32Array(simPaths * dataLen).buffer,
            maxDdPerPath: new Float32Array(simPaths),
            maxUwPerPath: new Float32Array(simPaths),
            belowInitPeriods: new Float32Array(simPaths),
            consecutiveSellPeriods: new Float32Array(simPaths),
        };
    };

    it.each([
        ['all paths exceed', Array(10).fill(150_000_000), 100],
        ['half of paths exceed', [
            150_000_000, 150_000_000, 150_000_000, 150_000_000, 150_000_000,
            50_000_000, 50_000_000, 50_000_000, 50_000_000, 50_000_000,
        ], 50],
        ['no paths exceed', Array(10).fill(50_000_000), 0],
    ])('%s -> maintain rate %s', (_label: string, finalAssets: number[], expectedRate: number) => {
        const simPaths = 10;
        const dataLen = 361;
        const mock = createMockBuffers(simPaths, dataLen, finalAssets);
        const result = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [50],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 100_000_000,
        });
        expect(result.targetAssetMaintainRate).toBe(expectedRate);
    });

    // Test case 4: targetAssetRatio=0.5 (threshold halved) -> all paths exceed = 100%
    it('targetAssetRatio=0.5 -> threshold halved, all paths exceed', () => {
        const simPaths = 10;
        const dataLen = 361;
        const finalAssets = Array(simPaths).fill(60_000_000);
        const initialTotalAssets = 100_000_000;
        const targetAssetRatio = 50;

        const mock = createMockBuffers(simPaths, dataLen, finalAssets);
        const result = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [50],
            bankruptCount: 0,
            targetAssetRatio,
            initialTotalAssets,
        });
        expect(result.targetAssetMaintainRate).toBe(100);
    });

    // Test case 5: targetAssetRatio=2.0 (threshold doubled) -> all paths below = 0%
    it('targetAssetRatio=2.0 -> threshold doubled, all paths below', () => {
        const simPaths = 10;
        const dataLen = 361;
        const finalAssets = Array(simPaths).fill(150_000_000);
        const initialTotalAssets = 100_000_000;
        const targetAssetRatio = 200;

        const mock = createMockBuffers(simPaths, dataLen, finalAssets);
        const result = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [50],
            bankruptCount: 0,
            targetAssetRatio,
            initialTotalAssets,
        });
        expect(result.targetAssetMaintainRate).toBe(0);
    });

    it('handles percentiles array without 50', () => {
        const simPaths = 10;
        const dataLen = 361;
        const mock = createMockBuffers(simPaths, dataLen, Array(10).fill(100_000_000));
        const result = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [10, 30, 70, 90],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 100_000_000,
        });
        expect(result).toBeDefined();
        expect(result.finalMedian).toBeDefined();
    });

    it('handles undefined belowInitPeriods and consecutiveSellPeriods gracefully', () => {
        const simPaths = 2;
        const dataLen = 2;
        const result = aggregateResultsProduction({
            totalsBuffer: new Float32Array(simPaths * dataLen).buffer,
            cashesBuffer: new Float32Array(simPaths * dataLen).buffer,
            ddsBuffer: new Float32Array(simPaths * dataLen).buffer,
            maxDdPerPath: new Float32Array(simPaths),
            maxUwPerPath: new Float32Array(simPaths),
            simPaths,
            dataLen,
            percentiles: [50],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 100_000_000,
        });
        expect(result.belowInitPeriods.length).toBe(simPaths);
        expect(result.consecutiveSellPeriods.length).toBe(simPaths);
    });

    it('computes accurate percentiles for unsorted input and true finalMedian when 50 is omitted or percentiles is empty', () => {
        const simPaths = 10;
        const dataLen = 2;
        const finalValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        const mock = createMockBuffers(simPaths, dataLen, finalValues);

        const unsorted = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [90, 10],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 50,
        });
        // Order matches caller percentiles [90, 10]
        expect(unsorted.totalPercentileData[0][1]).toBe(90);
        expect(unsorted.totalPercentileData[1][1]).toBe(10);
        // True 50th percentile (index floor(0.5 * 9) = 4 -> value 50), not P10 or P90
        expect(unsorted.finalMedian).toBe(50);

        const emptyPct = aggregateResultsProduction({
            ...mock,
            simPaths,
            dataLen,
            percentiles: [],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 50,
        });
        expect(emptyPct.totalPercentileData).toEqual([]);
        expect(emptyPct.finalMedian).toBe(50);
    });

    it('converts plain ArrayLike<number> per-path arrays into real Float32Array instances', () => {
        const simPaths = 4;
        const dataLen = 2;
        const totals = new Float32Array([100, 110, 100, 120, 100, 130, 100, 140]);
        const cashes = new Float32Array(simPaths * dataLen);
        const dds = new Float32Array(simPaths * dataLen);

        const result = aggregateResultsProduction({
            totalsBuffer: totals.buffer,
            cashesBuffer: cashes.buffer,
            ddsBuffer: dds.buffer,
            maxDdPerPath: [-0.1, -0.2, -0.3, -0.4],
            maxUwPerPath: [1, 2, 3, 4],
            belowInitPeriods: [0, 1, 2, 3],
            consecutiveSellPeriods: [0, 0, 1, 2],
            simPaths,
            dataLen,
            percentiles: [50],
            bankruptCount: 0,
            targetAssetRatio: 100,
            initialTotalAssets: 100,
        });

        expect(result.maxDdPerPath).toBeInstanceOf(Float32Array);
        expect(result.maxUwPerPath).toBeInstanceOf(Float32Array);
        expect(result.belowInitPeriods).toBeInstanceOf(Float32Array);
        expect(result.consecutiveSellPeriods).toBeInstanceOf(Float32Array);
        expect(Array.from(result.belowInitPeriods)).toEqual([0, 1, 2, 3]);
    });
});
