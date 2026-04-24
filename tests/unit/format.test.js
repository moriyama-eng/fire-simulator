import { describe, it, expect } from 'vitest';
import { formatPercentileInput, parsePercentiles } from '../../js/core/format.js';
describe('formatPercentileInput', () => {
    it('重複除去・昇順整列・最大5本制限', () => { expect(formatPercentileInput('10, 30, 20, 10, 99')).toBe('10, 20, 30, 99'); });
});
describe('parsePercentiles', () => {
    it('文字列から数値配列を返す', () => { expect(parsePercentiles('10, 30, 20, 10, 99')).toEqual([10, 20, 30, 99]); });
});