// ====================================================================
// src/app/actions.ts
// Collection of main action functions
// Dependencies: core/params.ts, core/format.ts, core/url.ts,
//       simulation-engine.ts, core/state.ts, i18n.ts,
//       app/state.ts, app/charts.ts, app/summary.ts, app/ui-helpers.ts
// ====================================================================

import { getParamsFromInputs } from '../core/params.js';
import { formatPercentileInput, parsePercentiles } from '../core/format.js';
import { buildSimulationUrl } from '../core/url.js';
import { getCopyUrlOptions, getShareUrlOptions, getCompareUrlOptions } from './actions-url-options.js';
import { runSimulation } from '../simulation-engine.js';
import { markResultClean, markInputChanged as coreMarkInputChanged } from '../core/state.js';
import { t, formatCurrency, formatPercent, formatDate, formatYears, getLanguage } from '../i18n.js';
import {
    getAssetChart,
    getLastSimResult, setLastSimResult,
    getIsRunning, setIsRunning,
    getIsResultDirty, setIsResultDirty,
    getLastExecutedParams, setLastExecutedParams,
} from './state.js';
import {
    renderAssetChart, renderCashChart,
    renderDdCdfChart, renderUwCdfChart,
    renderBelowInitCdfChart, renderConsecutiveSellCdfChart,
} from './charts.js';
import { updateSummaryCard } from './summary.js';
import type { SimulationParams } from '../types/params.js';
import type { AggregatedMetrics } from '../types/simulation.js';
import type { BaseEffectiveParams } from '../analysis-state.js';

// ====================================================================
// Update the input change flag
// Wrapper for markInputChanged in core/state.ts
// ====================================================================
export function markInputChanged(): void {
    coreMarkInputChanged(); // Internally calls setDirty(true) and disables the button
    const lastSimResult = getLastSimResult();
    if (lastSimResult) {
        const params = getParamsFromDom();
        updateSummaryCard(lastSimResult, params);
    }
}

// ====================================================================
// Helper to retrieve parameters from the DOM
// ====================================================================
function getParamsFromDom(): SimulationParams {
    const getValue = (id: string): string => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        return el ? el.value : '';
    };
    const getChecked = (id: string): boolean => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        return el ? el.checked : false;
    };

    return getParamsFromInputs({
        initialRiskAssetNum: getValue('initialRiskAssetNum'),
        initialCashBufferNum: getValue('initialCashBufferNum'),
        monthlyExpenseNum: getValue('monthlyExpenseNum'),
        expectedReturnNum: getValue('expectedReturnNum'),
        volatilityNum: getValue('volatilityNum'),
        inflationRateNum: getValue('inflationRateNum'),
        simYearsNum: getValue('simYearsNum'),
        simPathsNum: getValue('simPathsNum'),
        cashBufferToggle: getChecked('cashBufferToggle'),
        drawdownTriggerNum: getValue('drawdownTriggerNum'),
        drawdownReplenishNum: getValue('drawdownReplenishNum'),
        replenishPaceNum: getValue('replenishPaceNum'),
        guardrailToggle: getChecked('guardrailToggle'),
        guardrailTriggerNum: getValue('guardrailTriggerNum'),
        guardrailReleaseNum: getValue('guardrailReleaseNum'),
        guardrailReductionNum: getValue('guardrailReductionNum'),
        inflationModelToggle: getChecked('inflationModelToggle'),
        infVolNum: getValue('infVolNum'),
        infArNum: getValue('infArNum'),
        returnModelSelect: getValue('returnModelSelect'),
        simDfToggle: getChecked('simDfToggle'),
        simDfNum: getValue('simDfNum'),
        seedToggle: getChecked('seedToggle'),
        seedNum: getValue('seedNum'),
        targetAssetRatioNum: getValue('targetAssetRatioNum'),
    });
}

