import { describe, it, expect } from 'vitest';
import { safeNumber, calcAutoDf } from '../../js/core/params.js';
describe('safeNumber', () => {
    it('カンマを含む文字列を数値に変換する', () => { expect(safeNumber('10,000', 0)).toBe(10000); });
    it('無効値で fallback を返す', () => { expect(safeNumber('abc', 99)).toBe(99); });
});
describe('calcAutoDf', () => {
    it('volatility=10 で 5.0', () => { expect(calcAutoDf(10)).toBe(5.0); });
    it('下限値 2.5 を下回らない', () => { expect(calcAutoDf(80)).toBe(3.0); });
});