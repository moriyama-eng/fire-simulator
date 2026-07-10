import { describe, it, expect } from 'vitest';
import { buildCdfPoints } from '../../js/app.js';

describe('buildCdfPoints with mode', () => {
    it('CDFモード: 後勝ちで (i+1)/N を計算する', () => {
        const sortedData = [-100, -100, -50, -50, 0];
        const simPaths = 5;
        const result = buildCdfPoints(sortedData, simPaths, 'cdf');
        // -100 の最後の出現は i=1 → (1+1)/5 = 40%
        // -50 の最後の出現 is i=3 → (3+1)/5 = 80%
        // 0 の最後の出現は i=4 → (4+1)/5 = 100%（ただし 0 は 100 で上書きされる）
        expect(result.find(p => p.x === -100).y).toBe(40);
        expect(result.find(p => p.x === -50).y).toBe(80);
        expect(result.find(p => p.x === 0).y).toBe(100);
    });

    it('CCDFモード: 先勝ちで (N-i)/N を計算する', () => {
        const sortedData = [-100, -100, -50, -50, 0];
        const simPaths = 5;
        const result = buildCdfPoints(sortedData, simPaths, 'ccdf');
        // -100 の最初の出現は i=0 → (5-0)/5 = 100%
        // -50 の最初の出現は i=2 → (5-2)/5 = 60%
        // 0 の最初の出現は i=4 → (5-4)/5 = 20%（ただし 0 は 100 で上書きされる）
        expect(result.find(p => p.x === -100).y).toBe(100);
        expect(result.find(p => p.x === -50).y).toBe(60);
        expect(result.find(p => p.x === 0).y).toBe(100);
    });

    it('横軸0の点が強制的に追加される', () => {
        const sortedData = [-80, -60, -40];
        const simPaths = 3;
        const result = buildCdfPoints(sortedData, simPaths);
        expect(result[result.length - 1].x).toBe(0);
        expect(result[result.length - 1].y).toBe(100);
    });

    it('空の配列でもエラーにならない', () => {
        const result = buildCdfPoints([], 10);
        expect(result).toEqual([{ x: 0, y: 100 }]);
    });
});
