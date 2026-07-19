// js/analysis-ui.js
// Analysis tab UI control

import * as AS from './analysis-state.js';
import { setProgressCallback, getProgressCallback } from './simulation-engine.js';
import { t, formatCurrency, formatPercent, formatYears, formatNumber, getLanguage } from './i18n.js';

// ====================================================================
// Main rendering
// ====================================================================
export function renderAnalysisTab() {
    renderBaseCard();

    // Show/hide error message (#3)
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

    // Enable/disable the ZIP export button
    const exportBtn = document.getElementById('exportZipBtn');
    if (exportBtn) {
        exportBtn.disabled = !AS.getAnalysisResult();
        exportBtn.textContent = t('analysis.exportZip');
    }

    renderCompareCards();
}

// ====================================================================
// Card 1: Base scenario
// ====================================================================
function renderBaseCard() {
    const bp = AS.getBaseEffectiveParams();
    if (!bp) {
        document.getElementById('card1Summary').innerHTML = `<p class="text-slate-500 text-sm">${t('analysis.noBaseContext')}</p>`;
        const detailEl = document.getElementById('card1Detail');
        if (detailEl) detailEl.classList.add('hidden');
        return;
    }

    // --- KPI summary (from analysis results or the most recent simulation) ---
    let kpiHtml = '';
    const result = AS.getAnalysisResult();
    if (result && result.baseScenario && result.baseScenario.metrics) {
        const m = result.baseScenario.metrics;
        kpiHtml = `
        <div class="pt-1">
             <p>${t('analysis.target.metricLabels.successRate')} <span class="font-bold text-emerald-400">${m.success_rate_pct.toFixed(1)}%</span></p>
             <p>${t('summary.finalMedian')} <span class="font-bold text-blue-300">${formatCurrency(m.final_median_jpy, '億円')}</span></p>
         </div>`;
    } else {
        // Analysis not yet run → display the most recent simulation KPIs from baseContext
        const ctx = AS.getState().baseContext;
        if (ctx && ctx.summary) {
            const s = ctx.summary;
            kpiHtml = `
            <div class="pt-1">
                <p>${t('analysis.target.metricLabels.successRate')} <span class="font-bold text-emerald-400">${s.successRatePct.toFixed(1)}%</span></p>
                <p>${t('summary.finalMedian')} <span class="font-bold text-blue-300">${formatCurrency(s.finalMedianJpy, '億円')}</span></p>
            </div>`;
        } else {
            kpiHtml = `<p class="text-slate-500 text-sm">${t('analysis.noBaseContext')}</p>`;
        }
    }

    // --- Condition list (always displayed) ---
    const detailHtml = `
        <div class="space-y-1">
            <p>${t('summary.riskAsset')}: ${formatCurrency(bp.initialRiskAsset, '億円')}</p>
            <p>${t('summary.cashBuffer')}: ${bp.cashBufferToggle ? formatCurrency(bp.initialCashBuffer, '万円') : t('summary.off')}</p>
            <p>${t('summary.expense')}: ${formatCurrency(bp.monthlyExpense, '万円')}</p>
            <p>${t('summary.returnVol')}: ${bp.expectedReturn.toFixed(1)}% / ${bp.volatility.toFixed(1)}%</p>
            <p>${t('summary.inflation')}: ${bp.inflationRate.toFixed(1)}%</p>
            <p>${t('summary.simSettings')}: ${formatYears(bp.simYears)} / ${formatNumber(bp.simPaths)} ${t('unit.paths')}</p>
            <p>${t('summary.model.label')}: ${bp.modelType === 'log-t' ? t('summary.model.logt') : t('summary.model.lognormal')}</p>
            <p>${t('summary.cbSettings')}: ${bp.cashBufferToggle ? t('cb.on') : t('cb.off')} | ${t('gr.title')}: ${bp.guardrailToggle ? t('gr.on') : t('gr.off')}</p>
            <p>${t('summary.seed')}: ${bp.seed}</p>
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
// Factor selector
// ====================================================================
function renderFactorSelector() {
    const container = document.getElementById('factorSelector');
    const selected = AS.getSelectedFactors();
    const available = AS.getAvailableFactors();
    document.getElementById('selectedFactorCount').textContent = t('analysis.selectedCount', [selected.length]);
    document.getElementById('scenarioCount').textContent = t('analysis.scenarioCount', [AS.getScenarioCount()]);
    document.getElementById('runAnalysisBtn').disabled = selected.length === 0 || AS.getState().isRunning;
    document.getElementById('runAnalysisBtn').textContent = t('analysis.run');

    // Dynamic update of execution time estimate (#5)
    const bp = AS.getBaseEffectiveParams();
    if (bp) {
        const totalScenarios = AS.getScenarioCount();
        const paths = bp.simPaths || 10000;
        const years = bp.simYears || 30;
        let estMs = 0;
        if (window.lastSimOnlyMs) {
            estMs = window.lastSimOnlyMs * totalScenarios;
        } else {
            // Safety net when no measured value is available (should not occur in the normal flow)
            estMs = (paths * years) / (10000 * 30) * 350 * totalScenarios;
        }
        document.getElementById('estTime').textContent = Math.ceil(estMs / 1000) + ' ' + t('unit.seconds');
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
                    <span class="text-sm font-medium text-slate-200 truncate">${t(f.labelKey)}</span>
                    <span class="text-xs text-slate-400 block mt-0.5">${(() => {
                const baseVal = AS.getFactorBaseValue(f.key);
                const displayVal = fmtFactorVal(f, baseVal);
                const isCurrencyFactor = f.unitKey === 'unit.oku' || f.unitKey === 'unit.man';
                const isEnglish = getLanguage() === 'en';
                const skipUnit = isEnglish && f.unitKey === 'unit.multiplier';
                const showUnit = !skipUnit && ((getLanguage() === 'ja') || !isCurrencyFactor);
                const unitSuffix = showUnit ? ` ${t(f.unitKey)}` : '';
                return `${t('analysis.factorBaseSuffix')}: ${displayVal}${unitSuffix}`;
            })()}</span>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <span class="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">${t(f.categoryKey)}</span>
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
        return `<span class="text-xs ${isBase ? 'bg-indigo-900/40 text-indigo-300 font-bold' : 'bg-slate-700/80 text-slate-300'} px-2 py-1 rounded">${fmtFactorVal(factor, v)}${isBase ? ' (' + t('analysis.factorBaseSuffix') + ')' : ''}</span>`;
    }).join('')}
        </div>
    </div>`;
}

