// tests/integration/analysis-ui.test.js
// 【Vitest 1.6 互換性】vi.mocked() は使用禁止、mockFn のプロパティに直接アクセスすること
// 【重要】vi.mock はホイスティングされる。動的importのモックを確実にするためトップレベルで import する
// 【最重要】beforeEach で vi.resetAllMocks() を使用し、mockRejectedValueOnce の残存カウンタを完全に除去する
// 【重要】renderAnalysisTab() 後は DOM が再構築されるため、要素を再取得すること
// 【重要】ターゲットテーブルのメトリック切替テストでは perFactorResults を明示的に設定すること

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import * as AS from '../../js/analysis-state.js';
import {
  renderAnalysisTab,
  setupAnalysisEventDelegation,
  _resetDelegationForTest,
} from '../../js/analysis-ui.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { generateAndDownloadZip } from '../../js/analysis-output.js';
import {
  makeDummySimResult,
  makeAnalysisResult,
  makeScenarioPoint,
  makeBaseEffectiveParams,
} from '../helpers/analysis-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

vi.mock('../../js/simulation-engine.js');
vi.mock('../../js/analysis-output.js');

let fixtureHtml;
beforeAll(() => {
  fixtureHtml = readFileSync('tests/fixtures/analysis-dom-snippet.html', 'utf-8');
});

beforeEach(async () => {
  // 【最重要】vi.resetAllMocks() でデフォルト実装・Once残存カウンタを含む全モック状態を完全リセット
  vi.resetAllMocks();
  // リセット後に必要なデフォルト実装を再設定
  runSimulation.mockResolvedValue(makeDummySimResult());
  generateAndDownloadZip.mockResolvedValue(undefined);

  AS._resetStateForTest();
  _resetDelegationForTest();
  document.body.innerHTML = fixtureHtml;

  AS.setBaseContext(
    {
      source: 'LAST_MAIN_RUN',
      summary: {
        successRatePct: 93.23,
        finalMedianJpy: 538074816,
        worst10MaxDdPct: -0.8054955005645752
      }
    },
    makeBaseEffectiveParams()
  );
  setupAnalysisEventDelegation();
});

// ================================================================
// 初期表示
// ================================================================
describe('初期表示', () => {
  it('ベース条件未設定時はプレースホルダを表示する', () => {
    AS._resetStateForTest();
    renderAnalysisTab();
    expect(document.getElementById('card1Summary').textContent).toContain('主画面でシミュレーションを実行してください');
  });

  it('因子セレクターが利用可能な因子を表示する', () => {
    renderAnalysisTab();
    expect(document.querySelectorAll('#factorSelector .factor-select-card').length).toBeGreaterThan(0);
  });

  it('選択因子数が 0 と表示される', () => {
    renderAnalysisTab();
    expect(document.getElementById('selectedFactorCount').textContent).toContain('選択中: 0因子');
  });

  it('シナリオ数が 1 と表示される', () => {
    renderAnalysisTab();
    expect(document.getElementById('scenarioCount').textContent).toBe('1');
  });

  it('実行時間見積り要素が存在する', () => {
    renderAnalysisTab();
    expect(document.getElementById('estTime')).not.toBeNull();
  });

  it('分析実行ボタンは因子未選択のため無効', () => {
    renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(true);
  });

  it('ZIP出力ボタンは分析結果なしのため無効', () => {
    renderAnalysisTab();
    expect(document.getElementById('exportZipBtn').disabled).toBe(true);
  });

  it('エラー表示は非表示', () => {
    renderAnalysisTab();
    expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(true);
  });
});

// ================================================================
// 基準シナリオカード
// ================================================================
describe('基準シナリオカード', () => {
  it('分析結果がある場合、基準シナリオの KPI を表示する', () => {
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    const summary = document.getElementById('card1Summary').textContent;
    expect(summary).toContain('93.2');
    expect(summary).toMatch(/5\.4/);
  });

  it('分析結果がなくてもベース条件があれば、直近のシミュレーション KPI を表示する', () => {
    renderAnalysisTab();
    const summary = document.getElementById('card1Summary').textContent;
    expect(summary).toContain('93.2');
  });

  it('条件詳細が表示される', () => {
    renderAnalysisTab();
    const detail = document.getElementById('card1Detail');
    expect(detail.classList.contains('hidden')).toBe(false);
    expect(detail.textContent).toContain('初期リスク資産');
    expect(detail.textContent).toContain('期待リターン');
  });
});

