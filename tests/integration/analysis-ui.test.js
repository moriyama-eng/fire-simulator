import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAnalysisTab, setupAnalysisEventDelegation, _resetDelegationForTest } from '../../js/analysis-ui.js';
import * as AS from '../../js/analysis-state.js';
import { setLanguage, t } from '../../js/i18n.js';

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

// DOMのセットアップを模倣
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
            <button id="exportZipBtn"></button>
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
});
