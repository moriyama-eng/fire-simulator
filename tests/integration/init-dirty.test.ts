// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { runSimulation } from '../../src/simulation-engine.js';
import { setLastSimResult } from '../../src/app/state.js';
import { markResultClean } from '../../src/core/state.js';
import type { AggregatedMetrics } from '../../src/types/simulation.js';

vi.mock('../../src/core/url.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/core/url.js')>('../../src/core/url.js');
    return {
        ...actual,
        applyQueryParams: vi.fn(),
    };
});

vi.mock('../../src/analysis-ui.js', () => ({
    renderAnalysisTab: vi.fn(),
    setupAnalysisEventDelegation: vi.fn(),
    _resetDelegationForTest: vi.fn(),
}));

vi.mock('../../src/comparison-ui.js', () => ({
    renderComparisonTab: vi.fn(),
    initComparisonTab: vi.fn(),
    openCompareTab: vi.fn(),
}));

vi.mock('../../src/simulation-engine.js');

vi.mock('../../src/app/charts.js', () => ({
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

await import('../../src/app.js');
document.dispatchEvent(new Event('DOMContentLoaded'));

const runSimulationMock = runSimulation as unknown as ReturnType<typeof vi.fn>;

function plantResult(): void {
    runSimulationMock.mockResolvedValue({});
    setLastSimResult({
        successRate: 90,
        finalMedian: 100_000_000,
        targetAssetMaintainRate: 80,
        modelType: 'log-normal',
        usedDf: 4,
        usedSeed: 1,
    } as unknown as AggregatedMetrics);
    markResultClean();
}

describe('init dirty wiring', () => {
    it('does not mark dirty when display-control toggles change', () => {
        plantResult();
        const shareBtn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(shareBtn?.disabled).toBe(false);
        for (const id of ['logScaleToggle', 'downsideFocusAsset', 'downsideFocusCash']) {
            document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true }));
            expect(shareBtn?.disabled).toBe(false);
        }
    });

    it('marks simulation-tab input change dirty when a result already exists', () => {
        plantResult();
        const shareBtn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(shareBtn?.disabled).toBe(false);

        const input = document.getElementById('expectedReturnNum');
        input?.dispatchEvent(new Event('change', { bubbles: true }));
        expect(shareBtn?.disabled).toBe(true);
    });
});
