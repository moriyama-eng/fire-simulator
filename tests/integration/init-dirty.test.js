// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { runSimulation } from '../../js/simulation-engine.js';
import { setLastSimResult } from '../../js/app/state.js';
import { markResultClean } from '../../js/core/state.js';

vi.mock('../../js/core/url.js', async () => {
    const actual = await vi.importActual('../../js/core/url.js');
    return {
        ...actual,
        applyQueryParams: vi.fn(),
    };
});

vi.mock('../../js/analysis-ui.js', () => ({
    renderAnalysisTab: vi.fn(),
    setupAnalysisEventDelegation: vi.fn(),
    _resetDelegationForTest: vi.fn(),
}));

vi.mock('../../js/comparison-ui.js', () => ({
    renderComparisonTab: vi.fn(),
    initComparisonTab: vi.fn(),
    openCompareTab: vi.fn(),
}));

vi.mock('../../js/simulation-engine.js');

vi.mock('../../js/app/charts.js', () => ({
    renderAssetChart: vi.fn(),
    onScaleToggle: vi.fn(),
    applyDownsideFocus: vi.fn(),
    renderCashChart: vi.fn(),
    renderDdCdfChart: vi.fn(),
    renderUwCdfChart: vi.fn(),
    renderBelowInitCdfChart: vi.fn(),
    renderConsecutiveSellCdfChart: vi.fn(),
}));

const domSnippet = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
document.body.innerHTML = `
    <div id="simulationTab">
        ${domSnippet}
        <div id="tDistParams"></div>
        <div id="guardrailParams"></div>
        <div id="cashBufferParams"></div>
        <div id="seedInputWrapper"></div>
        <div id="arModelParams"></div>
        <input type="checkbox" id="logScaleToggle">
        <input type="checkbox" id="downsideFocusAsset">
        <input type="checkbox" id="downsideFocusCash">
    </div>
    <div id="analysisTab">
        <div id="card1Summary"></div>
        <button id="simTabBtn"></button>
    </div>
`;

await import('../../js/app.js');
document.dispatchEvent(new Event('DOMContentLoaded'));

function plantResult() {
    runSimulation.mockResolvedValue({});
    setLastSimResult({
        successRate: 90,
        finalMedian: 100_000_000,
        targetAssetMaintainRate: 80,
        modelType: 'log-normal',
        usedDf: 4,
        usedSeed: 1,
    });
    markResultClean();
}

describe('init dirty wiring', () => {
    it('does not mark dirty when display-control toggles change', () => {
        plantResult();
        expect(document.getElementById('shareXBtn').disabled).toBe(false);
        for (const id of ['logScaleToggle', 'downsideFocusAsset', 'downsideFocusCash']) {
            document.getElementById(id).dispatchEvent(new Event('change', { bubbles: true }));
            expect(document.getElementById('shareXBtn').disabled).toBe(false);
        }
    });

    it('marks simulation-tab input change dirty when a result already exists', () => {
        plantResult();
        expect(document.getElementById('shareXBtn').disabled).toBe(false);

        const input = document.getElementById('expectedReturnNum');
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(document.getElementById('shareXBtn').disabled).toBe(true);
    });
});
