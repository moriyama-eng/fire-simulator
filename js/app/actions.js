// ====================================================================
// js/app/actions.js
// 主要アクション関数群
// 依存: core/params.js, core/format.js, core/url.js,
//       simulation-engine.js, core/state.js, i18n.js,
//       app/state.js, app/charts.js, app/summary.js, app/ui-helpers.js
// ====================================================================

import { getParamsFromInputs } from '../core/params.js';
import { formatPercentileInput, parsePercentiles } from '../core/format.js';
import { buildSimulationUrl } from '../core/url.js';
import { runSimulation, setProgressCallback } from '../simulation-engine.js';
import { markResultClean, markInputChanged as coreMarkInputChanged } from '../core/state.js';
import { t, formatCurrency, formatPercent, formatDate, formatYears, formatNumber, getLanguage } from '../i18n.js';
import {
    getAssetChart, getCashChart,
    getLastSimResult, setLastSimResult,
    getIsRunning, setIsRunning,
    getIsResultDirty, setIsResultDirty,
    getLastExecutedParams, setLastExecutedParams,
    getLastMainExecutionMs, setLastMainExecutionMs,
} from './state.js';
import {
    renderAssetChart, renderCashChart,
    renderDdCdfChart, renderUwCdfChart,
    renderBelowInitCdfChart, renderConsecutiveSellCdfChart,
    applyDownsideFocus,
} from './charts.js';
import { updateSummaryCard, renderEmptySummaryCard } from './summary.js';
import { initTooltips } from './ui-helpers.js';

// ====================================================================
// 入力変更フラグの更新
// core/state.js の markInputChanged のラッパー
// ====================================================================
export function markInputChanged() {
    coreMarkInputChanged(); // 内部で setDirty(true) とボタン無効化を実行
    const lastSimResult = getLastSimResult();
    if (lastSimResult) {
        const params = getParamsFromDom();
        updateSummaryCard(lastSimResult, params);
    }
}

// ====================================================================
// DOMからパラメータを取得するヘルパー
// getParams() の実体（計画書の指示通り、getParamsFromInputs を直接使用）
// ====================================================================
function getParamsFromDom() {
    return getParamsFromInputs({
        initialRiskAssetNum: document.getElementById('initialRiskAssetNum').value,
        initialCashBufferNum: document.getElementById('initialCashBufferNum').value,
        monthlyExpenseNum: document.getElementById('monthlyExpenseNum').value,
        expectedReturnNum: document.getElementById('expectedReturnNum').value,
        volatilityNum: document.getElementById('volatilityNum').value,
        inflationRateNum: document.getElementById('inflationRateNum').value,
        simYearsNum: document.getElementById('simYearsNum').value,
        simPathsNum: document.getElementById('simPathsNum').value,
        cashBufferToggle: document.getElementById('cashBufferToggle').checked,
        drawdownTriggerNum: document.getElementById('drawdownTriggerNum').value,
        drawdownReplenishNum: document.getElementById('drawdownReplenishNum').value,
        replenishPaceNum: document.getElementById('replenishPaceNum').value,
        guardrailToggle: document.getElementById('guardrailToggle').checked,
        guardrailTriggerNum: document.getElementById('guardrailTriggerNum').value,
        guardrailReleaseNum: document.getElementById('guardrailReleaseNum').value,
        guardrailReductionNum: document.getElementById('guardrailReductionNum').value,
        inflationModelToggle: document.getElementById('inflationModelToggle').checked,
        infVolNum: document.getElementById('infVolNum').value,
        infArNum: document.getElementById('infArNum').value,
        returnModelSelect: document.getElementById('returnModelSelect').value,
        simDfToggle: document.getElementById('simDfToggle').checked,
        simDfNum: document.getElementById('simDfNum').value,
        seedToggle: document.getElementById('seedToggle').checked,
        seedNum: document.getElementById('seedNum').value,
        targetAssetRatioNum: document.getElementById('targetAssetRatioNum').value,
    });
}