function fmtFactorVal(factor, value) {
    if (value === null || value === undefined) return '-';
    const lang = getLanguage();

    if (lang === 'ja') {
        return value.toLocaleString('ja-JP', {
            minimumFractionDigits: factor.decimals,
            maximumFractionDigits: factor.decimals
        });
    }

    // English mode: convert only currency-unit factors to USD, otherwise use numeric format
    const isCurrency = factor.unitKey === 'unit.oku' || factor.unitKey === 'unit.man';
    if (isCurrency) {
        const valueInJPY = value * (factor.scale || 1);
        return formatCurrency(valueInJPY, '円');
    }

    // Multiplier factor (unit.multiplier): append 'x' without a space
    if (factor.unitKey === 'unit.multiplier') {
        const numStr = value.toLocaleString('en-US', {
            minimumFractionDigits: factor.decimals,
            maximumFractionDigits: factor.decimals
        });
        return numStr + 'x';
    }

    return value.toLocaleString('en-US', {
        minimumFractionDigits: factor.decimals,
        maximumFractionDigits: factor.decimals
    });
}

// ====================================================================
// Target table (improvement factor variation amount)
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

    // Calculate success rate improvement margin and update the select box display
    const successRateDelta = AS.getSuccessRateTargetDelta(baseMetrics.success_rate_pct);
    const targetMetricOptionSuccess = document.getElementById('targetMetricOptionSuccess');
    if (targetMetricOptionSuccess && successRateDelta > 0) {
        targetMetricOptionSuccess.textContent = t('analysis.target.metric.successRate', [successRateDelta.toFixed(0)]);
    }

    // If FIRE success rate is 95% or above and the metric is success rate
    if (metric === 'success_rate_pct' && baseMetrics.success_rate_pct >= 95) {
        document.getElementById('targetTableWrapper').innerHTML = `<p class="text-center text-slate-400 py-6">${t('analysis.successRateHigh')}</p>`;
        document.getElementById('targetMetricLabel').textContent = t('analysis.target.metricLabels.successRate');
        document.getElementById('currentMetricValue').textContent = baseMetrics.success_rate_pct.toFixed(1) + '%';
        return;
    }

    // Display the standard table
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
                    <th class="p-2 text-xs text-slate-400 text-center">${t('analysis.target.factorCol')}</th>
                    <th class="p-2 text-right text-xs text-slate-400">${t('analysis.target.current')}</th>
                    <th class="p-2 text-right text-xs text-slate-400">${t('analysis.target.need')}</th>
                    <th class="p-2 text-right text-xs text-slate-400">${t('analysis.target.after')}</th>
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
        success_rate_pct: t('analysis.target.metricLabels.successRate'),
        final_p10_jpy: t('analysis.target.metricLabels.finalP10'),
        worst10_max_dd: t('analysis.target.metricLabels.worst10MaxDd')
    };
    const displayFns = {
        success_rate_pct: v => v.toFixed(1) + '%',
        final_p10_jpy: v => formatCurrency(v, '億円'),
        worst10_max_dd: v => (v * 100).toFixed(1) + '%'
    };
    document.getElementById('targetMetricLabel').textContent = labels[metric];
    document.getElementById('currentMetricValue').textContent = displayFns[metric](baseMetrics[metric]);

    // Dynamic improvement margin calculation
    const deltas = {
        success_rate_pct: AS.getSuccessRateTargetDelta(baseMetrics.success_rate_pct),
        final_p10_jpy: 20_000_000,
        worst10_max_dd: 0.05
    };

    const targetValue = baseMetrics[metric] + deltas[metric];

    const body = document.getElementById('targetTableBody');
    if (!body) return;

    const selected = AS.getSelectedFactors();
    // Sort in FACTORS definition order
    const factorOrder = AS.FACTORS.map(f => f.key);
    selected.sort((a, b) => factorOrder.indexOf(a) - factorOrder.indexOf(b));

    if (selected.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="text-center text-slate-500 p-4">${t('analysis.noFactors')}</td></tr>`;
        return;
    }

    let html = '';
    for (const key of selected) {
        const factor = AS.FACTORS.find(f => f.key === key);
        const results = perFactorResults[key];
        if (!results) continue;

        const baseVal = AS.getFactorBaseValue(key);

        // Create a point for the base value (level: 0)
        const basePoint = {
            factorValue: baseVal,
            metricValue: baseMetrics[metric]
        };

        // Generate 5 data points including the base value
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
            // Out of range
            const isCurrencyFactor = factor.unitKey === 'unit.oku' || factor.unitKey === 'unit.man';
            const isEnglish = getLanguage() === 'en';
            const skipUnit = isEnglish && factor.unitKey === 'unit.multiplier';
            const showUnit = !skipUnit && ((getLanguage() === 'ja') || !isCurrencyFactor);
            const unitSuffix = showUnit ? ` ${t(factor.unitKey)}` : '';
            html += `<tr class="border-b border-slate-700/30">
                <td class="p-2 font-medium text-slate-200">${t(`analysis.factors.${factor.key}`)}</td>
                <td class="p-2 text-right text-slate-300">${fmtFactorVal(factor, baseVal)}${unitSuffix}</td>
                <td class="p-2 text-center text-slate-500 text-xs" colspan="2">${t('analysis.outOfRange')}</td>
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
            // Conditional display of unit (hide unit in English mode for currency-attribute factors)
            const isCurrencyFactor = factor.unitKey === 'unit.oku' || factor.unitKey === 'unit.man';
            const isEnglish = getLanguage() === 'en';
            const skipUnit = isEnglish && factor.unitKey === 'unit.multiplier';
            const showUnit = !skipUnit && ((getLanguage() === 'ja') || !isCurrencyFactor);
            const unitSuffix = showUnit ? ` ${t(factor.unitKey)}` : '';
            html += `<tr class="border-b border-slate-700/30">
                <td class="p-2 font-medium text-slate-200">${t(`analysis.factors.${factor.key}`)}</td>
                <td class="p-2 text-right text-slate-300">${fmtFactorVal(factor, baseVal)}${unitSuffix}</td>
                <td class="p-2 text-right ${deltaColor} font-mono text-xs">${deltaPrefix}${fmtFactorVal(factor, delta)}${unitSuffix}</td>
                <td class="p-2 text-right text-slate-200">${fmtFactorVal(factor, requiredFactorValue)}${unitSuffix}</td>
                <td></td>
            </tr>`;
        }
    }
    body.innerHTML = html;
}

