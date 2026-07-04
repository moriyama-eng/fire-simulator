import { describe, it, expect } from 'vitest';
import {
    convertJPYToDisplayValue,
    convertDisplayValueToJPY,
    getLocalizedInputBounds,
} from '../../js/comparison-ui.js';

describe('comparison-ui helpers', () => {
    describe('convertJPYToDisplayValue', () => {
        it('億円をMドルに変換', () => {
            expect(convertJPYToDisplayValue(100000000, 'unit.oku')).toBe(1.0);
            expect(convertJPYToDisplayValue(150000000, 'unit.oku')).toBe(1.5);
        });
        it('万円をKドルに変換', () => {
            expect(convertJPYToDisplayValue(10000000, 'unit.man')).toBe(100);
            expect(convertJPYToDisplayValue(300000, 'unit.man')).toBe(3);
        });
        it('単位なしはそのまま', () => {
            expect(convertJPYToDisplayValue(85.5, '%')).toBe(85.5);
            expect(convertJPYToDisplayValue(5, 'unit.multiplier')).toBe(5);
            expect(convertJPYToDisplayValue(10000, undefined)).toBe(10000);
        });
        it('undefined/null の場合は 0 を返す', () => {
            expect(convertJPYToDisplayValue(undefined, 'unit.oku')).toBe(0);
            expect(convertJPYToDisplayValue(null, 'unit.man')).toBe(0);
        });
        it('文字列の数値も正しく処理する', () => {
            expect(convertJPYToDisplayValue('100000000', 'unit.oku')).toBe(1.0);
            expect(convertJPYToDisplayValue('invalid', 'unit.oku')).toBe(0);
        });
    });

    describe('convertDisplayValueToJPY', () => {
        it('Mドルを円に変換', () => {
            expect(convertDisplayValueToJPY(1.0, 'unit.oku')).toBe(100000000);
            expect(convertDisplayValueToJPY(1.5, 'unit.oku')).toBe(150000000);
        });
        it('Kドルを円に変換', () => {
            expect(convertDisplayValueToJPY(100, 'unit.man')).toBe(10000000);
            expect(convertDisplayValueToJPY(3, 'unit.man')).toBe(300000);
        });
        it('単位なしはそのまま', () => {
            expect(convertDisplayValueToJPY(85.5, '%')).toBe(85.5);
            expect(convertDisplayValueToJPY(5, 'unit.multiplier')).toBe(5);
        });
        it('無効な値の場合は 0 を返す', () => {
            expect(convertDisplayValueToJPY('invalid', 'unit.oku')).toBe(0);
            expect(convertDisplayValueToJPY(NaN, 'unit.man')).toBe(0);
        });
    });

    describe('逆変換整合性 (100円 = $1 固定レート)', () => {
        const testCases = [
            { jpy: 100000000, unitKey: 'unit.oku', expectedDisplay: 1.0 },
            { jpy: 150000000, unitKey: 'unit.oku', expectedDisplay: 1.5 },
            { jpy: 10000000, unitKey: 'unit.man', expectedDisplay: 100 },
            { jpy: 300000, unitKey: 'unit.man', expectedDisplay: 3 },
        ];
        for (const tc of testCases) {
            it(`JPY ${tc.jpy} → 表示値 → JPY が一致する (${tc.unitKey})`, () => {
                const display = convertJPYToDisplayValue(tc.jpy, tc.unitKey);
                expect(display).toBeCloseTo(tc.expectedDisplay, 6);
                const backToJpy = convertDisplayValueToJPY(display, tc.unitKey);
                expect(backToJpy).toBe(tc.jpy);
            });
        }
        it('非通貨パラメータは変換されない', () => {
            const value = 85.5;
            const display = convertJPYToDisplayValue(value, '%');
            expect(display).toBe(value);
            const back = convertDisplayValueToJPY(display, '%');
            expect(back).toBe(value);
        });
    });

    describe('getLocalizedInputBounds', () => {
        const mockRowDefs = {
            initial_risk_asset: { key: 'initial_risk_asset', step: 0.1, min: 0, max: 10 },
            initial_cash_buffer: { key: 'initial_cash_buffer', step: 500, min: 0, max: 10000 },
            monthly_expense: { key: 'monthly_expense', step: 5, min: 0, max: 500 },
            target_asset_ratio: { key: 'target_asset_ratio', step: 1, min: 0, max: 500 },
            other_param: { key: 'other', step: 1, min: -100, max: 0 },
        };
        it('日本語モードでは元の値が返る', () => {
            expect(getLocalizedInputBounds(mockRowDefs.initial_cash_buffer, false)).toEqual({ step: 500, min: 0, max: 10000 });
        });
        it('英語モードの initial_risk_asset は正しく変換される', () => {
            expect(getLocalizedInputBounds(mockRowDefs.initial_risk_asset, true)).toEqual({ step: 0.1, min: 0, max: 10 });
        });
        it('英語モードの initial_cash_buffer は正しく変換される', () => {
            expect(getLocalizedInputBounds(mockRowDefs.initial_cash_buffer, true)).toEqual({ step: 50, min: 0, max: 1000 });
        });
        it('英語モードの monthly_expense は正しく変換される', () => {
            expect(getLocalizedInputBounds(mockRowDefs.monthly_expense, true)).toEqual({ step: 0.5, min: 0, max: 50 });
        });
        it('英語モードでも通貨以外のパラメータ（target_asset_ratio）は変換されない', () => {
            expect(getLocalizedInputBounds(mockRowDefs.target_asset_ratio, true)).toEqual({ step: 1, min: 0, max: 500 });
        });
        it('英語モードでも通貨以外のパラメータは変換されない', () => {
            expect(getLocalizedInputBounds(mockRowDefs.other_param, true)).toEqual({ step: 1, min: -100, max: 0 });
        });
    });
});