// ====================================================================
// メイン実行関数
// ====================================================================
export async function runMain() {
    if (getIsRunning()) return;
    const _analysisStartTime = performance.now();
    setIsRunning(true);

    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;

    const simSeedInput = document.getElementById('seedNum');
    if (document.getElementById('seedToggle').checked || !simSeedInput.value) {
        simSeedInput.value = Date.now() >>> 0;
    }

    const params = getParamsFromDom();

    await new Promise(r => requestAnimationFrame(r));

    try {

        // バリデーション：ガードレール終了閾値が発動閾値より小さい場合は発動閾値と同値に補正
        if (params.guardrailToggle && params.guardrailRelease < params.guardrailTrigger) {
            params.guardrailRelease = params.guardrailTrigger;
            const releaseInput = document.getElementById('guardrailReleaseNum');
            if (releaseInput) releaseInput.value = params.guardrailTrigger.toFixed(1);
        }
        // パーセンタイル入力を自動整形してから parsePercentiles を呼ぶ
        const pctInput = document.getElementById('percentileInput');
        pctInput.value = formatPercentileInput(pctInput.value);
        const percentiles = parsePercentiles(pctInput.value);
        const simStartTime = performance.now();
        const result = await runSimulation(params, percentiles);
        // analysis-runner.js が参照するため window に保持
        window.lastSimOnlyMs = performance.now() - simStartTime;
        setLastSimResult(result);
        setIsResultDirty(false);

        const isLogScale = document.getElementById('logScaleToggle').checked;
        renderAssetChart(result, isLogScale);
        const cashChartCard = document.getElementById('cashChartCanvas')?.closest('.glass-card');
        if (cashChartCard) {
            cashChartCard.style.display = params.cashBufferToggle ? '' : 'none';
        }
        if (params.cashBufferToggle) renderCashChart(result);
        renderDdCdfChart(result);
        renderUwCdfChart(result);
        // v2.3.0: 新指標グラフの描画
        renderBelowInitCdfChart(result);
        renderConsecutiveSellCdfChart(result);
        markResultClean(); // 共有ボタンの有効化
        updateSummaryCard(result, params);
        setTimeout(() => {
            const target = document.getElementById('summaryCardContainer');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);

    } catch (error) {
        console.error("Simulation error:", error);
        const reason = error.message.startsWith('error.') ? t(error.message) : error.message;
        alert(t('error.simulationFailed') + ": " + reason);
    } finally {
        // Bug #21: 確実にデフォルト状態にリセット
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = t('button.run');
            runBtn.style.background = '';
        }
        setIsRunning(false);
        const lastSimResult = getLastSimResult();
        if (lastSimResult) {
            setLastExecutedParams(getParamsFromDom());
            setLastMainExecutionMs(performance.now() - _analysisStartTime);
            syncBaseToAnalysisIfOpen();
        }
    }
}

