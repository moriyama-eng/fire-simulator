import { describe, it, expect } from 'vitest';
import {
    safeNumber,
    calcAutoDf,
    getParamsFromInputs,
    DEFAULTS,
    clampSimPaths,
    clampNonPositive,
    clampNonNegative,
    clampRange,
    clampMinDf,
    resolveGuardrailRelease
} from '../../js/core/params.js';

describe('safeNumber', () => {
    it('converts string with commas to number', () => { expect(safeNumber('10,000', 0)).toBe(10000); });
    it('returns fallback for invalid value', () => { expect(safeNumber('abc', 99)).toBe(99); });
});

describe('calcAutoDf', () => {
    it('returns 5.0 for volatility=10', () => { expect(calcAutoDf(10)).toBe(5.0); });
    it('does not go below lower bound of 2.5', () => { expect(calcAutoDf(80)).toBe(3.0); });
});

// ===== Default value test for targetAssetRatio =====
describe('getParamsFromInputs - targetAssetRatio fallback', () => {
    it('uses DEFAULTS.targetAssetRatio when targetAssetRatioNum is undefined', () => {
        const inputs = {
            // Intentionally omit targetAssetRatioNum
            initialRiskAssetNum: '1.0',
            initialCashBufferNum: '1000',
            monthlyExpenseNum: '30',
            expectedReturnNum: '10.0',
            volatilityNum: '18.0',
            inflationRateNum: '2.0',
            simYearsNum: '30',
            simPathsNum: '10000',
            cashBufferToggle: true,
            drawdownTriggerNum: '-20.0',
            drawdownReplenishNum: '-5.0',
            replenishPaceNum: '5.0',
            guardrailToggle: false,
            guardrailTriggerNum: '-20.0',
            guardrailReleaseNum: '-15.0',
            guardrailReductionNum: '-20.0',
            inflationModelToggle: false,
            infVolNum: '2.0',
            infArNum: '0.5',
            returnModelSelect: 'log-t',
            simDfToggle: true,
            simDfNum: '4.0',
            seedToggle: false,
            seedNum: '123456'
        };
        const params = getParamsFromInputs(inputs);
        expect(params.targetAssetRatio).toBe(DEFAULTS.targetAssetRatio);
    });
});

// ===== T10: Shared clamp helper pure functions unit tests =====
describe('T10: Shared clamp helper functions', () => {
    it('clampSimPaths clamps to [5000, 50000] with rounding', () => {
        expect(clampSimPaths(5000.6)).toBe(5001);
        expect(clampSimPaths(4999.4)).toBe(5000);
        expect(clampSimPaths(0.4)).toBe(5000);
        expect(clampSimPaths(99999)).toBe(50000);
        expect(clampSimPaths(49999.6)).toBe(50000);
    });

    it('clampNonPositive clamps values to <= 0', () => {
        expect(clampNonPositive(5)).toBe(0);
        expect(clampNonPositive(-3)).toBe(-3);
    });

    it('clampNonNegative clamps values to >= min (default 0)', () => {
        expect(clampNonNegative(-5)).toBe(0);
        expect(clampNonNegative(7)).toBe(7);
    });

    it('clampNonNegative respects explicit min argument', () => {
        expect(clampNonNegative(-1, 2.5)).toBe(2.5);
        expect(clampNonNegative(3, 2.5)).toBe(3);
    });


    it('clampRange clamps values within [lo, hi]', () => {
        expect(clampRange(1.5, 0, 1.0)).toBe(1.0);
        expect(clampRange(-0.5, 0, 1.0)).toBe(0);
        expect(clampRange(600, 0, 500)).toBe(500);
    });

    it('clampMinDf clamps df to minimum 2.5', () => {
        expect(clampMinDf(1)).toBe(2.5);
        expect(clampMinDf(4)).toBe(4);
    });

    it('resolveGuardrailRelease snaps release to trigger when toggle is true and release < trigger', () => {
        expect(resolveGuardrailRelease(true, -20, -25)).toBe(-20);
        expect(resolveGuardrailRelease(true, -20, -10)).toBe(-10);
        expect(resolveGuardrailRelease(false, -20, -25)).toBe(-25);
    });
});