// ====================================================================
// js/app/actions.js
// Collection of main action functions
// Dependencies: core/params.js, core/format.js, core/url.js,
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
// Update the input change flag
// Wrapper for markInputChanged in core/state.js
// ====================================================================
export function markInputChanged() {
    coreMarkInputChanged(); // Internally calls setDirty(true) and disables the button
    const lastSimResult = getLastSimResult();
    if (lastSimResult) {
        const params = getParamsFromDom();
        updateSummaryCard(lastSimResult, params);
    }
}

// ====================================================================
// Helper to retrieve parameters from the DOM
// The actual implementation of getParams() (uses getParamsFromInputs directly, as specified in the plan)
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
// Main execution function
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

        // Validation: if the guardrail release threshold is smaller than the trigger threshold, correct it to match the trigger threshold
        if (params.guardrailToggle && params.guardrailRelease < params.guardrailTrigger) {
            params.guardrailRelease = params.guardrailTrigger;
            const releaseInput = document.getElementById('guardrailReleaseNum');
            if (releaseInput) releaseInput.value = params.guardrailTrigger.toFixed(1);
        }
        // Auto-format the percentile input before calling parsePercentiles
        const pctInput = document.getElementById('percentileInput');
        pctInput.value = formatPercentileInput(pctInput.value);
        const percentiles = parsePercentiles(pctInput.value);
        const simStartTime = performance.now();
        const result = await runSimulation(params, percentiles);
        // Stored on window because analysis-runner.js references it
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
        // v2.3.0: Render new indicator charts
        renderBelowInitCdfChart(result);
        renderConsecutiveSellCdfChart(result);
        markResultClean(); // Enable the share button
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
        // Ensure the button is reset to the default state reliably
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
// Image capture (PNG save) logic
// ====================================================================
export async function saveImage() {
    const lastSimResult = getLastSimResult();
    const assetChart = getAssetChart();
    if (!lastSimResult || getIsRunning()) return;
    const btn = document.getElementById('saveImageBtn');
    const originalHtml = btn.innerHTML;

    try {
        // Put the button into loading state
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.savingImage')}`;

        const params = getParamsFromDom();

        // 1. Reflect data into the capture DOM (simulation conditions)
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

        // Reflect guardrail state (display ON/OFF only)
        document.getElementById('capGuardrail').textContent = params.guardrailToggle ? t('gr.on') : t('gr.off');

        // Reflect the version number in the capture
        var footerUrlEl = document.getElementById('capFooterUrl');
        if (footerUrlEl) footerUrlEl.textContent = t('capture.footerUrl');

        // Reflect data into the capture DOM (simulation results)
        document.getElementById('capSuccess').textContent = formatPercent(lastSimResult.successRate / 100);
        document.getElementById('capMedian').textContent = formatCurrency(lastSimResult.finalMedian, '億円');
        document.getElementById('capTargetMaintainRate').textContent = lastSimResult.targetAssetMaintainRate.toFixed(1) + '%';
        document.getElementById('capTargetRatio').textContent = params.targetAssetRatio;

        // 2. Transfer the chart image (temporarily change to a fixed size to maintain the PC aspect ratio even on smartphones)
        const chartCanvas = document.getElementById('assetChartCanvas');
        if (!chartCanvas) throw new Error("Chart element not found (assetChartCanvas not found)");

        const chartContainer = chartCanvas.parentElement;
        const chartCard = chartContainer.parentElement;

        const origCardOverflow = chartCard.style.overflow;
        const origCardHeight = chartCard.style.height;
        const origWidth = chartContainer.style.width;
        const origHeight = chartContainer.style.height;

        // Temporarily fix the height of the parent element (card) to the current value to prevent layout shifts on screen
        chartCard.style.height = chartCard.offsetHeight + 'px';
        chartCard.style.overflow = 'hidden';
        chartContainer.style.width = '1000px';
        chartContainer.style.height = '600px';

        // Temporarily enlarge font sizes for image output
        if (assetChart) {
            // Force-hide the tooltip
            assetChart.tooltip.setActiveElements([], { x: 0, y: 0 });

            // Disable animation (to prevent flickering)
            const origAnimation = assetChart.options.animation;
            assetChart.options.animation = false;

            const origLegendSize = assetChart.options.plugins.legend.labels.font.size;
            const origXTickSize = assetChart.options.scales.x.ticks.font.size;
            const origYTickSize = assetChart.options.scales.y.ticks.font.size;
            const origMaxRotation = assetChart.options.scales.x.ticks.maxRotation;
            const origMinRotation = assetChart.options.scales.x.ticks.minRotation;

            // Maximize font sizes for saving (sized to harmonize with other items at 1080px width)
            assetChart.options.plugins.legend.labels.font.size = 38;
            assetChart.options.scales.x.ticks.font.size = 34;
            assetChart.options.scales.y.ticks.font.size = 34;
            
            // Tilt X-axis labels 36 degrees only in English mode (Japanese mode maintains horizontal display, which is auto-detected)
            if (!isJa) {
                assetChart.options.scales.x.ticks.maxRotation = 36;
                assetChart.options.scales.x.ticks.minRotation = 36;
            }

            assetChart.resize();
            assetChart.update('none');

            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => setTimeout(r, 200));

            const chartDataUrl = chartCanvas.toDataURL('image/png', 1.0);

            // Restore size and font
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

            // Restore animation settings
            assetChart.options.animation = origAnimation;
            assetChart.resize();
            assetChart.update('none');

            const capImg = document.getElementById('capChartImg');
            if (!capImg) throw new Error("Preview image element not found (capChartImg not found)");
            capImg.src = chartDataUrl;
        }

        await new Promise(r => setTimeout(r, 300));

        // 3. Capture the off-screen container with html2canvas
        const container = document.getElementById('captureContainer');
        if (!container) throw new Error("Export template not found (captureContainer not found)");

        const canvas = await html2canvas(container, {
            scale: 2, // Set to 2x for high-resolution output
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#0f172a", // Explicitly specify the background color
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

        // 4. Execute download
        const url = canvas.toDataURL('image/png', 1.0);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = formatDate(new Date()).replace(/[^0-9]/g, '');
        a.download = `FIRE_Sim_Result_${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Display feedback on success
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
        // Immediately restore on error
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ====================================================================
// Share to X (Twitter)
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
// Open the comparison tab in a new tab
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
// Copy the simulation URL to the clipboard
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
// Sync base context to the analysis tab
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
// Convert to effective parameters
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
