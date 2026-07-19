import { describe, it, expect } from 'vitest';
import { transposeFlat } from '../../js/core/aggregation.js';
describe('transposeFlat', () => {
    it('transposeFlat preserves values', () => {
        const data = new Float32Array([1,2,3,4,5,6]);
        const result = transposeFlat(data.buffer, 2, 3);
        expect(result[0][0]).toBe(1);
        expect(result[0][1]).toBe(4);
    });
});

// ===== Target asset maintenance rate tests =====
import { aggregateResultsProduction } from '../../js/core/aggregation.js';

describe('aggregateResultsProduction - targetAssetMaintainRate', () => {
    // Helper function: create mock buffers
    const createMockBuffers = (simPaths, dataLen, finalAssets) => {
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
        };
    };

    // Test case 1: all paths exceed threshold → 100%
    it('All paths exceed threshold → 100%', () => {
        const simPaths = 10;
        const dataLen = 361;
        const finalAssets = Array(simPaths).fill(150_000_000);
        const initialTotalAssets = 100_000_000;
        const targetAssetRatio = 100;
        
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

    // Test case 2: half of paths exceed threshold → 50%
    it('Half of paths exceed threshold → 50%', () => {
        const simPaths = 10;
        const dataLen = 361;
        const finalAssets = [
            150_000_000, 150_000_000, 150_000_000, 150_000_000, 150_000_000,
             50_000_000,  50_000_000,  50_000_000,  50_000_000,  50_000_000,
        ];
        const initialTotalAssets = 100_000_000;
        const targetAssetRatio = 100;
        
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
        expect(result.targetAssetMaintainRate).toBe(50);
    });

    // Test case 3: 0 paths exceed threshold → 0%
    it('0 paths exceed threshold → 0%', () => {
        const simPaths = 10;
        const dataLen = 361;
        const finalAssets = Array(simPaths).fill(50_000_000);
        const initialTotalAssets = 100_000_000;
        const targetAssetRatio = 100;
        
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

    // Test case 4: targetAssetRatio=0.5 (threshold halved) → all paths exceed = 100%
    it('targetAssetRatio=0.5 → threshold halved, all paths exceed', () => {
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

    // Test case 5: targetAssetRatio=2.0 (threshold doubled) → all paths below = 0%
    it('targetAssetRatio=2.0 → threshold doubled, all paths below', () => {
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
});