// @vitest-environment jsdom
// tests/integration/belowinit-charts.test.js
// v2.3.0: Integration tests for the new metric charts (belowInitChart, sellChart)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runSimulation } from '../../js/simulation-engine.js';
import { readFileSync } from 'fs';

// Mock url.js to prevent isRunning from unintentionally becoming true due to automatic execution on load
vi.mock('../../js/core/url.js', async () => {
    const actual = await vi.importActual('../../js/core/url.js');
    return {
        ...actual,
        applyQueryParams: vi.fn()
    };
});

// Mock analysis-ui.js / comparison-ui.js to prevent Unhandled Rejection
// caused by asynchronous execution after the test environment is destroyed during language switching
vi.mock('../../js/analysis-ui.js', () => ({
    renderAnalysisTab: vi.fn(),
    setupAnalysisEventDelegation: vi.fn(),
    _resetDelegationForTest: vi.fn()
}));
vi.mock('../../js/comparison-ui.js', () => ({
    renderComparisonTab: vi.fn(),
    initComparisonTab: vi.fn(),
    openCompareTab: vi.fn()
}));

vi.mock('../../js/simulation-engine.js');

// Generate dummy simulation results containing the new v2.3.0 metrics
function makeDummyResultWithNewMetrics(overrides = {}) {
    const simPaths = 1000;
    const dataLen = 361; // 30 years * 12 months + 1
    const pcts = [10, 30, 50, 70, 90];
    const buildPD = () => pcts.map(() => new Float32Array(dataLen).fill(100_000_000));

    return {
        percentiles: pcts,
        totalPercentileData: buildPD(),
        cashPercentileData: buildPD(),
        ddPercentileData: buildPD(),
        successRate: 93.23,
        finalMedian: 538074816,
        worst10MaxDd: -0.8,
        worst5MaxDd: -1,
        medianMaxUw: 102,
        worst10MaxUw: 310,
        maxDdPerPath: new Float32Array(simPaths),
        maxUwPerPath: new Float32Array(simPaths),
        // v2.3.0: New metrics data
        belowInitPeriods: new Float32Array(simPaths).fill(60),    // Dummy value (60 months for all paths)
        consecutiveSellPeriods: new Float32Array(simPaths).fill(36), // Dummy value (36 months for all paths)
        params: { simPaths, totalMonths: dataLen - 1 },
        dataLen,
        usedSeed: 123456,
        modelType: 'log-t',
        usedDf: 4.2,
        targetAssetMaintainRate: 93.23,
        targetAssetRatio: 1.0,
        ...overrides
    };
}

// Build the DOM only once during setup of the test execution environment (JSDOM).
// Include all necessary ID elements to prevent undefined errors when loading/initializing app.js and analysis-ui.
const domSnippet = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
document.body.innerHTML = `
    <div id="simulationTab">
        ${domSnippet}
        <!-- Gray-out target panels required for app.js initialization -->
        <div id="tDistParams"></div>
        <div id="guardrailParams"></div>
        <div id="cashBufferParams"></div>
        <div id="seedInputWrapper"></div>
        <div id="arModelParams"></div>
        <!-- v2.3.0: New metrics chart titles -->
        <h2 id="belowInitTitle" data-i18n="chart.belowInit.title">初期総資産割れ 継続期間 発生確率</h2>
        <h2 id="sellTitle" data-i18n="chart.sell.title">初期総資産割れ時 リスク資産連続売却期間 発生確率</h2>
        <canvas id="belowInitChartCanvas"></canvas>
        <canvas id="sellChartCanvas"></canvas>
        <input type="checkbox" id="logScaleToggle">
    </div>
    <!-- Define all elements rendered asynchronously in analysis-ui (fundamental workaround for Unhandled Rejection) -->
    <div id="analysisTab">
        <div id="card1Summary"></div>
        <div id="card1Detail" class="hidden"></div>
        <button id="card1EditBtn" data-action="edit-base"></button>
        <div id="analysisError" class="hidden"></div>
        <div id="factorSelector"></div>
        <div id="selectedFactorCount"></div>
        <div id="scenarioCount"></div>
        <button id="runAnalysisBtn"></button>
        <span id="estTime"></span>
        <div id="targetTableWrapper"></div>
        <select id="targetMetric"><option value="success_rate_pct"></option></select>
        <div id="targetMetricLabel"></div>
        <div id="currentMetricValue"></div>
        <div id="targetTableBody"></div>
        <div id="cardTarget" class="hidden"></div>
        <div id="cardCompare" class="hidden"></div>
        <div id="compareCardsContainer"></div>
        <button id="simTabBtn"></button>
    </div>
    <div id="tooltip-container"></div>
`;

// Import app.js only once with DOM constructed
await import('../../js/app.js');

// After load is complete, explicitly dispatch DOMContentLoaded to trigger
// event registration and initialization in the DOMContentLoaded listener in app.js
document.dispatchEvent(new Event('DOMContentLoaded'));

describe('Below-Initial charts integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        runSimulation.mockResolvedValue(makeDummyResultWithNewMetrics());
    });

    it('updates chart titles on language switch', async () => {
        const setLanguageGlobal = (lang) => {
            if (typeof window !== 'undefined' && window.__setLanguage) {
                window.__setLanguage(lang);
            }
        };

        // Set Japanese as the initial language
        setLanguageGlobal('ja');
        const titleBelowInit = document.getElementById('belowInitTitle');
        const titleSell = document.getElementById('sellTitle');

        expect(titleBelowInit.textContent).toBe('初期総資産割れ 継続期間 発生確率');
        expect(titleSell.textContent).toBe('初期総資産割れ時 リスク資産連続売却期間 発生確率');

        // Switch to English
        setLanguageGlobal('en');
        await new Promise(r => setTimeout(r, 50));

        // Confirm that the text switches to English corresponding to the i18n key
        expect(titleBelowInit.textContent).toBe('Duration Below Initial Assets Probability');
        expect(titleSell.textContent).toBe('Consecutive Risk-Asset Sales While Below Initial Assets Probability');

        // Switch back to Japanese
        setLanguageGlobal('ja');
        await new Promise(r => setTimeout(r, 50));

        expect(titleBelowInit.textContent).toBe('初期総資産割れ 継続期間 発生確率');
        expect(titleSell.textContent).toBe('初期総資産割れ時 リスク資産連続売却期間 発生確率');
    });
});
