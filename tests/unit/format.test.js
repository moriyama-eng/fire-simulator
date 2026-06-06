import { describe, it, expect } from 'vitest';
import { formatPercentileInput, parsePercentiles } from '../../js/core/format.js';
describe('formatPercentileInput', () => {
    it('removes duplicates, sorts, limits to 5', () => { expect(formatPercentileInput('10, 30, 20, 10, 99')).toBe('10, 20, 30, 99'); });
});
describe('parsePercentiles', () => {
    it('returns numeric array from string', () => { expect(parsePercentiles('10, 30, 20, 10, 99')).toEqual([10, 20, 30, 99]); });
});