// ====================================================================
// Per-factor comparison table
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
    // Sort in FACTORS definition order
    const factorOrder = AS.FACTORS.map(f => f.key);
    selected.sort((a, b) => factorOrder.indexOf(a) - factorOrder.indexOf(b));

    if (selected.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm p-4">${t('analysis.noFactors')}</p>`;
        return;
    }

    // Get base metrics (#9)
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
        // Add the base level (level:0) manually
        const augmentedRes = [...res, { level: 0, metrics: baseMetrics }];
        // Get H2 / L2 level metrics (for trend determination)
        const rPlus2 = augmentedRes.find(r => r.level === 2)?.metrics;
        const rMinus2 = augmentedRes.find(r => r.level === -2)?.metrics;

        // ---- Helper functions (v2.1.0 unchanged) ----
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

        // ---- HTML generation (complete reproduction of v2.1.0) ----
        html += `<div class="glass-card compare-card rounded-xl">`;
        html += `<div class="compare-header-row">
            <div class="text-center">${t(`analysis.factors.${factor.key}`)}</div>
            <div class="text-center">${t('analysis.compare.headers.successRate')}</div>
            <div class="text-center">${t('analysis.compare.headers.finalP10')}</div>
            <div class="text-center">${t('analysis.compare.headers.worst10MaxDd')}</div>
        </div>`;

        const baseVal = AS.getFactorBaseValue(key);
        const levels = [2, 1, 0, -1, -2];
        for (const level of levels) {
            const r = augmentedRes.find(r => r.level === level);
            if (!r) continue;
            const val = baseVal + factor.step * level;
            const m = r.metrics;
            const isBase = level === 0;

            // Calculate bar classes and colors for each metric
            const successBarClass = barClassFromTrend(level, rPlus2?.success_rate_pct, rMinus2?.success_rate_pct, isBase);
            const p10BarClass = barClassFromTrend(level, rPlus2?.final_p10_jpy, rMinus2?.final_p10_jpy, isBase);
            const ddBarClass = barClassFromTrend(level, rPlus2?.worst10_max_dd, rMinus2?.worst10_max_dd, isBase);
            const successColors = getMetricColorClasses(successBarClass);
            const p10Colors = getMetricColorClasses(p10BarClass);
            const ddColors = getMetricColorClasses(ddBarClass);

            // Bar width (strictly follow the v2.1.0 formula)
            const successWidth = Math.max(0, Math.min(100, ((m.success_rate_pct - 70) / (100 - 70)) * 100)).toFixed(0);
            const p10Width = (m.final_p10_jpy / maxP10 * 100).toFixed(0);
            const ddAbsWidth = (Math.abs(m.worst10_max_dd) / maxAbsDD * 100).toFixed(0);
            const ddPercent = (m.worst10_max_dd * 100).toFixed(1);

            html += `<div class="compare-row">`;
            // ---- Factor value display (existing logic maintained; the following is an example implementation from v2.1.0) ----
            const isCurrencyFactor = factor.unitKey === 'unit.oku' || factor.unitKey === 'unit.man';
            const isEnglish = getLanguage() === 'en';
            const skipUnit = isEnglish && factor.unitKey === 'unit.multiplier';
            const showUnit = !skipUnit && ((getLanguage() === 'ja') || !isCurrencyFactor);
            const unitSuffix = showUnit ? ` ${t(factor.unitKey)}` : '';
            html += `<div class="setting-cell">
                <span class="setting-value">${fmtFactorVal(factor, val)}${unitSuffix}</span>
                ${isBase ? `<span class="base-badge">${t('analysis.compare.badge')}</span>` : ''}
            </div>`;
            // ---- Success rate bar ----
            html += `<div class="bar-stack">
                <div class="bar-track"><div class="bar-fill ${successColors.bar}" style="width:${successWidth}%"></div></div>
                <span class="bar-value ${successColors.text}">${m.success_rate_pct.toFixed(1)}%</span>
            </div>`;
            // ---- Final asset 10th percentile bar ----
            html += `<div class="bar-stack">
                <div class="bar-track"><div class="bar-fill ${p10Colors.bar}" style="width:${p10Width}%"></div></div>
                <span class="bar-value ${p10Colors.text}">${formatCurrency(m.final_p10_jpy, '億円')}</span>
            </div>`;
            // ---- Max DD 10th percentile bar (note the track class for DD) ----
            html += `<div class="bar-stack">
                <div class="dd-bar-track"><div class="dd-bar-fill ${ddColors.bar}" style="width:${ddAbsWidth}%"></div></div>
                <span class="bar-value text-right ${ddColors.text}">${ddPercent}%</span>
            </div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
}

// ====================================================================
// Event delegation
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

    // Register ZIP export button event
    document.getElementById('exportZipBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('exportZipBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = t('analysis.zipping');
        try {
            const { generateAndDownloadZip } = await import('./analysis-output.js');
            await generateAndDownloadZip();
            btn.textContent = t('zipDone');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        } catch (e) {
            console.error('ZIP output error:', e);
            const reason = e.message.startsWith('error.') ? t(e.message) : e.message;
            alert(t('error.zipFailed', [reason]));
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// Test-only: reset the delegationDone flag
export function _resetDelegationForTest() {
    delegationDone = false;
}



async function executeAnalysis() {
    if (AS.getState().isRunning) return;
    AS.setRunning(true);
    const btn = document.getElementById('runAnalysisBtn');
    btn.disabled = true;
    btn.textContent = t('analysis.running', ['0']);

    // Disable the simulation tab's progress callback while analysis is running (#10)
    const savedCallback = getProgressCallback();
    setProgressCallback(null);

    try {
        const { runAnalysis } = await import('./analysis-runner.js');
        const result = await runAnalysis(progress => {
            const pct = Math.round((progress.done / progress.total) * 100);
            btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${t('analysis.running', [pct])}`;
            btn.style.background = `linear-gradient(to right, rgba(99,102,241,0.8) ${pct}%, rgb(30,41,59) ${pct}%)`;
        });
        AS.setAnalysisResult(result);
    } catch (e) {
        const msg = e.message.startsWith('error.') ? t(e.message) : e.message;
        AS.setErrorMessage(msg);
    } finally {
        // Restore the progress callback (#10)
        setProgressCallback(savedCallback);
        btn.disabled = AS.getSelectedFactors().length === 0;
        btn.textContent = t('analysis.run');
        btn.style.background = '';
        renderAnalysisTab();
        // Auto-scroll after analysis execution (#2)
        setTimeout(() => {
            const target = document.getElementById('cardTarget');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}