// ====================================================================
// 画像キャプチャ（PNG保存）ロジック
// ====================================================================
export async function saveImage() {
    const lastSimResult = getLastSimResult();
    const assetChart = getAssetChart();
    if (!lastSimResult || getIsRunning()) return;
    const btn = document.getElementById('saveImageBtn');
    const originalHtml = btn.innerHTML;

    try {
        // ボタンをローディング状態に
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.savingImage')}`;

        const params = getParamsFromDom();

        // 1. キャプチャ用DOM（シミュレーション条件）にデータを反映
        const uiExecTime = document.getElementById('uiExecTime');
        if (uiExecTime) {
            document.getElementById('capExecTime').textContent = uiExecTime.textContent;
        }
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        document.getElementById('capRiskAsset').textContent = isJa
            ? (params.initialRiskAsset / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円'
            : formatCurrency(params.initialRiskAsset, '億円');
        document.getElementById('capCash').textContent = isJa
            ? formatCurrency(params.initialCashBuffer, '万円')
            : formatCurrency(params.initialCashBuffer, '万円');
        document.getElementById('capExpense').textContent = isJa
            ? formatCurrency(params.monthlyExpense, '万円')
            : formatCurrency(params.monthlyExpense, '万円');

        const modelText = lastSimResult.modelType === 'log-t' ? t('summary.model.logt') : t('summary.model.lognormal');
        document.getElementById('capModel').textContent = modelText;

        document.getElementById('capReturnVol').textContent = params.expectedReturn.toFixed(1) + '% / ' + params.volatility.toFixed(1) + '%';
        document.getElementById('capInf').textContent = params.inflationRate.toFixed(1) + '%';
        document.getElementById('capYears').textContent = formatYears(params.simYears);

        // ガードレール状態を反映（ON/OFFのみ表示）
        document.getElementById('capGuardrail').textContent = params.guardrailToggle ? t('gr.on') : t('gr.off');

        // キャプチャにバージョン番号を反映
        var footerUrlEl = document.getElementById('capFooterUrl');
        if (footerUrlEl) footerUrlEl.textContent = t('capture.footerUrl');

        // キャプチャ用DOM（シミュレーション結果）にデータを反映
        document.getElementById('capSuccess').textContent = formatPercent(lastSimResult.successRate / 100);
        document.getElementById('capMedian').textContent = formatCurrency(lastSimResult.finalMedian, '億円');
        document.getElementById('capTargetMaintainRate').textContent = lastSimResult.targetAssetMaintainRate.toFixed(1) + '%';
        document.getElementById('capTargetRatio').textContent = params.targetAssetRatio;

        // 2. グラフ画像を転写（スマホでもPC表示のアスペクト比を維持するため一時的に固定サイズへ変更）
        const chartCanvas = document.getElementById('assetChartCanvas');
        if (!chartCanvas) throw new Error("Chart element not found (assetChartCanvas not found)");

        const chartContainer = chartCanvas.parentElement;
        const chartCard = chartContainer.parentElement;

        const origCardOverflow = chartCard.style.overflow;
        const origCardHeight = chartCard.style.height;
        const origWidth = chartContainer.style.width;
        const origHeight = chartContainer.style.height;

        // 画面のレイアウトシフトを防ぐため親要素(カード)の高さを現在値に一時固定
        chartCard.style.height = chartCard.offsetHeight + 'px';
        chartCard.style.overflow = 'hidden';
        chartContainer.style.width = '1000px';
        chartContainer.style.height = '600px';

        // 画像出力用にフォントサイズを一時的に拡大
        if (assetChart) {
            // ツールチップを強制的に非表示にする
            assetChart.tooltip.setActiveElements([], { x: 0, y: 0 });

            // アニメーションを無効化（チラつき防止）
            const origAnimation = assetChart.options.animation;
            assetChart.options.animation = false;

            const origLegendSize = assetChart.options.plugins.legend.labels.font.size;
            const origXTickSize = assetChart.options.scales.x.ticks.font.size;
            const origYTickSize = assetChart.options.scales.y.ticks.font.size;
            const origMaxRotation = assetChart.options.scales.x.ticks.maxRotation;
            const origMinRotation = assetChart.options.scales.x.ticks.minRotation;

            // 保存用にフォントサイズを極限まで拡大 (1080px幅に対して他項目と調和するサイズ)
            assetChart.options.plugins.legend.labels.font.size = 38;
            assetChart.options.scales.x.ticks.font.size = 34;
            assetChart.options.scales.y.ticks.font.size = 34;
            
            // 英語モードのみX軸ラベルを36度傾斜させる（日本語モードは自動判別される水平表示を維持）
            if (!isJa) {
                assetChart.options.scales.x.ticks.maxRotation = 36;
                assetChart.options.scales.x.ticks.minRotation = 36;
            }

            assetChart.resize();
            assetChart.update('none');

            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => setTimeout(r, 200));

            const chartDataUrl = chartCanvas.toDataURL('image/png', 1.0);

            // サイズとフォントを元に戻す
            assetChart.options.plugins.legend.labels.font.size = origLegendSize;
            assetChart.options.scales.x.ticks.font.size = origXTickSize;
            assetChart.options.scales.y.ticks.font.size = origYTickSize;
            if (!isJa) {
                assetChart.options.scales.x.ticks.maxRotation = origMaxRotation;
                assetChart.options.scales.x.ticks.minRotation = origMinRotation;
            }

            chartContainer.style.width = origWidth;
            chartContainer.style.height = origHeight;
            chartCard.style.overflow = origCardOverflow;
            chartCard.style.height = origCardHeight;

            // アニメーション設定を復元
            assetChart.options.animation = origAnimation;
            assetChart.resize();
            assetChart.update('none');

            const capImg = document.getElementById('capChartImg');
            if (!capImg) throw new Error("Preview image element not found (capChartImg not found)");
            capImg.src = chartDataUrl;
        }

        await new Promise(r => setTimeout(r, 300));

        // 3. html2canvasでオフスクリーンコンテナをキャプチャ
        const container = document.getElementById('captureContainer');
        if (!container) throw new Error("Export template not found (captureContainer not found)");

        const canvas = await html2canvas(container, {
            scale: 2, // 高解像度化のために2倍に設定
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#0f172a", // 背景色を明示的に指定
            logging: false,
            width: 1080,
            height: 1350,
            windowWidth: 1080,
            windowHeight: 1350,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
        });

        // 4. ダウンロード実行
        const url = canvas.toDataURL('image/png', 1.0);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = formatDate(new Date()).replace(/[^0-9]/g, '');
        a.download = `FIRE_Sim_Result_${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 成功時のフィードバック表示
        btn.innerHTML = `<svg class="w-5 h-5 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>${t('button.imageSaved')}`;
        btn.classList.add('text-emerald-400');
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('text-emerald-400');
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        console.error("画像保存エラーの詳細:", err);
        const reason = err.message.startsWith('error.') ? t(err.message) : err.message;
        alert(t('error.imageFailed', [reason]));
        // エラー時は即座に復元
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ====================================================================
// X（Twitter）へのシェア
// ====================================================================
export function shareToX() {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const p = getParamsFromDom();
    const s = lastSimResult.successRate.toFixed(1);
    const url = buildSimulationUrl(p, {
        autoRun: true, fixedSeed: true,
        seed: lastSimResult.usedSeed,
        percentileRaw: document.getElementById('percentileInput').value,
        baseUrl: 'https://moriyama-eng.github.io/fire-simulator/',
        lang: getLanguage()
    });
    const text = t('share.x.template', [
        formatCurrency(p.initialRiskAsset, '億円'),
        formatCurrency(p.initialCashBuffer, '万円'),
        formatCurrency(p.monthlyExpense, '万円'),
        p.expectedReturn.toFixed(1),
        p.volatility.toFixed(1),
        p.inflationRate.toFixed(1),
        formatYears(p.simYears),
        s,
        url.toString()
    ]);
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

// ====================================================================
// 比較タブを新規タブで開く
// ====================================================================
export function openCompareTab() {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const p = getParamsFromDom();
    const url = buildSimulationUrl(p, {
        autoRun: false, fixedSeed: true,
        seed: lastSimResult.usedSeed,
        percentileRaw: document.getElementById('percentileInput').value,
        lang: getLanguage()
    });
    window.open(url.toString(), '_blank');
}

// ====================================================================
// シミュレーションURLをクリップボードにコピー
// ====================================================================
export async function copySimUrl() {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const btn = document.getElementById('copySimUrlBtn');
    if (btn.disabled) return;
    const originalHtml = btn.innerHTML;
    const p = getParamsFromDom();
    const url = buildSimulationUrl(p, {
        autoRun: true, fixedSeed: true,
        seed: lastSimResult.usedSeed,
        percentileRaw: document.getElementById('percentileInput').value,
        lang: getLanguage()
    });
    try {
        await navigator.clipboard.writeText(url.toString());
        btn.disabled = true;
        btn.innerHTML = `<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>${t('button.copied')}`;
        btn.classList.add('text-emerald-400');
        setTimeout(() => { btn.innerHTML = originalHtml; btn.classList.remove('text-emerald-400'); btn.disabled = false; }, 2000);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = url.toString();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.disabled = true;
        btn.innerHTML = t('button.copied');
        btn.classList.add('text-emerald-400');
        setTimeout(() => { btn.innerHTML = originalHtml; btn.classList.remove('text-emerald-400'); btn.disabled = false; }, 2000);
    }
}

// ====================================================================
// 分析タブへのベースコンテキスト同期
// ====================================================================
export function syncBaseToAnalysis() {
    const lastSimResult = getLastSimResult();
    const lastExecutedParams = getLastExecutedParams();
    if (!lastSimResult || !lastExecutedParams) return;
    const ep = convertToEffectiveParams(lastExecutedParams, lastSimResult);
    import('../analysis-state.js').then(AS => {
        AS.setBaseContext({ source: 'LAST_MAIN_RUN', effectiveParams: ep, summary: { successRatePct: lastSimResult.successRate, finalMedianJpy: lastSimResult.finalMedian, worst10MaxDdPct: lastSimResult.worst10MaxDd } }, ep);
        import('../analysis-ui.js').then(AUI => AUI.renderAnalysisTab()).catch(e => console.error(e));
    }).catch(e => console.error(e));
}

export function syncBaseToAnalysisIfOpen() {
    const tab = document.getElementById('analysisTab');
    if (tab && !tab.classList.contains('hidden')) syncBaseToAnalysis();
}

// ====================================================================
// 有効パラメータへの変換
// ====================================================================
export function convertToEffectiveParams(params, simResult) {
    return {
        initialRiskAsset: params.initialRiskAsset,
        initialCashBuffer: params.cashBufferToggle ? params.initialCashBuffer : 10_000_000,
        monthlyExpense: params.monthlyExpense,
        expectedReturn: params.expectedReturn,
        volatility: params.volatility,
        inflationRate: params.inflationRate,
        simYears: params.simYears,
        simPaths: params.simPaths,
        seed: simResult?.usedSeed || params.seedNum,
        modelType: params.useTDistribution ? 'log-t' : 'log-normal',
        dfMode: params.simDfManual ? 'manual' : 'auto',
        simDfNum: params.useTDistribution ? params.simDfNum : null,
        usedDf: simResult?.usedDf || null,
        inflationMode: params.useArInflation ? 'ar1' : 'fixed',
        infVol: params.infVol,
        infAr: params.infAr,
        cashBufferToggle: params.cashBufferToggle,
        drawdownTrigger: params.cashBufferToggle ? params.drawdownTrigger : -20.0,
        drawdownReplenish: params.cashBufferToggle ? params.drawdownReplenish : -5.0,
        replenishPace: params.cashBufferToggle ? params.replenishPace : 5.0,
        guardrailToggle: params.guardrailToggle,
        guardrailTrigger: params.guardrailToggle ? params.guardrailTrigger : -20.0,
        guardrailRelease: params.guardrailToggle ? params.guardrailRelease : -15.0,
        guardrailReduction: params.guardrailToggle ? params.guardrailReduction : -20.0,
        useArInflation: params.useArInflation,
        targetAssetRatio: params.targetAssetRatio,
        percentiles: null,
    };
}
