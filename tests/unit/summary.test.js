import { describe, it, expect, beforeEach } from 'vitest';
import { renderEmptySummaryCard, updateSummaryCard } from '../../js/app/summary.js';
import { setLanguage } from '../../js/i18n.js';

function makeSummaryParams() {
    return {
        initialRiskAsset: 100_000_000,
        initialCashBuffer: 10_000_000,
        monthlyExpense: 300_000,
        expectedReturn: 10,
        volatility: 18,
        inflationRate: 2,
        infVol: 2,
        simYears: 30,
        simPaths: 10000,
        cashBufferToggle: false,
        guardrailToggle: false,
        useArInflation: false,
        targetAssetRatio: 100,
        drawdownTrigger: -20,
        drawdownReplenish: -5,
        replenishPace: 5,
        guardrailTrigger: -20,
        guardrailRelease: -15,
        guardrailReduction: -20,
    };
}

function makeSummaryResult() {
    return {
        successRate: 93.2,
        finalMedian: 538_074_816,
        targetAssetMaintainRate: 88.5,
        modelType: 'log-normal',
        usedDf: 4.2,
        usedSeed: 123456,
    };
}

describe('summary cards', () => {
    beforeEach(() => {
        setLanguage('en');
    });

    it('writes a not-executed empty card and does not throw when the container is missing', () => {
        document.body.innerHTML = '<div id="summaryCardContainer"></div>';
        renderEmptySummaryCard(false);
        const html = document.getElementById('summaryCardContainer').innerHTML;
        expect(html).toContain('data-i18n="summary.notExecuted"');
        expect(html).toContain('-');
        document.body.innerHTML = '';
        expect(() => renderEmptySummaryCard(false)).not.toThrow();
    });

    it('writes the success rate into the updated card', () => {
        document.body.innerHTML = '<div id="summaryCardContainer"></div>';
        updateSummaryCard(makeSummaryResult(), makeSummaryParams());
        expect(document.getElementById('summaryCardContainer').textContent).toContain('93.2');
    });
});
