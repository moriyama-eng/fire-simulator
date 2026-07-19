import { describe, it, expect } from 'vitest';
import { buildCdfPoints } from '../../js/app/charts.js';

describe('buildCdfPoints with mode', () => {
    it('CDF mode: calculates (i+1)/N using last-wins', () => {
        const sortedData = [-100, -100, -50, -50, 0];
        const simPaths = 5;
        const result = buildCdfPoints(sortedData, simPaths, 'cdf');
        // Last occurrence of -100 is at i=1 → (1+1)/5 = 40%
        // Last occurrence of -50 is at i=3 → (3+1)/5 = 80%
        // Last occurrence of 0 is at i=4 → (4+1)/5 = 100% (but 0 is overwritten with 100)
        expect(result.find(p => p.x === -100).y).toBe(40);
        expect(result.find(p => p.x === -50).y).toBe(80);
        expect(result.find(p => p.x === 0).y).toBe(100);
    });

    it('CCDF mode: calculates (N-i)/N using first-wins', () => {
        const sortedData = [-100, -100, -50, -50, 0];
        const simPaths = 5;
        const result = buildCdfPoints(sortedData, simPaths, 'ccdf');
        // First occurrence of -100 is at i=0 → (5-0)/5 = 100%
        // First occurrence of -50 is at i=2 → (5-2)/5 = 60%
        // First occurrence of 0 is at i=4 → (5-4)/5 = 20% (but 0 is overwritten with 100)
        expect(result.find(p => p.x === -100).y).toBe(100);
        expect(result.find(p => p.x === -50).y).toBe(60);
        expect(result.find(p => p.x === 0).y).toBe(100);
    });

    it('A point at x=0 on the horizontal axis is forcibly added', () => {
        const sortedData = [-80, -60, -40];
        const simPaths = 3;
        const result = buildCdfPoints(sortedData, simPaths);
        expect(result[result.length - 1].x).toBe(0);
        expect(result[result.length - 1].y).toBe(100);
    });

    it('Does not error even with an empty array', () => {
        const result = buildCdfPoints([], 10);
        expect(result).toEqual([{ x: 0, y: 100 }]);
    });
});