// ================================================================
// 因子選択 UI
// ================================================================
describe('因子選択 UI', () => {
  it('因子カードをクリックすると選択状態がトグルする', () => {
    renderAnalysisTab();
    const firstCard = document.querySelector('[data-action="toggle-factor"]');
    firstCard.click();
    renderAnalysisTab();
    const selectedCards = document.querySelectorAll('.factor-select-card.selected');
    expect(selectedCards.length).toBe(1);
    expect(document.getElementById('selectedFactorCount').textContent).toContain('選択中: 1因子');

    document.querySelector('[data-action="toggle-factor"]').click();
    renderAnalysisTab();
    expect(document.querySelectorAll('.factor-select-card.selected').length).toBe(0);
    expect(document.getElementById('selectedFactorCount').textContent).toContain('選択中: 0因子');
  });

  it('因子選択で実行ボタンが有効化される', () => {
    renderAnalysisTab();
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);
  });

  it('因子全解除で実行ボタンが再び無効化される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);
    AS.setSelectedFactors([]);
    renderAnalysisTab();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(true);
  });

  it('CB オフ時、現金バッファ因子がセレクターに表示されない', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: false }));
    renderAnalysisTab();
    const keys = Array.from(document.querySelectorAll('[data-factor-key]')).map(el => el.dataset.factorKey);
    expect(keys).not.toContain('drawdown_trigger_pct');
    expect(keys).not.toContain('replenish_pace_x_expense');
  });

  it('GR オフ時、ガードレール因子がセレクターに表示されない', () => {
    AS.setBaseContext({}, makeBaseEffectiveParams({ guardrailToggle: false }));
    renderAnalysisTab();
    const keys = Array.from(document.querySelectorAll('[data-factor-key]')).map(el => el.dataset.factorKey);
    expect(keys).not.toContain('guardrail_trigger_pct');
    expect(keys).not.toContain('guardrail_reduction_pct');
  });

  it('選択済み因子はアコーディオンが展開され、水準値が表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    const card = document.querySelector('.factor-select-card.selected');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('基準');
    expect(card.textContent).toContain('8.0');
    expect(card.textContent).toContain('12.0');
  });
});

// ================================================================
// 分析実行フロー
// ================================================================
describe('分析実行フロー', () => {
  it('実行ボタンクリックで進捗表示に切り替わる', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(makeDummySimResult()), 500)));
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('runAnalysisBtn').textContent).toContain('分析を実行中...');
    });

    await waitFor(() => {
      expect(document.getElementById('runAnalysisBtn').textContent).toBe('分析を実行');
    });
  });

  it('分析完了後、ターゲットテーブルが表示される', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    });
    expect(document.getElementById('targetTableBody').textContent).toContain('この因子の範囲では改善後の指標値に届きません。');
  });

  it('分析完了後、比較表が表示される', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('cardCompare').classList.contains('hidden')).toBe(false);
    });
    expect(document.querySelectorAll('.compare-card').length).toBe(1);
  });

  it('実行中はボタンが無効化される', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(makeDummySimResult()), 500)));
    document.getElementById('runAnalysisBtn').click();
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(true);

    await waitFor(() => {
      expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);
    });
  });

  it('二重クリックが防止される', () => {
    AS.setRunning(true);
    document.getElementById('runAnalysisBtn').click();
    expect(runSimulation).not.toHaveBeenCalled();
  });

  it('分析完了後、cardTarget に対して scrollIntoView が呼ばれる', async () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(vi.fn());
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('cardTarget').classList.contains('hidden')).toBe(false);
    });

    // CI環境の負荷を考慮し、setTimeout 100ms + 描画待ちに十分なタイムアウトを確保
    await waitFor(() => {
      const cardTarget = document.getElementById('cardTarget');
      const calledOnCardTarget = scrollSpy.mock.instances.some(instance => instance === cardTarget);
      expect(calledOnCardTarget).toBe(true);
    }, { timeout: 5000 });

    scrollSpy.mockRestore();
  });
});

