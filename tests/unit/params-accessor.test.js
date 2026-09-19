// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { getCurrentSimParams } from '../../js/params-accessor.js';
import { setLanguage } from '../../js/i18n.js';

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');

describe('getCurrentSimParams', () => {
    beforeEach(() => {
        setLanguage('ja');
    });

    it('returns fallback defaults when DOM ids are missing', () => {
        document.body.innerHTML = '';
        const params = getCurrentSimParams();
        expect(params.initialCashBuffer).toBe(10_000_000);
        expect(params.monthlyExpense).toBe(300_000);
        expect(params.initialRiskAsset).toBe(100_000_000);
        expect(params.expectedReturn).toBe(10.0);
    });

    it('reads values from fixture DOM instead of fallbacks', () => {
        document.body.innerHTML = dom;
        document.getElementById('initialCashBufferNum').value = '2000';
        document.getElementById('monthlyExpenseNum').value = '40';
        document.getElementById('expectedReturnNum').value = '7.0';
        const params = getCurrentSimParams();
        expect(params.initialCashBuffer).toBe(20_000_000);
        expect(params.monthlyExpense).toBe(400_000);
        expect(params.expectedReturn).toBe(7.0);
    });
});
