import { describe, it, expect } from 'vitest';
import { quickselectSafe, multiSelectTrue } from '../../js/core/percentile.js';
describe('quickselectSafe', () => {
    it('matches sorted result', () => {
        const arr = [3,1,4,1,5,9,2];
        const sorted = [...arr].sort((a,b)=>a-b);
        expect(quickselectSafe([...arr], 2, 0, arr.length-1)).toBe(sorted[2]);
    });
});

describe('multiSelectTrue', () => {
    it('matches sorted values at several k including duplicates', () => {
        const arr = [3, 1, 4, 1, 5, 9, 2, 1];
        const sorted = [...arr].sort((a, b) => a - b);
        const ks = [0, 2, 2, 7];
        const out = new Float64Array(ks.length);
        multiSelectTrue(Float64Array.from(arr), ks, out);
        ks.forEach((k, i) => {
            expect(out[i]).toBe(sorted[k]);
        });
    });
});
