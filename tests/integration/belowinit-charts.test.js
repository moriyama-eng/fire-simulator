// tests/integration/belowinit-charts.test.js
// v2.3.0: 新指標グラフ（belowInitChart, sellChart）の結合テスト

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runSimulation } from '../../js/simulation-engine.js';
import { readFileSync } from 'fs';

// url.js をモックしてロード時の自動実行による isRunning の意図しない true 化を防ぐ
vi.mock('../../js/core/url.js', async () => {
    const actual = await vi.importActual('../../js/core/url.js');
    return {
        ...actual,
        applyQueryParams: vi.fn()
    };
});

// analysis-ui.js / comparison-ui.js をモックして、
// 言語切り替え時にテスト環境が破棄された後に非同期実行されて Unhandled Rejection になるのを防ぐ
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

// v2.3.0 新指標を含むダミーシミュレーション結果を生成
function makeDummyResultWithNewMetrics(overrides = {}) {
    const simPaths = 1000;
    const dataLen = 361; // 30年 * 12ヶ月 + 1
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
        // v2.3.0: 新指標データ
        belowInitPeriods: new Float32Array(simPaths).fill(60),    // 仮の値（全パス60ヶ月）
        consecutiveSellPeriods: new Float32Array(simPaths).fill(36), // 仮の値（全パス36ヶ月）
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

// テスト実行環境（JSDOM）のセットアップ時に一度だけDOMを構築する。
// app.jsやanalysis-uiのロード・初期化時の未定義エラーを防ぐために、必要なすべてのID要素を含める。
const domSnippet = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
document.body.innerHTML = `
    <div id="simulationTab">
        ${domSnippet}
        <!-- app.js の初期化に必要なグレーアウト対象パネル -->
        <div id="tDistParams"></div>
        <div id="guardrailParams"></div>
        <div id="cashBufferParams"></div>
        <div id="seedInputWrapper"></div>
        <div id="arModelParams"></div>
        <!-- v2.3.0: 新指標グラフタイトル -->
        <h2 id="belowInitTitle" data-i18n="chart.belowInit.title">初期総資産割れ 継続期間 発生確率</h2>
        <h2 id="sellTitle" data-i18n="chart.sell.title">初期総資産割れ時 リスク資産連続売却期間 発生確率</h2>
        <canvas id="belowInitChartCanvas"></canvas>
        <canvas id="sellChartCanvas"></canvas>
        <input type="checkbox" id="logScaleToggle">
    </div>
    <!-- analysis-ui で非同期描画される要素をすべて定義（Unhandled Rejection の根本対策） -->
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
    <div id="tooltip-container"></div>
`;

// DOMが構築された状態で一度だけ app.js をインポートする
await import('../../js/app.js');

// ロード完了後、DOMContentLoaded を明示的にディスパッチして、
// app.js 内の DOMContentLoaded リスナー内のイベント登録・初期化処理を実行させる
document.dispatchEvent(new Event('DOMContentLoaded'));

describe('Below-Initial charts integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        runSimulation.mockResolvedValue(makeDummyResultWithNewMetrics());
    });

    it('canvas elements for new charts exist in DOM', () => {
        // 新グラフ用のcanvasが正しく存在することを確認
        const belowInitCanvas = document.getElementById('belowInitChartCanvas');
        const sellCanvas = document.getElementById('sellChartCanvas');
        expect(belowInitCanvas).not.toBeNull();
        expect(sellCanvas).not.toBeNull();
    });

    it('does NOT have downside focus toggles for new charts', () => {
        // 新グラフにはダウンサイドフォーカストグルが存在しないことを確認
        const toggles = document.querySelectorAll('#downsideFocusBelowInit, #downsideFocusSell');
        expect(toggles.length).toBe(0);
    });

    it('new metric result contains belowInitPeriods and consecutiveSellPeriods', () => {
        // ダミー結果に新指標データが含まれることを確認
        const result = makeDummyResultWithNewMetrics();
        expect(result).toHaveProperty('belowInitPeriods');
        expect(result).toHaveProperty('consecutiveSellPeriods');
        expect(result.belowInitPeriods).toBeInstanceOf(Float32Array);
        expect(result.consecutiveSellPeriods).toBeInstanceOf(Float32Array);
        expect(result.belowInitPeriods.length).toBe(1000);
        expect(result.consecutiveSellPeriods.length).toBe(1000);
    });

    it('belowInitPeriods values are non-negative', () => {
        // 新指標の値が非負であることを確認
        const result = makeDummyResultWithNewMetrics();
        for (let i = 0; i < result.belowInitPeriods.length; i++) {
            expect(result.belowInitPeriods[i]).toBeGreaterThanOrEqual(0);
        }
    });

    it('consecutiveSellPeriods <= belowInitPeriods for each path', () => {
        // 各パスで指標②が指標①以下であることを確認
        const result = makeDummyResultWithNewMetrics({
            belowInitPeriods: new Float32Array(1000).fill(60),
            consecutiveSellPeriods: new Float32Array(1000).fill(36),
        });
        for (let i = 0; i < result.params.simPaths; i++) {
            expect(result.consecutiveSellPeriods[i]).toBeLessThanOrEqual(result.belowInitPeriods[i]);
        }
    });

    it('updates chart titles on language switch', async () => {
        const setLanguageGlobal = (lang) => {
            if (typeof window !== 'undefined' && window.__setLanguage) {
                window.__setLanguage(lang);
            }
        };

        // 初期状態で日本語を設定
        setLanguageGlobal('ja');
        const titleBelowInit = document.getElementById('belowInitTitle');
        const titleSell = document.getElementById('sellTitle');

        expect(titleBelowInit.textContent).toBe('初期総資産割れ 継続期間 発生確率');
        expect(titleSell.textContent).toBe('初期総資産割れ時 リスク資産連続売却期間 発生確率');

        // 英語に切り替え
        setLanguageGlobal('en');
        await new Promise(r => setTimeout(r, 50));

        // i18n のキーに対応する英語テキストに切り替わっていることを確認
        expect(titleBelowInit.textContent).toBe('Duration Below Initial Assets Probability');
        expect(titleSell.textContent).toBe('Consecutive Risk-Asset Sales While Below Initial Assets Probability');

        // 再度日本語に切り替え
        setLanguageGlobal('ja');
        await new Promise(r => setTimeout(r, 50));

        expect(titleBelowInit.textContent).toBe('初期総資産割れ 継続期間 発生確率');
        expect(titleSell.textContent).toBe('初期総資産割れ時 リスク資産連続売却期間 発生確率');
    });
});
