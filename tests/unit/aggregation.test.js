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

// ===== REQ-1-6: 目標資産維持確率のテスト =====
import { aggregateResultsProduction } from '../../js/core/aggregation.js';

describe('aggregateResultsProduction - targetAssetMaintainRate', () => {
    // ヘルパー関数: モックバッファを作成
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

    // テストケース1: 全パスが閾値超過 → 100%
    it('全パスが閾値超過 → 100%', () => {
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

    // テストケース2: 半数パスが閾値超過 → 50%
    it('半数パスが閾値超過 → 50%', () => {
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

    // テストケース3: 0パスが閾値超過 → 0%
    it('0パスが閾値超過 → 0%', () => {
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

    // テストケース4: targetAssetRatio=0.5（閾値半減）→ 全パス超過で100%
    it('targetAssetRatio=0.5 → 閾値半減で全パス超過', () => {
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

    // テストケース5: targetAssetRatio=2.0（閾値倍）→ 全パス未満で0%
    it('targetAssetRatio=2.0 → 閾値倍で全パス未満', () => {
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