// ====================================================================
// Main execution function
// ====================================================================
export async function runMain(): Promise<void> {
    if (getIsRunning()) return;
    setIsRunning(true);

    const runBtn = document.getElementById('runBtn') as HTMLButtonElement | null;
    if (runBtn) runBtn.disabled = true;

    const simSeedInput = document.getElementById('seedNum') as HTMLInputElement | null;
    const seedToggle = document.getElementById('seedToggle') as HTMLInputElement | null;
    if (seedToggle?.checked || !simSeedInput?.value) {
        if (simSeedInput) simSeedInput.value = (Date.now() >>> 0).toString();
    }

    const params = getParamsFromDom();

    await new Promise(r => requestAnimationFrame(r));

    try {
        // Validation: if the guardrail release threshold is smaller than the trigger threshold, correct it to match the trigger threshold
        if (params.guardrailToggle && params.guardrailRelease < params.guardrailTrigger) {
            params.guardrailRelease = params.guardrailTrigger;
            const releaseInput = document.getElementById('guardrailReleaseNum') as HTMLInputElement | null;
            if (releaseInput) releaseInput.value = params.guardrailTrigger.toFixed(1);
        }
        // Auto-format the percentile input before calling parsePercentiles
        const pctInput = document.getElementById('percentileInput') as HTMLInputElement | null;
        const pctVal = pctInput ? formatPercentileInput(pctInput.value) : '10,30,50,70,90';
        if (pctInput) pctInput.value = pctVal;
        const percentiles = parsePercentiles(pctVal);
        const simStartTime = performance.now();
        const result = await runSimulation(params, percentiles);
        // Stored on window because analysis-ui.ts references it
        if (typeof window !== 'undefined') {
            window.lastSimOnlyMs = performance.now() - simStartTime;
        }
        setLastSimResult(result);
        setIsResultDirty(false);

        const logScaleToggle = document.getElementById('logScaleToggle') as HTMLInputElement | null;
        const isLogScale = logScaleToggle ? logScaleToggle.checked : false;
        renderAssetChart(result, isLogScale);
        const cashChartCard = document.getElementById('cashChartCanvas')?.closest('.glass-card') as HTMLElement | null;
        if (cashChartCard) {
            cashChartCard.style.display = params.cashBufferToggle ? '' : 'none';
        }
        if (params.cashBufferToggle) renderCashChart(result);
        renderDdCdfChart(result);
        renderUwCdfChart(result);
        // Render additional indicator charts
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

    } catch (error: unknown) {
        console.error("Simulation error:", error);
        const err = error as { message?: string };
        const msg = err.message || String(error);
        const reason = msg.startsWith('error.') ? t(msg) : msg;
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
            syncBaseToAnalysisIfOpen();
        }
    }
}

