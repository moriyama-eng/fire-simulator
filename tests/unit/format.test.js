import { describe, it, expect } from 'vitest';
import { formatPercentileInput, parsePercentiles } from '../../js/core/format.js';
describe('percentile input helpers', () => {
    it('formats and parses the same raw string', () => {
        const raw = '10, 30, 20, 10, 99';
        expect(formatPercentileInput(raw)).toBe('10, 20, 30, 99');
        expect(parsePercentiles(raw)).toEqual([10, 20, 30, 99]);
    });
});