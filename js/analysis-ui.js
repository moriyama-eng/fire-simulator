// js/analysis-ui.js
// 分析タブ v2.0.0 UI 制御

import * as AS from './analysis-state.js';
import { setProgressCallback, getProgressCallback } from './simulation-engine.js';

// ====================================================================
// メインレンダリング
// ====================================================================
export function renderAnalysisTab() {
    renderBaseCard();

    // エラーメッセージの表示/非表示（#3）
    const errorEl = document.getElementById('analysisError');
    const errMsg = AS.getErrorMessage();
    if (errorEl) {
        if (errMsg) {
            errorEl.textContent = errMsg;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    }

    renderFactorSelector();
    renderTargetTable();

    // ZIP出力ボタンの有効/無効制御
    const exportBtn = document.getElementById('exportZipBtn');
    if (exportBtn) {
        exportBtn.disabled = !AS.getAnalysisResult();
    }

    renderCompareCards();
}

// ====================================================================
// カード1: 基準シナリオ
// ====================================================================
function renderBaseCard() {
    const bp = AS.getBaseEffectiveParams();
    if (!bp) {
        document.getElementById('card1Summary').innerHTML = '<p class="text-slate-500 text-sm">主画面でシミュレーションを実行してください</p>';
        const detailEl = document.getElementById('card1Detail');
        if (detailEl) detailEl.classList.add('hidden');
        return;
    }

    // --- KPI サマリ (分析結果または直近のシミュレーションから) ---
    let kpiHtml = '';
    const result = AS.getAnalysisResult();
    if (result && result.baseScenario && result.baseScenario.metrics) {
        const m = result.baseScenario.metrics;
        kpiHtml = `
        <div class="pt-1">
             <p>FIRE成功率 <span class="font-bold text-emerald-400">${m.success_rate_pct.toFixed(1)}%</span></p>
             <p>最終総資産 中央値 <span class="font-bold text-blue-300">${(m.final_median_jpy / 1e8).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円</span></p>
         </div>`;
    } else {
        // 分析未実行 → baseContext から直近のシミュレーションKPIを表示
        const ctx = AS.getState().baseContext;
        if (ctx && ctx.summary) {
            const s = ctx.summary;
            kpiHtml = `
            <div class="pt-1">
                <p>FIRE成功率 <span class="font-bold text-emerald-400">${s.successRatePct.toFixed(1)}%</span></p>
                <p>最終総資産 中央値 <span class="font-bold text-blue-300">${(s.finalMedianJpy / 1e8).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円</span></p>
            </div>`;
        } else {
            kpiHtml = '<p class="text-slate-500 text-sm">主画面でシミュレーションを実行してください</p>';
        }
    }

    // --- 条件一覧 (常に表示) ---
    const detailHtml = `
        <div class="space-y-1">
            <p>初期リスク資産: ${(bp.initialRiskAsset / 1e8).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 億円</p>
            <p>初期現金バッファ: ${bp.cashBufferToggle ? (bp.initialCashBuffer / 1e4).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '万円' : 'OFF'}</p>
            <p>初期月間取崩し額: ${(bp.monthlyExpense / 1e4).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 万円</p>
            <p>期待リターン / ボラティリティ: ${bp.expectedReturn.toFixed(1)}% / ${bp.volatility.toFixed(1)}%</p>
            <p>インフレ率: ${bp.inflationRate.toFixed(1)}%</p>
            <p>シミュレーション設定: ${bp.simYears} 年 / ${bp.simPaths.toLocaleString('ja-JP')} 回</p>
            <p>変動モデル: ${bp.modelType === 'log-t' ? '対数t分布' : '対数正規分布'}</p>
            <p>現金バッファ: ${bp.cashBufferToggle ? 'ON' : 'OFF'} | ガードレール: ${bp.guardrailToggle ? 'ON' : 'OFF'}</p>
            <p>乱数シード値: ${bp.seed}</p>
        </div>
     `;

    document.getElementById('card1Summary').innerHTML = kpiHtml;
    const detailEl = document.getElementById('card1Detail');
    if (detailEl) {
        detailEl.innerHTML = detailHtml;
        detailEl.classList.remove('hidden');
    }
}

// ====================================================================
// 因子セレクター
// ====================================================================
function renderFactorSelector() {
    const container = document.getElementById('factorSelector');
    const selected = AS.getSelectedFactors();
    const available = AS.getAvailableFactors();
    document.getElementById('selectedFactorCount').textContent = `選択中: ${selected.length}因子`;
    document.getElementById('scenarioCount').textContent = AS.getScenarioCount();
    document.getElementById('runAnalysisBtn').disabled = selected.length === 0 || AS.getState().isRunning;

    // 実行時間見積もりの動的更新（#5）
    const bp = AS.getBaseEffectiveParams();
    if (bp) {
        const totalScenarios = AS.getScenarioCount();
        const paths = bp.simPaths || 10000;
        const years = bp.simYears || 30;
        let estMs = 0;
        if (window.lastSimOnlyMs) {
            // lastSimOnlyMs は現在のパス数・年数・モデルでの実測値
            // 全シナリオは同一条件で実行されるため、単純にシナリオ数を掛ければよい
            estMs = window.lastSimOnlyMs * totalScenarios;
        } else {
            // 実測値がない場合のフォールバック
            estMs = (paths * years) / (10000 * 30) * 350 * totalScenarios;
        }
        document.getElementById('estTime').textContent = Math.ceil(estMs / 1000);
    } else {
        document.getElementById('estTime').textContent = '-';
    }

    let html = '';
    for (const f of available) {
        const isSel = selected.includes(f.key);
        html += `
        <div class="glass-card rounded-xl border border-slate-700/30 factor-select-card ${f.catClass} ${isSel ? 'selected ring-1 ring-indigo-500/50' : ''}">
            <div class="p-3 flex items-center justify-between cursor-pointer" data-action="toggle-factor" data-factor-key="${f.key}">
                <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-slate-200 truncate">${f.label}</span>
                    <span class="text-xs text-slate-400 block mt-0.5">基準: ${fmtFactorVal(f, AS.getFactorBaseValue(f.key))} ${f.unit}</span>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <span class="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">${f.category}</span>
                    <span class="text-xs">${isSel ? '▲' : '▶'}</span>
                </div>
            </div>
            ${isSel ? renderAccordionBody(f) : ''}
        </div>`;
    }
    container.innerHTML = html;
}

function renderAccordionBody(factor) {
    const values = AS.getGeneratedValues(factor.key);
    if (!values) return '';
    return `
    <div class="border-t border-slate-700/50 px-3 py-3 bg-slate-900/30">
        <div class="flex gap-2 flex-wrap">
            ${values.map((v, i) => {
        const isBase = i === 2;
        return `<span class="text-xs ${isBase ? 'bg-indigo-900/40 text-indigo-300 font-bold' : 'bg-slate-700/80 text-slate-300'} px-2 py-1 rounded">${fmtFactorVal(factor, v)}${isBase ? ' (基準)' : ''}</span>`;
    }).join('')}
        </div>
    </div>`;
}

function fmtFactorVal(factor, value) {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('ja-JP', {
        minimumFractionDigits: factor.decimals,
        maximumFractionDigits: factor.decimals
    });
}

// ====================================================================
// ターゲットテーブル（改善因子変動量）
// ====================================================================
function renderTargetTable() {
    const card = document.getElementById('cardTarget');
    const result = AS.getAnalysisResult();
    if (!result || !result.baseScenario) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    const baseMetrics = result.baseScenario.metrics;
    const metric = document.getElementById('targetMetric').value;

    // 成功率改善幅を計算し、セレクトボックスの表示を更新
    const successRateDelta = AS.getSuccessRateTargetDelta(baseMetrics.success_rate_pct);
    const targetMetricOptionSuccess = document.getElementById('targetMetricOptionSuccess');
    if (targetMetricOptionSuccess && successRateDelta > 0) {
        targetMetricOptionSuccess.textContent = `FIRE成功率 改善 +${successRateDelta.toFixed(0)}%pt`;
    }

    // FIRE成功率95%以上かつ指標が成功率の場合
    if (metric === 'success_rate_pct' && baseMetrics.success_rate_pct >= 95) {
        document.getElementById('targetTableWrapper').innerHTML = '<p class="text-center text-slate-400 py-6">FIRE成功率は95%以上であり既に十分高いため、改善対象外です。</p>';
        document.getElementById('targetMetricLabel').textContent = 'FIRE成功率';
        document.getElementById('currentMetricValue').textContent = baseMetrics.success_rate_pct.toFixed(1) + '%';
        return;
    }

    // 通常の表を表示
    document.getElementById('targetTableWrapper').innerHTML = `
        <table class="target-table text-sm" id="targetTable">
            <colgroup>
                <col class="col-factor">
                <col class="col-curr">
                <col class="col-need">
                <col class="col-after">
                <col class="col-dummy">
            </colgroup>
            <thead>
                <tr>
                    <th class="p-2 text-xs text-slate-400 text-center">因子</th>
                    <th class="p-2 text-right text-xs text-slate-400">現在値</th>
                    <th class="p-2 text-right text-xs text-slate-400">必要な変更量</th>
                    <th class="p-2 text-right text-xs text-slate-400">変更後の値</th>
                    <th class="p-2"></th>
                </tr>
            </thead>
            <tbody id="targetTableBody"></tbody>
        </table>
    `;

    updateTargetTableContent(baseMetrics, result.perFactorResults);
}

function updateTargetTableContent(baseMetrics, perFactorResults) {
    const metric = document.getElementById('targetMetric').value;
    const labels = {
        success_rate_pct: 'FIRE成功率',
        final_p10_jpy: '最終総資産 10%タイル',
        worst10_max_dd: '最大DD 10%タイル'
    };
    const displayFns = {
        success_rate_pct: v => v.toFixed(1) + '%',
        final_p10_jpy: v => (v / 1e8).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '億円',
        worst10_max_dd: v => (v * 100).toFixed(1) + '%'
    };
    document.getElementById('targetMetricLabel').textContent = labels[metric];
    document.getElementById('currentMetricValue').textContent = displayFns[metric](baseMetrics[metric]);

    // 動的改善幅の計算
    const deltas = {
        success_rate_pct: AS.getSuccessRateTargetDelta(baseMetrics.success_rate_pct),
        final_p10_jpy: 20_000_000,
        worst10_max_dd: 0.05
    };

    const targetValue = baseMetrics[metric] + deltas[metric];

    const body = document.getElementById('targetTableBody');
    if (!body) return;

    const selected = AS.getSelectedFactors();
    // FACTORS 定義順にソート
    const factorOrder = AS.FACTORS.map(f => f.key);
    selected.sort((a, b) => factorOrder.indexOf(a) - factorOrder.indexOf(b));

    if (selected.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 p-4">因子を選択してください</td></tr>';
        return;
    }

    let html = '';
    for (const key of selected) {
        const factor = AS.FACTORS.find(f => f.key === key);
        const results = perFactorResults[key];
        if (!results) continue;

        const baseVal = AS.getFactorBaseValue(key);

        // 基準値（level: 0）のポイントを作成
        // 基準水準(level=0)は runAnalysisRunner でスキップされるため、ここで手動注入する
        const basePoint = {
            factorValue: baseVal,
            metricValue: baseMetrics[metric]
        };

        // 基準値を含む5水準のデータポイントを生成
        const points = [
            basePoint,
            ...results.map(r => ({
                factorValue: baseVal + factor.step * r.level,
                metricValue: r.metrics[metric]
            }))
        ];
        points.sort((a, b) => a.metricValue - b.metricValue);

        const minMetric = points[0].metricValue;
        const maxMetric = points[points.length - 1].metricValue;
        if (targetValue <= minMetric || targetValue >= maxMetric) {
            html += `<tr class="border-b border-slate-700/30">
                <td class="p-2 font-medium text-slate-200">${factor.label}</td>
                <td class="p-2 text-right text-slate-300">${fmtFactorVal(factor, baseVal)} ${factor.unit}</td>
                <td class="p-2 text-center text-slate-500 text-xs" colspan="2">この因子の範囲では改善後の指標値に届きません。</td>
                <td></td>
            </tr>`;
        } else {
            let lower, upper;
            for (let i = 0; i < points.length - 1; i++) {
                if (targetValue >= points[i].metricValue && targetValue <= points[i + 1].metricValue) {
                    lower = points[i]; upper = points[i + 1]; break;
                }
            }
            const fraction = (targetValue - lower.metricValue) / (upper.metricValue - lower.metricValue);
            const requiredFactorValue = lower.factorValue + fraction * (upper.factorValue - lower.factorValue);
            const delta = requiredFactorValue - baseVal;
            const deltaColor = delta > 0 ? 'text-emerald-400' : 'text-rose-400';
            const deltaPrefix = delta >= 0 ? '+' : '';
            html += `<tr class="border-b border-slate-700/30">
                <td class="p-2 font-medium text-slate-200">${factor.label}</td>
                <td class="p-2 text-right text-slate-300">${fmtFactorVal(factor, baseVal)} ${factor.unit}</td>
                <td class="p-2 text-right ${deltaColor} font-mono text-xs">${deltaPrefix}${fmtFactorVal(factor, delta)} ${factor.unit}</td>
                <td class="p-2 text-right text-slate-200">${fmtFactorVal(factor, requiredFactorValue)} ${factor.unit}</td>
                <td></td>
            </tr>`;
        }
    }
    body.innerHTML = html;
}

// ====================================================================
// 因子別比較表
// ====================================================================
function renderCompareCards() {
    const container = document.getElementById('compareCardsContainer');
    const card = document.getElementById('cardCompare');
    const result = AS.getAnalysisResult();
    if (!result || !result.perFactorResults) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    const selected = AS.getSelectedFactors();
    // FACTORS 定義順にソート
    const factorOrder = AS.FACTORS.map(f => f.key);
    selected.sort((a, b) => factorOrder.indexOf(a) - factorOrder.indexOf(b));

    if (selected.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm p-4">因子を選択してください</p>';
        return;
    }

    // ベースメトリクス取得（#9）
    const baseMetrics = result.baseScenario.metrics;

    let maxSuccess = baseMetrics.success_rate_pct;
    let maxP10 = baseMetrics.final_p10_jpy;
    let maxAbsDD = Math.abs(baseMetrics.worst10_max_dd);
    for (const key of selected) {
        const res = result.perFactorResults[key];
        if (!res) continue;
        for (const r of res) {
            if (r.metrics.success_rate_pct > maxSuccess) maxSuccess = r.metrics.success_rate_pct;
            if (r.metrics.final_p10_jpy > maxP10) maxP10 = r.metrics.final_p10_jpy;
            const absDD = Math.abs(r.metrics.worst10_max_dd);
            if (absDD > maxAbsDD) maxAbsDD = absDD;
        }
    }

    let html = '';
    for (const key of selected) {
        const factor = AS.FACTORS.find(f => f.key === key);
        const res = result.perFactorResults[key];
        // 基準水準のデータを手動で注入（-2〜2の5水準を表示するため）
        const augmentedRes = [...res, { level: 0, metrics: baseMetrics }];
        // H2 / L2 水準のメトリック値を取得
        const rPlus2 = augmentedRes.find(r => r.level === 2)?.metrics;
        const rMinus2 = augmentedRes.find(r => r.level === -2)?.metrics;
        const barClassFromTrend = (level, valPlus2, valMinus2, isBase) => {
            if (isBase) return 'base';
            const trend = valPlus2 - valMinus2;
            if (Math.abs(trend) < 1e-12) return level > 0 ? 'positive' : 'negative';
            return (level * trend > 0) ? 'positive' : 'negative';
        };
        const getMetricColorClasses = (barClass) => {
            if (barClass === 'positive') return { bar: 'positive', text: 'text-emerald-400' };
            if (barClass === 'negative') return { bar: 'negative', text: 'text-rose-400' };
            return { bar: 'base', text: 'text-indigo-300' };
        };
        html += `<div class="glass-card compare-card rounded-xl">`;
        html += `<div class="compare-header-row">
            <div class="text-center">${factor.label}</div>
            <div class="text-center">FIRE成功率</div>
            <div class="text-center">最終総資産<br>10%タイル</div>
            <div class="text-center">最大DD<br>10%タイル</div>
        </div>`;

        const baseVal = AS.getFactorBaseValue(key);
        const levels = [2, 1, 0, -1, -2];
        for (const level of levels) {
            const r = augmentedRes.find(r => r.level === level);
            if (!r) continue;
            const val = baseVal + factor.step * level;
            const m = r.metrics;
            const isBase = level === 0;

            const successBarClass = barClassFromTrend(level, rPlus2.success_rate_pct, rMinus2.success_rate_pct, isBase);
            const p10BarClass = barClassFromTrend(level, rPlus2.final_p10_jpy, rMinus2.final_p10_jpy, isBase);
            const ddBarClass = barClassFromTrend(level, rPlus2.worst10_max_dd, rMinus2.worst10_max_dd, isBase);
            const successColors = getMetricColorClasses(successBarClass);
            const p10Colors = getMetricColorClasses(p10BarClass);
            const ddColors = getMetricColorClasses(ddBarClass);

            const successWidth = Math.max(0, Math.min(100, ((m.success_rate_pct - 70) / (100 - 70)) * 100)).toFixed(0);
            const p10Width = (m.final_p10_jpy / maxP10 * 100).toFixed(0);
            const ddAbsWidth = (Math.abs(m.worst10_max_dd) / maxAbsDD * 100).toFixed(0);
            const ddPercent = (m.worst10_max_dd * 100).toFixed(1);

            html += `<div class="compare-row">`;
            html += `<div class="setting-cell">
                <span class="setting-value">${fmtFactorVal(factor, val)} ${factor.unit}</span>
                ${isBase ? '<span class="base-badge">基準</span>' : ''}
            </div>`;
            html += `<div class="bar-stack">
                <div class="bar-track"><div class="bar-fill ${successColors.bar}" style="width:${successWidth}%"></div></div>
                <span class="bar-value ${successColors.text}">${m.success_rate_pct.toFixed(1)}%</span>
            </div>`;
            html += `<div class="bar-stack">
                <div class="bar-track"><div class="bar-fill ${p10Colors.bar}" style="width:${p10Width}%"></div></div>
                <span class="bar-value ${p10Colors.text}">${(m.final_p10_jpy / 1e8).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}億円</span>
            </div>`;
            html += `<div class="bar-stack">
                <div class="dd-bar-track"><div class="dd-bar-fill ${ddColors.bar}" style="width:${ddAbsWidth}%"></div></div>
                <span class="bar-value text-right ${ddColors.text}">${ddPercent}%</span>
            </div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    // 凡例はindex.htmlの#cardCompare内に静的に定義済みのためここでは挿入しない
    container.innerHTML = html || '<p class="text-slate-500 text-sm p-4">因子を選択してください</p>';
}

// ====================================================================
// イベント委譲
// ====================================================================
let delegationDone = false;
export function setupAnalysisEventDelegation() {
    if (delegationDone) return;
    delegationDone = true;
    const tab = document.getElementById('analysisTab');
    if (!tab) return;

    tab.addEventListener('click', e => {
        const t = e.target.closest('[data-action]');
        if (!t) return;
        const action = t.dataset.action;
        if (action === 'toggle-factor') {
            const key = t.dataset.factorKey;
            const sel = AS.getSelectedFactors();
            if (sel.includes(key)) {
                AS.setSelectedFactors(sel.filter(k => k !== key));
            } else {
                AS.setSelectedFactors([...sel, key]);
            }
            renderAnalysisTab();
        } else if (action === 'edit-base') {
            document.getElementById('simTabBtn')?.click();
        }
    });

    tab.addEventListener('change', e => {
        if (e.target.dataset.action === 'change-target-metric') {
            renderTargetTable();
        }
    });

    document.getElementById('runAnalysisBtn')?.addEventListener('click', executeAnalysis);

    // ZIP出力ボタンのイベント登録
    document.getElementById('exportZipBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('exportZipBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'ZIP生成中...';
        try {
            const { generateAndDownloadZip } = await import('./analysis-output.js');
            await generateAndDownloadZip();
            btn.innerHTML = '✅ ダウンロード完了';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        } catch (e) {
            console.error('ZIP出力エラー:', e);
            alert('ZIP出力に失敗しました: ' + e.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

/**
 * テスト専用: delegationDone フラグをリセットする
 * テスト間でイベント委譲の再設定を可能にする。
 * 注意: 既存のイベントリスナーは解除しないが、
 * 各テストで document.body.innerHTML を完全に置き換えるため実質的にリセットされる。
 * 将来 setupAnalysisEventDelegation が document や window に
 * リスナーを追加するように変更された場合、テスト間でリスナーが蓄積する可能性がある。
 */
export function _resetDelegationForTest() {
  delegationDone = false;
}



async function executeAnalysis() {
    if (AS.getState().isRunning) return;
    AS.setRunning(true);
    const btn = document.getElementById('runAnalysisBtn');
    btn.disabled = true;
    btn.textContent = '分析を実行中... 0%';

    // 分析中はシミュレーションタブの進捗コールバックを無効化（#10）
    const savedCallback = getProgressCallback();
    setProgressCallback(null);

    try {
        const { runAnalysis } = await import('./analysis-runner.js');
        const result = await runAnalysis(progress => {
            const pct = Math.round((progress.done / progress.total) * 100);
            btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 分析を実行中... ${pct}%`;
            btn.style.background = `linear-gradient(to right, rgba(99,102,241,0.8) ${pct}%, rgb(30,41,59) ${pct}%)`;
        });
        AS.setAnalysisResult(result);
    } catch (e) {
        AS.setErrorMessage(e.message);
    } finally {
        // 進捗コールバックを復元（#10）
        setProgressCallback(savedCallback);
        btn.disabled = AS.getSelectedFactors().length === 0;
        btn.innerHTML = '分析を実行';
        btn.style.background = '';
        renderAnalysisTab();
        // 分析実行後の自動スクロール（#2）
        setTimeout(() => {
            const target = document.getElementById('cardTarget');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}