// ====================================================================
// Image capture (PNG save) logic
// ====================================================================
export async function saveImage(): Promise<void> {
    const lastSimResult = getLastSimResult();
    const assetChart = getAssetChart();
    if (!lastSimResult || getIsRunning()) return;
    const btn = document.getElementById('saveImageBtn') as HTMLButtonElement | null;
    if (!btn) return;
    const originalHtml = btn.innerHTML;

    try {
        // Put the button into loading state
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.savingImage')}`;

        const params = getParamsFromDom();

        // 1. Reflect data into the capture DOM (simulation conditions)
        const uiExecTime = document.getElementById('uiExecTime');
        const capExecTime = document.getElementById('capExecTime');
        if (uiExecTime && capExecTime) {
            capExecTime.textContent = uiExecTime.textContent;
        }
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        const capRiskAsset = document.getElementById('capRiskAsset');
        if (capRiskAsset) {
            capRiskAsset.textContent = isJa
                ? (params.initialRiskAsset / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '\u5104\u5186'
                : formatCurrency(params.initialRiskAsset, '\u5104\u5186');
        }
        const capCash = document.getElementById('capCash');
        if (capCash) {
            capCash.textContent = formatCurrency(params.initialCashBuffer, '\u4e07\u5186');
        }
        const capExpense = document.getElementById('capExpense');
        if (capExpense) {
            capExpense.textContent = formatCurrency(params.monthlyExpense, '\u4e07\u5186');
        }

        const modelText = lastSimResult.modelType === 'log-t' ? t('summary.model.logt') : t('summary.model.lognormal');
        const capModel = document.getElementById('capModel');
        if (capModel) capModel.textContent = modelText;

        const capReturnVol = document.getElementById('capReturnVol');
        if (capReturnVol) capReturnVol.textContent = params.expectedReturn.toFixed(1) + '% / ' + params.volatility.toFixed(1) + '%';
        const capInf = document.getElementById('capInf');
        if (capInf) capInf.textContent = params.inflationRate.toFixed(1) + '%';
        const capYears = document.getElementById('capYears');
        if (capYears) capYears.textContent = formatYears(params.simYears);

        // Reflect guardrail state (display ON/OFF only)
        const capGuardrail = document.getElementById('capGuardrail');
        if (capGuardrail) capGuardrail.textContent = params.guardrailToggle ? t('gr.on') : t('gr.off');

        // Reflect the version number in the capture
        const footerUrlEl = document.getElementById('capFooterUrl');
        if (footerUrlEl) footerUrlEl.textContent = t('capture.footerUrl');

        // Reflect data into the capture DOM (simulation results)
        const capSuccess = document.getElementById('capSuccess');
        if (capSuccess) capSuccess.textContent = formatPercent(lastSimResult.successRate / 100);
        const capMedian = document.getElementById('capMedian');
        if (capMedian) capMedian.textContent = formatCurrency(lastSimResult.finalMedian, '\u5104\u5186');
        const capTargetMaintainRate = document.getElementById('capTargetMaintainRate');
        if (capTargetMaintainRate) capTargetMaintainRate.textContent = lastSimResult.targetAssetMaintainRate.toFixed(1) + '%';
        const capTargetRatio = document.getElementById('capTargetRatio');
        if (capTargetRatio) capTargetRatio.textContent = params.targetAssetRatio.toString();

        // 2. Transfer the chart image (temporarily change to a fixed size to maintain the PC aspect ratio even on smartphones)
        const chartCanvas = document.getElementById('assetChartCanvas') as HTMLCanvasElement | null;
        if (!chartCanvas) throw new Error("Chart element not found (assetChartCanvas not found)");

        const chartContainer = chartCanvas.parentElement;
        if (!chartContainer) throw new Error("Chart container not found");
        const chartCard = chartContainer.parentElement;
        if (!chartCard) throw new Error("Chart card not found");

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
            interface ChartInternalOptions {
                animation?: boolean | Record<string, unknown>;
                plugins?: {
                    legend?: { labels?: { font?: { size?: number } } };
                };
                scales?: {
                    x?: { ticks?: { font?: { size?: number }; maxRotation?: number; minRotation?: number } };
                    y?: { ticks?: { font?: { size?: number } } };
                };
            }
            interface ChartInternalInstance {
                tooltip?: {
                    setActiveElements(elements: unknown[], coords: { x: number; y: number }): void;
                };
                options: ChartInternalOptions;
                resize(): void;
                update(mode?: string): void;
            }

            const chartTyped = assetChart as unknown as ChartInternalInstance;

            // Force-hide the tooltip
            if (chartTyped.tooltip?.setActiveElements) {
                chartTyped.tooltip.setActiveElements([], { x: 0, y: 0 });
            }

            // Disable animation (to prevent flickering)
            const origAnimation = chartTyped.options.animation;
            chartTyped.options.animation = false;

            const legendLabels = chartTyped.options.plugins?.legend?.labels;
            const xTicks = chartTyped.options.scales?.x?.ticks;
            const yTicks = chartTyped.options.scales?.y?.ticks;

            const origLegendSize = legendLabels?.font?.size;
            const origXTickSize = xTicks?.font?.size;
            const origYTickSize = yTicks?.font?.size;
            const origMaxRotation = xTicks?.maxRotation;
            const origMinRotation = xTicks?.minRotation;

            // Maximize font sizes for saving (sized to harmonize with other items at 1080px width)
            if (legendLabels?.font) legendLabels.font.size = 38;
            if (xTicks?.font) xTicks.font.size = 34;
            if (yTicks?.font) yTicks.font.size = 34;
            
            // Tilt X-axis labels 36 degrees only in English mode (Japanese mode maintains horizontal display, which is auto-detected)
            if (!isJa && xTicks) {
                xTicks.maxRotation = 36;
                xTicks.minRotation = 36;
            }

            chartTyped.resize();
            chartTyped.update('none');

            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => setTimeout(r, 200));

            const chartDataUrl = chartCanvas.toDataURL('image/png', 1.0);

            // Restore size and font
            if (legendLabels?.font && origLegendSize !== undefined) legendLabels.font.size = origLegendSize;
            if (xTicks?.font && origXTickSize !== undefined) xTicks.font.size = origXTickSize;
            if (yTicks?.font && origYTickSize !== undefined) yTicks.font.size = origYTickSize;
            if (!isJa && xTicks) {
                xTicks.maxRotation = origMaxRotation;
                xTicks.minRotation = origMinRotation;
            }

            chartContainer.style.width = origWidth;
            chartContainer.style.height = origHeight;
            chartCard.style.overflow = origCardOverflow;
            chartCard.style.height = origCardHeight;

            // Restore animation settings
            chartTyped.options.animation = origAnimation;
            chartTyped.resize();
            chartTyped.update('none');

            const capImg = document.getElementById('capChartImg') as HTMLImageElement | null;
            if (!capImg) throw new Error("Preview image element not found (capChartImg not found)");
            capImg.src = chartDataUrl;
        }

        await new Promise(r => setTimeout(r, 300));

        // 3. Capture the off-screen container with html2canvas
        const container = document.getElementById('captureContainer') as HTMLElement | null;
        if (!container) throw new Error("Export template not found (captureContainer not found)");

        const html2canvasFn = typeof window !== 'undefined' ? (window.html2canvas || html2canvas) : undefined;
        if (!html2canvasFn) throw new Error("html2canvas not loaded");

        const canvas = await html2canvasFn(container, {
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

    } catch (err: unknown) {
        console.error("Image save error details:", err);
        const errorObj = err as { message?: string };
        const msg = errorObj.message || String(err);
        const reason = msg.startsWith('error.') ? t(msg) : msg;
        alert(t('error.imageFailed', [reason]));
        // Immediately restore on error
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ====================================================================
// Share to X (Twitter)
// ====================================================================
export function shareToX(): void {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const p = getParamsFromDom();
    const s = lastSimResult.successRate.toFixed(1);
    const pctInput = document.getElementById('percentileInput') as HTMLInputElement | null;
    const url = buildSimulationUrl(p, getShareUrlOptions({
        seed: lastSimResult.usedSeed,
        percentileRaw: pctInput ? pctInput.value : '',
        lang: getLanguage()
    }));
    const text = t('share.x.template', [
        formatCurrency(p.initialRiskAsset, '\u5104\u5186'),
        formatCurrency(p.initialCashBuffer, '\u4e07\u5186'),
        formatCurrency(p.monthlyExpense, '\u4e07\u5186'),
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
export function openCompareTab(): void {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const p = getParamsFromDom();
    const pctInput = document.getElementById('percentileInput') as HTMLInputElement | null;
    const url = buildSimulationUrl(p, getCompareUrlOptions({
        seed: lastSimResult.usedSeed,
        percentileRaw: pctInput ? pctInput.value : '',
        lang: getLanguage()
    }));
    window.open(url.toString(), '_blank');
}

// ====================================================================
// Copy the simulation URL to the clipboard
// ====================================================================
export async function copySimUrl(): Promise<void> {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult || getIsResultDirty()) return;
    const btn = document.getElementById('copySimUrlBtn') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    const originalHtml = btn.innerHTML;
    const p = getParamsFromDom();
    const pctInput = document.getElementById('percentileInput') as HTMLInputElement | null;
    const url = buildSimulationUrl(p, getCopyUrlOptions({
        seed: lastSimResult.usedSeed,
        percentileRaw: pctInput ? pctInput.value : '',
        lang: getLanguage()
    }));
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
export function syncBaseToAnalysis(): void {
    const lastSimResult = getLastSimResult();
    const lastExecutedParams = getLastExecutedParams();
    if (!lastSimResult || !lastExecutedParams) return;
    const ep = convertToEffectiveParams(lastExecutedParams, lastSimResult);
    import('../analysis-state.js').then(AS => {
        AS.setBaseContext({
            source: 'LAST_MAIN_RUN',
            effectiveParams: ep,
            summary: {
                successRatePct: lastSimResult.successRate,
                finalMedianJpy: lastSimResult.finalMedian,
                worst10MaxDdPct: lastSimResult.worst10MaxDd
            }
        }, ep);
        import('../analysis-ui.js').then(AUI => AUI.renderAnalysisTab()).catch(e => console.error(e));
    }).catch(e => console.error(e));
}

export function syncBaseToAnalysisIfOpen(): void {
    const tab = document.getElementById('analysisTab');
    if (tab && !tab.classList.contains('hidden')) syncBaseToAnalysis();
}

// ====================================================================
// Convert to effective parameters
// ====================================================================
export function convertToEffectiveParams(
    params: SimulationParams,
    simResult?: AggregatedMetrics | null
): BaseEffectiveParams {
    return {
        initialRiskAsset: params.initialRiskAsset,
        initialCashBuffer: params.cashBufferToggle ? params.initialCashBuffer : 10_000_000,
        monthlyExpense: params.monthlyExpense,
        expectedReturn: params.expectedReturn,
        volatility: params.volatility,
        inflationRate: params.inflationRate,
        simYears: params.simYears,
        simPaths: params.simPaths,
        seed: simResult?.usedSeed !== undefined ? simResult.usedSeed : params.seedNum,
        modelType: params.useTDistribution ? 'log-t' : 'log-normal',
        dfMode: params.simDfManual ? 'manual' : 'auto',
        simDfManual: Boolean(params.simDfManual),
        simDfNum: params.useTDistribution ? params.simDfNum : 4.0,
        usedDf: simResult?.usedDf !== undefined ? simResult.usedDf : (params.simDfManual ? params.simDfNum : 4.0),
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
