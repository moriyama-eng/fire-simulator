// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { convertCurrencyInputs } from '../../js/app/ui-helpers.js';
import { getParamsFromInputs } from '../../js/core/params.js';
import { setLanguage } from '../../js/i18n.js';

const fixtureHtml = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');

const baseInputs = {
    initialRiskAssetNum: '1.0',
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

function cashInput() {
    return document.getElementById('initialCashBufferNum');
}

function expenseInput() {
    return document.getElementById('monthlyExpenseNum');
}

function paramsFromDisplay() {
    return getParamsFromInputs({
        ...baseInputs,
        initialCashBufferNum: cashInput().value,
        monthlyExpenseNum: expenseInput().value,
    });
}

describe('convertCurrencyInputs', () => {
    afterEach(() => {
        setLanguage('ja');
    });

    beforeEach(() => {
        setLanguage('ja');
        document.body.innerHTML = fixtureHtml;
        const cash = cashInput();
        const expense = expenseInput();
        cash.value = '1000';
        expense.value = '30';
        cash.setAttribute('step', '500');
        expense.setAttribute('step', '5');
        cash.setAttribute('min', '0');
        expense.setAttribute('min', '0');
        cash.setAttribute('max', '10000');
        expense.setAttribute('max', '500');
    });

    it('converts JA man-yen display to EN K-dollar display and scales bounds', () => {
        convertCurrencyInputs('en');
        expect(cashInput().value.replace(/,/g, '')).toBe('100');
        expect(expenseInput().value.replace(/,/g, '')).toBe('3');
        expect(cashInput().getAttribute('step')).toBe('50');
        expect(expenseInput().getAttribute('step')).toBe('0.5');
        expect(cashInput().getAttribute('min')).toBe('0');
        expect(expenseInput().getAttribute('min')).toBe('0');
        expect(cashInput().getAttribute('max')).toBe('1000');
        expect(expenseInput().getAttribute('max')).toBe('50');
    });

    it('converts EN display back to JA man-yen and scales bounds', () => {
        convertCurrencyInputs('en');
        convertCurrencyInputs('ja');
        expect(cashInput().value.replace(/,/g, '')).toBe('1000');
        expect(expenseInput().value.replace(/,/g, '')).toBe('30');
        expect(cashInput().getAttribute('step')).toBe('500');
        expect(expenseInput().getAttribute('step')).toBe('5');
        expect(cashInput().getAttribute('max')).toBe('10000');
        expect(expenseInput().getAttribute('max')).toBe('500');
    });

    it('keeps internal JPY unchanged after a JA to EN to JA round trip', () => {
        setLanguage('ja');
        const yenBefore = paramsFromDisplay();
        convertCurrencyInputs('en');
        setLanguage('en');
        const yenEn = paramsFromDisplay();
        convertCurrencyInputs('ja');
        setLanguage('ja');
        const yenAfter = paramsFromDisplay();
        expect(yenEn.initialCashBuffer).toBe(yenBefore.initialCashBuffer);
        expect(yenEn.monthlyExpense).toBe(yenBefore.monthlyExpense);
        expect(yenAfter.initialCashBuffer).toBe(yenBefore.initialCashBuffer);
        expect(yenAfter.monthlyExpense).toBe(yenBefore.monthlyExpense);
        expect(yenBefore.initialCashBuffer).toBe(10_000_000);
        expect(yenBefore.monthlyExpense).toBe(300_000);
    });

    it('returns without throwing when cash and expense inputs are missing', () => {
        document.body.innerHTML = '';
        expect(() => convertCurrencyInputs('en')).not.toThrow();
        expect(() => convertCurrencyInputs('ja')).not.toThrow();
    });
});
