// tests/integration/analysis-full-flow.test.js
// 分析タブの完全フロー検証（E2Eテストの代替）
// Vitest 1.6互換: vi.mocked()不使用

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
  // jsdom 互換性: scrollIntoView をモック
  // jsdom にはネイティブ実装がないため、元の関数への復元は不要です。
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
    // フィクスチャHTMLには id="analysisTab" が含まれているため、
    // setupAnalysisEventDelegation() は正常に動作します
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
    // Step 1: 因子選択
    AS.setSelectedFactors(['expected_return_pct']);
    AUI.renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);

    // Step 2: 分析実行
    document.getElementById('runAnalysisBtn').click();

    // ターゲットテーブルと比較表の両方が表示されるまで待機
    // runSimulation がモックで即時解決されるため、短時間で完了します
    await waitFor(() => {
      expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    });
    await waitFor(() => {
      expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(false);
    });
    expect(document.querySelectorAll('.compare-card').length).toBe(1);

    // Step 3: ZIP出力ボタンが有効
    expect(document.getElementById('exportZipBtn').disabled).toBe(false);

    // Step 4: ZIP出力実行
    // 注: 実際のgenerateAndDownloadZip内では2秒後にボタン文言が復元されますが、
    // このテストでは呼び出しの確認のみを行い、文言復元の完了は待ちません。
    document.getElementById('exportZipBtn').click();
    await waitFor(() => {
      expect(generateAndDownloadZip).toHaveBeenCalledTimes(1);
    });

    // Step 5: メトリック切替（targetTableBody が存在することを確認してから）
    expect(document.getElementById('targetTableBody')).not.toBeNull();
    document.getElementById('targetMetric').value = 'final_p10_jpy';
    document.getElementById('targetMetric').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('targetMetricLabel').textContent).toContain('最終総資産 10%タイル');
  });
});
