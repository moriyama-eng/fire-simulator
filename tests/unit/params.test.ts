import { describe, it, expect, afterEach } from 'vitest';
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
} from '../../src/core/params.js';
import { setLanguage } from '../../src/i18n.js';

afterEach(() => {
    setLanguage('ja');
});

describe('safeNumber', () => {
    it('converts string with commas to number', () => { expect(safeNumber('10,000', 0)).toBe(10000); });
    it('returns fallback for invalid value', () => { expect(safeNumber('abc', 99)).toBe(99); });
    it('returns fallback for empty string or whitespace', () => {
        expect(safeNumber('', 99)).toBe(99);
        expect(safeNumber('   ', 99)).toBe(99);
    });
    it('returns fallback for null and undefined', () => {
        expect(safeNumber(null, 99)).toBe(99);
        expect(safeNumber(undefined, 99)).toBe(99);
    });
    it('preserves numeric 0 and string 0', () => {
        expect(safeNumber(0, 99)).toBe(0);
        expect(safeNumber('0', 99)).toBe(0);
        expect(safeNumber('0.0', 99)).toBe(0);
    });
});


describe('calcAutoDf', () => {
    it('returns 5.0 for volatility=10', () => { expect(calcAutoDf(10)).toBe(5.0); });
    it('does not go below lower bound of 2.5', () => { expect(calcAutoDf(80)).toBe(3.0); });
    it('returns 30.0 for non-positive volatility', () => {
        expect(calcAutoDf(0)).toBe(30.0);
        expect(calcAutoDf(-5)).toBe(30.0);
    });
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

    it('converts EN cash and expense display units to internal JPY', () => {
        setLanguage('en');
        const inputs = {
            initialRiskAssetNum: '1.0',
            initialCashBufferNum: '100',
            monthlyExpenseNum: '3',
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
            seedNum: '123456',
        };
        const params = getParamsFromInputs(inputs);
        expect(params.initialCashBuffer).toBe(10_000_000);
        expect(params.monthlyExpense).toBe(300_000);
    });

    it('accepts 0 for targetAssetRatioNum and preserves 0 without falling back to DEFAULTS', () => {
        expect(getParamsFromInputs({ targetAssetRatioNum: '0' }).targetAssetRatio).toBe(0);
        expect(getParamsFromInputs({ targetAssetRatioNum: 0 }).targetAssetRatio).toBe(0);
        expect(getParamsFromInputs({ targetAssetRatioNum: '0.0' }).targetAssetRatio).toBe(0);
    });

    it('falls back to DEFAULTS for all fields when inputs is empty object {}', () => {
        const params = getParamsFromInputs({});
        expect(params.initialRiskAsset).toBe(DEFAULTS.initialRiskAsset * 100_000_000);
        expect(params.initialCashBuffer).toBe(DEFAULTS.initialCashBuffer * 10_000);
        expect(params.monthlyExpense).toBe(DEFAULTS.monthlyExpense * 10_000);
        expect(params.expectedReturn).toBe(DEFAULTS.expectedReturn);
        expect(params.volatility).toBe(DEFAULTS.volatility);
        expect(params.inflationRate).toBe(DEFAULTS.inflationRate);
        expect(params.simYears).toBe(DEFAULTS.simYears);
        expect(params.simPaths).toBe(DEFAULTS.simPaths);
        expect(params.drawdownTrigger).toBe(DEFAULTS.drawdownTrigger);
        expect(params.drawdownReplenish).toBe(DEFAULTS.drawdownReplenish);
        expect(params.replenishPace).toBe(DEFAULTS.replenishPace);
        expect(params.guardrailTrigger).toBe(DEFAULTS.guardrailTrigger);
        expect(params.guardrailReduction).toBe(DEFAULTS.guardrailReduction);
        expect(params.guardrailRelease).toBe(DEFAULTS.guardrailRelease);
        expect(params.infVol).toBe(DEFAULTS.infVol);
        expect(params.infAr).toBe(DEFAULTS.infAr);
        expect(params.simDfNum).toBe(DEFAULTS.simDfNum);
        expect(params.seedNum).toBe(DEFAULTS.seedNum);
        expect(params.targetAssetRatio).toBe(DEFAULTS.targetAssetRatio);
    });

    it('falls back to DEFAULTS when values are non-numeric strings', () => {
        const params = getParamsFromInputs({
            expectedReturnNum: 'abc',
            volatilityNum: 'invalid'
        });
        expect(params.expectedReturn).toBe(DEFAULTS.expectedReturn);
        expect(params.volatility).toBe(DEFAULTS.volatility);
    });

    it('falls back to DEFAULTS when values are empty string or whitespace', () => {
        const params = getParamsFromInputs({
            monthlyExpenseNum: '',
            expectedReturnNum: '   '
        });
        expect(params.monthlyExpense).toBe(DEFAULTS.monthlyExpense * 10_000);
        expect(params.expectedReturn).toBe(DEFAULTS.expectedReturn);
    });

    it('falls back to DEFAULTS when seedNum or other values are null', () => {
        const params = getParamsFromInputs({
            seedNum: null as unknown as string,
            initialRiskAssetNum: null as unknown as string
        });
        expect(params.seedNum).toBe(DEFAULTS.seedNum);
        expect(params.initialRiskAsset).toBe(DEFAULTS.initialRiskAsset * 100_000_000);
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