// ================================================================
// ターゲットテーブル
// ================================================================
describe('ターゲットテーブル', () => {
  it('成功率95%以上の場合、専用メッセージが表示される', () => {
    const mockResult = makeAnalysisResult();
    mockResult.baseScenario.metrics.success_rate_pct = 95.5;
    AS.setAnalysisResult(mockResult);
    renderAnalysisTab();
    expect(document.getElementById('targetTableWrapper').textContent).toContain(
      'FIRE成功率は95%以上であり既に十分高いため、改善対象外です。'
    );
  });

  it('成功率93.23%の場合、目標94.23%への5水準線形補間が行われ、値が正しく表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2, { success_rate_pct: 85.13 }),
        makeScenarioPoint(-1, { success_rate_pct: 90.01 }),
        makeScenarioPoint(1,  { success_rate_pct: 95.70 }),
        makeScenarioPoint(2,  { success_rate_pct: 97.43 }),
      ]
    };
    const mockResult = makeAnalysisResult(perFactorResults);
    mockResult.baseScenario.metrics.success_rate_pct = 93.23;
    AS.setAnalysisResult(mockResult);
    renderAnalysisTab();

    const firstRow = document.querySelector('#targetTableBody tr:first-child');
    const deltaCell = firstRow.querySelector('td:nth-child(3)');
    const afterCell = firstRow.querySelector('td:nth-child(4)');
    expect(deltaCell).not.toBeNull();
    expect(afterCell).not.toBeNull();

    expect(deltaCell.textContent).toMatch(/\+0\.4\s*%/);
    expect(afterCell.textContent).toMatch(/10\.4\s*%/);
  });

  it('目標値が全水準の範囲外の場合、「届きません」メッセージが表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2, { success_rate_pct: 60.0 }),
        makeScenarioPoint(-1, { success_rate_pct: 65.0 }),
        makeScenarioPoint(1,  { success_rate_pct: 68.0 }),
        makeScenarioPoint(2,  { success_rate_pct: 70.0 }),
      ]
    };
    const mockResult = makeAnalysisResult(perFactorResults);
    mockResult.baseScenario.metrics.success_rate_pct = 80.0;
    AS.setAnalysisResult(mockResult);
    renderAnalysisTab();
    expect(document.getElementById('targetTableBody').textContent).toContain(
      'この因子の範囲では改善後の指標値に届きません。'
    );
  });

  it('メトリックを最終総資産 10%タイルに切り替えるとラベルが更新され、テーブル本体が表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    // 【重要】perFactorResults を明示的に設定しないとテーブルが空になる
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2, { final_p10_jpy: 20000000 }),
        makeScenarioPoint(-1, { final_p10_jpy: 30000000 }),
        makeScenarioPoint(1,  { final_p10_jpy: 50000000 }),
        makeScenarioPoint(2,  { final_p10_jpy: 60000000 }),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    document.getElementById('targetMetric').value = 'final_p10_jpy';
    document.getElementById('targetMetric').dispatchEvent(new Event('change'));
    renderAnalysisTab();
    expect(document.getElementById('targetMetricLabel').textContent).toContain('最終総資産 10%タイル');
    const bodyText = document.getElementById('targetTableBody').textContent;
    expect(bodyText.length).toBeGreaterThan(0);
  });

  it('メトリックを最大DDに切り替えられ、テーブルが表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    // 【重要】perFactorResults を明示的に設定しないとテーブルが空になる
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2, { worst10_max_dd: -0.90 }),
        makeScenarioPoint(-1, { worst10_max_dd: -0.85 }),
        makeScenarioPoint(1,  { worst10_max_dd: -0.75 }),
        makeScenarioPoint(2,  { worst10_max_dd: -0.70 }),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    document.getElementById('targetMetric').value = 'worst10_max_dd';
    document.getElementById('targetMetric').dispatchEvent(new Event('change'));
    renderAnalysisTab();
    expect(document.getElementById('targetMetricLabel').textContent).toContain('最大DD 10%タイル');
    const bodyText = document.getElementById('targetTableBody').textContent;
    expect(bodyText.length).toBeGreaterThan(0);
  });

  it('因子全解除時、ターゲットテーブルは「因子を選択してください」を表示する', () => {
    AS.setSelectedFactors([]);
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    expect(document.getElementById('targetTableBody').textContent).toContain('因子を選択してください');
  });
});

// ================================================================
// 因子別比較表
// ================================================================
describe('因子別比較表', () => {
  it('選択因子ごとに比較カードが1つ生成される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2), makeScenarioPoint(-1),
        makeScenarioPoint(1),  makeScenarioPoint(2),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    expect(document.querySelectorAll('.compare-card').length).toBe(1);
  });

  it('各比較カードは5行を持つ', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2), makeScenarioPoint(-1),
        makeScenarioPoint(1),  makeScenarioPoint(2),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    expect(document.querySelectorAll('.compare-row').length).toBe(5);
  });

  it('基準行に「基準」バッジが表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2), makeScenarioPoint(-1),
        makeScenarioPoint(1),  makeScenarioPoint(2),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    const rows = document.querySelectorAll('.compare-row');
    expect(rows[2].textContent).toContain('基準');
  });

  it('凡例が表示される', () => {
    AS.setSelectedFactors(['expected_return_pct']);
    const perFactorResults = {
      expected_return_pct: [
        makeScenarioPoint(-2), makeScenarioPoint(-1),
        makeScenarioPoint(1),  makeScenarioPoint(2),
      ]
    };
    AS.setAnalysisResult(makeAnalysisResult(perFactorResults));
    renderAnalysisTab();
    const legend = document.querySelector('.compare-legend');
    expect(legend).not.toBeNull();
    expect(legend.querySelector('.legend-swatch.positive')).not.toBeNull();
    expect(legend.querySelector('.legend-swatch.base')).not.toBeNull();
    expect(legend.querySelector('.legend-swatch.negative')).not.toBeNull();
  });

  it('因子全解除時、比較表コンテナに「因子を選択してください」が表示される', () => {
    AS.setSelectedFactors([]);
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    expect(document.getElementById('compareCardsContainer').textContent).toContain('因子を選択してください');
  });
});

