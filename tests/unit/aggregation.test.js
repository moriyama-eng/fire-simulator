import { describe, it, expect } from 'vitest';
import { transposeFlat } from '../../js/core/aggregation.js';
describe('transposeFlat', () => {
    it('転置後も値が正しい', () => {
        const data = new Float32Array([1,2,3,4,5,6]);
        const result = transposeFlat(data.buffer, 2, 3);
        expect(result[0][0]).toBe(1);
        expect(result[0][1]).toBe(4);
    });
});