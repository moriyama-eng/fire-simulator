import { describe, it, expect } from 'vitest';
import { quickselectSafe } from '../../js/core/percentile.js';
describe('quickselectSafe', () => {
    it('sort 結果と一致する', () => {
        const arr = [3,1,4,1,5,9,2];
        const sorted = [...arr].sort((a,b)=>a-b);
        expect(quickselectSafe([...arr], 2, 0, arr.length-1)).toBe(sorted[2]);
    });
});