// ================================================================
// ZIP 出力ボタン
// ================================================================
describe('ZIP 出力ボタン', () => {
  it('分析結果がない場合、ボタンは無効', () => {
    AS._resetStateForTest();
    renderAnalysisTab();
    expect(document.getElementById('exportZipBtn').disabled).toBe(true);
  });

  it('分析結果がある場合、ボタンは有効', () => {
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    expect(document.getElementById('exportZipBtn').disabled).toBe(false);
  });

  it('ZIP ボタンクリックで generateAndDownloadZip が呼ばれる', async () => {
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    document.getElementById('exportZipBtn').click();
    await waitFor(() => {
      expect(generateAndDownloadZip).toHaveBeenCalledTimes(1);
    });
  });

  it('ZIP ダウンロード中はボタンが無効化され、テキストが変化し、完了後に元のテキストに復帰する', async () => {
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    generateAndDownloadZip.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));
    const btn = document.getElementById('exportZipBtn');
    const originalHTML = btn.innerHTML;
    btn.click();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('ZIP生成中');

    await waitFor(() => {
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe(originalHTML);
    }, { timeout: 8000 });
  });

  it('ZIP ダウンロード失敗時、alert が表示されボタンが再有効化される', async () => {
    AS.setAnalysisResult(makeAnalysisResult());
    renderAnalysisTab();
    generateAndDownloadZip.mockRejectedValue(new Error('fail'));
    // 【重要】window.alert が未定義の可能性があるため、スパイ作成前に必ず初期化する
    const wasUndefined = typeof window.alert === 'undefined';
    if (wasUndefined) window.alert = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const btn = document.getElementById('exportZipBtn');
    const originalHTML = btn.innerHTML;
    btn.click();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('fail'));
    });
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe(originalHTML);
    alertSpy.mockRestore();
    if (wasUndefined) delete window.alert;
    // 【注意】beforeEach で vi.resetAllMocks() が呼ばれるため、
    // generateAndDownloadZip のモック状態も完全にリセットされる。
    // ただし、このテスト内で後続のアサーションがある場合は明示的な再設定が必要。
  });
});

// ================================================================
// エラー処理
// ================================================================
describe('エラー処理', () => {
  it('分析実行エラー時、エラーメッセージが表示される', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockRejectedValue(new Error('sim error'));
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(false);
    });
    expect(document.getElementById('analysisError').textContent).toContain('sim error');
    // 【注意】beforeEach で vi.resetAllMocks() を使用するため、以下の後始末は不要
  });

  it('エラー後も実行ボタンは再有効化される', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockRejectedValue(new Error('sim error'));
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(false);
    });
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);
  });

  it('エラー後、別の因子で再実行するとエラー表示が消える', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockRejectedValue(new Error('sim error'));
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(false);
    });

    AS.setSelectedFactors(['volatility_pct']);
    runSimulation.mockResolvedValue(makeDummySimResult());
    renderAnalysisTab();
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(true);
    });
  });

  it('エラー後、同一因子で再実行に成功するとエラー表示が消える', async () => {
    AS.setSelectedFactors(['expected_return_pct']);
    renderAnalysisTab();
    runSimulation.mockRejectedValueOnce(new Error('sim error'));
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(false);
    });

    runSimulation.mockResolvedValue(makeDummySimResult());
    document.getElementById('runAnalysisBtn').click();

    await waitFor(() => {
      expect(document.getElementById('analysisError').classList.contains('hidden')).toBe(true);
    });
    expect(document.getElementById('runAnalysisBtn').disabled).toBe(false);
    // 【注意】beforeEach の vi.resetAllMocks() により、mockRejectedValueOnce の
    // 残存カウンタは次のテスト実行前に完全に除去されるため、後始末は不要。
  });
});

// ================================================================
// 編集ボタン
// ================================================================
describe('「シミュレーションタブで条件を編集」ボタン', () => {
  it('クリックで simTabBtn のクリックイベントが発火する', () => {
    renderAnalysisTab();
    const simTabBtn = document.getElementById('simTabBtn');
    expect(simTabBtn).not.toBeNull();
    const clickSpy = vi.spyOn(simTabBtn, 'click');
    document.getElementById('card1EditBtn').click();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
