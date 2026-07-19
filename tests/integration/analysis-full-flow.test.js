// tests/integration/analysis-full-flow.test.js
// Full flow validation of the analysis tab (alternative to E2E test)
// Vitest 1.6 compatibility: do not use vi.mocked()

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { runSimulation } from '../../js/simulation-engine.js';
import { generateAndDownloadZip } from '../../js/analysis-output.js';
import * as AS from '../../js/analysis-state.js';
import * as AUI from '../../js/analysis-ui.js';
import {
  makeDummySimResult,
  makeBaseEffectiveParams,
} from '../helpers/analysis-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

vi.mock('../../js/simulation-engine.js');
vi.mock('../../js/analysis-output.js');

const fixtureHtml = readFileSync('tests/fixtures/analysis-dom-snippet.html', 'utf-8');

describe('Analysis tab full flow (E2E alternative)', () => {
  // jsdom compatibility: mock scrollIntoView
  // Since jsdom does not have a native implementation, there is no need to restore the original function.
  beforeAll(() => {
    if (window.HTMLElement) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    vi.resetAllMocks();
    runSimulation.mockResolvedValue(makeDummySimResult());
    generateAndDownloadZip.mockResolvedValue(undefined);
    AS._resetStateForTest();
    AUI._resetDelegationForTest();
    document.body.innerHTML = fixtureHtml;
    // Since the fixture HTML contains id="analysisTab",
    // setupAnalysisEventDelegation() will work properly
    AUI.setupAnalysisEventDelegation();
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

  it('full flow: select factor, run analysis, show compare table, ZIP output, toggle metric', async () => {
    // Step 1: Select factor
    AS.setSelectedFactors(['expected_return_pct']);
    AUI.renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);

    // Step 2: Run analysis
    document.getElementById('runAnalysisBtn').click();

    // Wait until both target table and comparison table are displayed
    // It completes in a short time because runSimulation is immediately resolved by the mock
    await waitFor(() => {
      expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    });
    await waitFor(() => {
      expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(false);
    });
    expect(document.querySelectorAll('.compare-card').length).toBe(1);

    // Step 3: ZIP output button is enabled
    expect(document.getElementById('exportZipBtn').disabled).toBe(false);

    // Step 4: Run ZIP output
    // Note: In the actual generateAndDownloadZip, the button text is restored after 2 seconds,
    // but this test only verifies the call and does not wait for the restoration to complete.
    document.getElementById('exportZipBtn').click();
    await waitFor(() => {
      expect(generateAndDownloadZip).toHaveBeenCalledTimes(1);
    });

    // Step 5: Metric switching (after verifying targetTableBody exists)
    expect(document.getElementById('targetTableBody')).not.toBeNull();
    document.getElementById('targetMetric').value = 'final_p10_jpy';
    document.getElementById('targetMetric').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('targetMetricLabel').textContent).toContain('最終総資産 10%タイル');
  });
});
