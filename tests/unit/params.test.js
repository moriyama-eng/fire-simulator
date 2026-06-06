import { describe, it, expect } from 'vitest';
import { safeNumber, calcAutoDf } from '../../js/core/params.js';
describe('safeNumber', () => {
    it('converts string with commas to number', () => { expect(safeNumber('10,000', 0)).toBe(10000); });
    it('returns fallback for invalid value', () => { expect(safeNumber('abc', 99)).toBe(99); });
});
describe('calcAutoDf', () => {
    it('returns 5.0 for volatility=10', () => { expect(calcAutoDf(10)).toBe(5.0); });
    it('does not go below lower bound of 2.5', () => { expect(calcAutoDf(80)).toBe(3.0); });
});

// ===== REQ-1-8: targetAssetRatio のデフォルト値テスト =====
import { getParamsFromInputs, DEFAULTS } from '../../js/core/params.js';

describe('getParamsFromInputs - targetAssetRatio fallback', () => {
    it('uses DEFAULTS.targetAssetRatio when targetAssetRatioNum is undefined', () => {
        const inputs = {
            // targetAssetRatioNum を意図的に省略
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