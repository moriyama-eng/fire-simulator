// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { renderAnalysisTab, setupAnalysisEventDelegation, _resetDelegationForTest } from '../../js/analysis-ui.js';
import * as AS from '../../js/analysis-state.js';
import { setLanguage, t } from '../../js/i18n.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { makeAnalysisResult, makeScenarioPoint, makeDummySimResult, makeBaseMetrics } from '../helpers/analysis-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

vi.mock('../../js/simulation-engine.js');

const fixtureHtml = readFileSync('tests/fixtures/analysis-dom-snippet.html', 'utf-8');

const makeBaseEffectiveParams = (overrides = {}) => ({
  initialRiskAsset: 100000000,
  initialCashBuffer: 10000000,
  monthlyExpense: 300000,
  expectedReturn: 8.0,
  volatility: 18.0,
  inflationRate: 2.0,
  simYears: 30,
  simPaths: 10000,
  seed: 123456,
  modelType: 'log-normal',
  cashBufferToggle: false,
  guardrailToggle: false,
  ...overrides
});

// Mock DOM setup
const setupDOM = () => {
  document.body.innerHTML = `
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
    `;
  setupAnalysisEventDelegation();
};

beforeEach(() => {
  setLanguage('ja');
  _resetDelegationForTest();
  setupDOM();
  AS._resetStateForTest();
  vi.clearAllMocks();
});

describe('Initial rendering', () => {
  it('shows placeholder when base condition is not set', () => {
    renderAnalysisTab();
    expect(document.getElementById('card1Summary').textContent).toContain(t('analysis.noBaseContext'));
  });

  it('displays available factors in factor selector', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    renderAnalysisTab();
    expect(document.querySelectorAll('#factorSelector .factor-select-card').length).toBeGreaterThan(0);
  });
});

describe('Base scenario card', () => {
  it('displays base scenario KPI when analysis result exists', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams());
    const mockResult = {
      baseScenario: { metrics: { success_rate_pct: 93.234, final_median_jpy: 540000000 } }
    };
    AS.setAnalysisResult(mockResult);
    renderAnalysisTab();
    const summary = document.getElementById('card1Summary').textContent;
    expect(summary).toContain('93.2');
    expect(summary).toContain('5.4');
  });
});

describe('Factor selection UI', () => {
  it('toggles selection state when factor card is clicked', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    renderAnalysisTab();
    const firstCard = document.querySelector('[data-action="toggle-factor"]');
    firstCard.click();
    renderAnalysisTab();
    const selectedCards = document.querySelectorAll('.factor-select-card.selected');
    expect(selectedCards.length).toBe(1);
    expect(document.getElementById('selectedFactorCount').textContent).toContain('1');
  });

  it('hides result cards and disables run button when all factors are deselected', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    AS.setSelectedFactors(['initial_risk_asset_jpy']);
    const factorPoints = [-2, -1, 1, 2].map(level => makeScenarioPoint(level));
    AS.setAnalysisResult(makeAnalysisResult({
      initial_risk_asset_jpy: factorPoints
    }));
    renderAnalysisTab();
    expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);

    // Deselect the factor (0 selected)
    const card = document.querySelector('[data-factor-key="initial_risk_asset_jpy"]');
    card.click();
    expect(document.getElementById('selectedFactorCount').textContent).toContain('0');
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(true);
    expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(true);
  });
});

describe('Metric toggle after analysis run', () => {
  beforeAll(() => {
    if (window.HTMLElement) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    vi.resetAllMocks();
    runSimulation.mockResolvedValue(makeDummySimResult());
    AS._resetStateForTest();
    _resetDelegationForTest();
    document.body.innerHTML = fixtureHtml;
    setupAnalysisEventDelegation();
    AS.setBaseContext(
      {
        source: 'LAST_MAIN_RUN',
        summary: {
          successRatePct: 93.23,
          finalMedianJpy: 538074816,
          worst10MaxDdPct: -0.8054955005645752,
        },
      },
      makeBaseEffectiveParams()
    );
  });

  it('full flow: select factor, run analysis, show compare table, toggle metric', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);

    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    });
    await waitFor(() => {
      expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(false);
    });
    expect(document.querySelectorAll('.compare-card').length).toBe(1);

    expect(document.getElementById('targetTableBody')).not.toBeNull();
    document.getElementById('targetMetric').value = 'final_p10_jpy';
    document.getElementById('targetMetric').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('targetMetricLabel').textContent).toContain('最終総資産 10%タイル');
  });
});

describe('Target table high success rate and out of range', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runSimulation.mockResolvedValue(makeDummySimResult());
    AS._resetStateForTest();
    _resetDelegationForTest();
    document.body.innerHTML = fixtureHtml;
    setupAnalysisEventDelegation();
    setLanguage('en');
    AS.setBaseContext({}, makeBaseEffectiveParams());
    AS.setSelectedFactors(['expected_return_pct']);
  });

  it('shows successRateHigh when success rate is already at least 95', () => {
    AS.setAnalysisResult({
      baseScenario: { metrics: makeBaseMetrics({ success_rate_pct: 96 }) },
      perFactorResults: {
        expected_return_pct: [-2, -1, 1, 2].map(level => makeScenarioPoint(level)),
      },
    });
    renderAnalysisTab();
    expect(document.getElementById('targetTableWrapper').textContent).toContain(t('analysis.successRateHigh'));
  });

  it('shows outOfRange when the target is outside the factor metric span', () => {
    const sameP10 = 39_342_408;
    AS.setAnalysisResult({
      baseScenario: { metrics: makeBaseMetrics({ success_rate_pct: 80, final_p10_jpy: sameP10 }) },
      perFactorResults: {
        expected_return_pct: [-2, -1, 1, 2].map(level => makeScenarioPoint(level, { final_p10_jpy: sameP10 })),
      },
    });
    document.getElementById('targetMetric').value = 'final_p10_jpy';
    renderAnalysisTab();
    expect(document.getElementById('targetTableWrapper').textContent).toContain(t('analysis.outOfRange'));
  });
});

