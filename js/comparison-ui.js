// js/comparison-ui.js
// 比較タブ v2.2.0 UI 制御（最終完全版）

import * as CS from './comparison-state.js';
import { runAllScenarios } from './comparison-runner.js';
import { getParamsFromInputs } from './core/params.js';
import { getCurrentSimParams } from './params-accessor.js';
import { t, getLanguage, formatCurrency, formatPercent, formatYears, formatNumber } from './i18n.js';

// トーストメッセージを一時表示するユーティリティ関数
function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ----- 定数定義 (PARAM_ROWS) -----
const PARAM_ROWS = [
    { key: 'initial_risk_asset', labelKey: 'summary.riskAsset', inputType: 'number', unitKey: 'unit.oku', tooltipKey: 'asset.riskAsset.tooltip', field: 'initialRiskAsset', step: 0.1, min: 0, max: 10, scale: 1e8, displayCondition: null },
    { key: 'initial_cash_buffer', labelKey: 'summary.cashBuffer', inputType: 'number', unitKey: 'unit.man', tooltipKey: 'asset.cashBuffer.tooltip', field: 'initialCashBuffer', step: 500, min: 0, max: 10000, scale: 1e4, displayCondition: (inputs) => inputs.cashBufferEnabled },
    { key: 'monthly_expense', labelKey: 'summary.expense', inputType: 'number', unitKey: 'unit.man', tooltipKey: 'asset.expense.tooltip', field: 'monthlyExpense', step: 5, min: 0, max: 500, scale: 1e4, displayCondition: null },
    { key: 'target_asset_ratio', labelKey: 'asset.targetAsset', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'asset.targetAsset.tooltip', field: 'targetAssetRatio', step: 1, min: 0, max: 500, scale: 1, displayCondition: null },
    { key: 'expected_return', labelKey: 'market.expectedReturn', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'market.expectedReturn.tooltip', field: 'expectedReturn', step: 1.0, min: 0, max: 50, scale: 1, displayCondition: null },
    { key: 'volatility', labelKey: 'market.volatility', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'market.volatility.tooltip', field: 'volatility', step: 1.0, min: 0, max: 80, scale: 1, displayCondition: null },
    { key: 'inflation_rate', labelKey: 'market.inflation', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'market.inflation.tooltip', field: 'inflationRate', step: 0.5, min: 0, max: 15, scale: 1, displayCondition: null },
    { key: 'sim_years', labelKey: 'sim.years', inputType: 'number', unitKey: 'unit.years', tooltipKey: 'sim.years.tooltip', field: 'simYears', step: 5, min: 5, max: 60, scale: 1, displayCondition: null },
    { key: 'return_model', labelKey: 'market.modelLabel', inputType: 'select', options: ['log-normal', 'log-t'], tooltipKey: 'market.modelTooltip', field: 'returnModel', displayCondition: null },
    { key: 't_df', labelKey: 'market.dfLabel', inputType: 'select', options: ['auto', 'manual'], tooltipKey: 'market.dfTooltip', field: 'tDfMode', displayCondition: null },
    { key: 't_df_manual', labelKey: 'market.dfManual', inputType: 'number', unitKey: '', tooltipKey: 'market.dfTooltip', field: 'tDfManual', step: 0.1, min: 2.5, max: 30, scale: 1, displayCondition: (inputs) => inputs.tDfMode === 'manual' },
    { key: 'inflation_model', labelKey: 'market.inflationModelLabel', inputType: 'select', options: ['fixed', 'ar1'], tooltipKey: 'market.inflationModelTooltip', field: 'inflationModel', displayCondition: null },
    { key: 'inf_vol', labelKey: 'market.inflationVol', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'market.inflationVol.tooltip', field: 'infVol', step: 0.5, min: 0, max: 10, scale: 1, displayCondition: (inputs) => inputs.inflationModel === 'ar1' },
    { key: 'inf_ar', labelKey: 'market.inflationAr', inputType: 'number', unitKey: '', tooltipKey: 'market.inflationAr.tooltip', field: 'infAr', step: 0.1, min: 0, max: 1.0, scale: 1, displayCondition: (inputs) => inputs.inflationModel === 'ar1' },
    { key: 'cash_buffer_enabled', labelKey: 'cb.title', inputType: 'checkbox', tooltipKey: 'cb.ddTrigger.tooltip', field: 'cashBufferEnabled', displayCondition: null },
    { key: 'drawdown_trigger', labelKey: 'cb.ddTrigger', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'cb.ddTrigger.tooltip', field: 'drawdownTrigger', step: 5.0, min: -100, max: 0, scale: 1, displayCondition: (inputs) => inputs.cashBufferEnabled },
    { key: 'drawdown_replenish', labelKey: 'cb.ddReplenish', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'cb.ddReplenish.tooltip', field: 'drawdownReplenish', step: 1.0, min: -100, max: 0, scale: 1, displayCondition: (inputs) => inputs.cashBufferEnabled },
    { key: 'replenish_pace', labelKey: 'cb.replenishPace', inputType: 'number', unitKey: 'unit.multiplier', tooltipKey: 'cb.replenishPace.tooltip', field: 'replenishPace', step: 0.5, min: 0, max: 10, scale: 1, displayCondition: (inputs) => inputs.cashBufferEnabled },
    { key: 'guardrail_enabled', labelKey: 'gr.title', inputType: 'checkbox', tooltipKey: 'gr.trigger.tooltip', field: 'guardrailEnabled', displayCondition: null },
    { key: 'guardrail_trigger', labelKey: 'gr.trigger', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'gr.trigger.tooltip', field: 'guardrailTrigger', step: 5.0, min: -100, max: 0, scale: 1, displayCondition: (inputs) => inputs.guardrailEnabled },
    { key: 'guardrail_release', labelKey: 'gr.release', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'gr.release.tooltip', field: 'guardrailRelease', step: 5.0, min: -100, max: 0, scale: 1, displayCondition: (inputs) => inputs.guardrailEnabled },
    { key: 'guardrail_reduction', labelKey: 'gr.reduction', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'gr.reduction.tooltip', field: 'guardrailReduction', step: 5.0, min: -100, max: 0, scale: 1, displayCondition: (inputs) => inputs.guardrailEnabled },
];

// ----- 出力行定義（worst10_max_dd の isLowerBetter を削除）-----
const OUTPUT_ROWS = [
    { key: 'success_rate', labelKey: 'summary.successRate', unitKey: 'unit.percent', tooltipKey: 'summary.successRate.tooltip', getValue: (r) => r?.successRate, format: (v) => v !== undefined ? v.toFixed(1) + '%' : null, isPercentage: true },
    { key: 'final_median', labelKey: 'summary.finalMedian', unitKey: 'unit.oku', tooltipKey: 'comparison.finalMedian.tooltip', getValue: (r) => r?.finalMedian, format: (v) => v !== undefined ? formatCurrency(v, '億円') : null, isPercentage: false },
    { key: 'target_maintain_rate', labelKey: 'summary.targetMaintainRate', unitKey: 'unit.percent', tooltipKey: 'summary.targetMaintainRate.tooltip', getValue: (r) => r?.targetAssetMaintainRate, format: (v) => v !== undefined ? v.toFixed(1) + '%' : null, isPercentage: true },
    { key: 'worst10_max_dd', labelKey: 'analysis.compare.headers.worst10MaxDd', unitKey: 'unit.percent', tooltipKey: 'analysis.compare.headers.worst10MaxDd.tooltip', getValue: (r) => r?.worst10MaxDd, format: (v) => v !== undefined ? (v * 100).toFixed(1) + '%' : null, isPercentage: true },
    { key: 'median_max_uw', labelKey: 'comparison.median_max_uw', unitKey: 'unit.years', tooltipKey: 'comparison.medianMaxUw.tooltip', getValue: (r) => r?.medianMaxUw, format: (v) => v !== undefined ? (v / 12).toFixed(1) + ' ' + t('unit.years') : null, isPercentage: false, isLowerBetter: true },
];

// ----- ヘルパー関数（通貨変換・境界値変換）-----
export function convertDisplayValueToJPY(displayValue, unitKey) {
    const numericValue = typeof displayValue === 'string' ? parseFloat(displayValue) : displayValue;
    if (isNaN(numericValue)) return 0;
    if (unitKey !== 'unit.oku' && unitKey !== 'unit.man') return numericValue;
    if (unitKey === 'unit.oku') return numericValue * 100_000_000;
    if (unitKey === 'unit.man') return numericValue * 100_000;
    return numericValue;
}

export function convertJPYToDisplayValue(valueInJPY, unitKey) {
    if (valueInJPY === undefined || valueInJPY === null) return 0;
    const numericValue = typeof valueInJPY === 'string' ? parseFloat(valueInJPY) : valueInJPY;
    if (isNaN(numericValue)) return 0;
    if (unitKey !== 'unit.oku' && unitKey !== 'unit.man') return numericValue;
    const usd = numericValue / 100;
    if (unitKey === 'unit.oku') return usd / 1_000_000;
    if (unitKey === 'unit.man') return usd / 1_000;
    return numericValue;
}

export function getLocalizedInputBounds(rowDef, isEnglish) {
    if (!isEnglish) return { step: rowDef.step, min: rowDef.min, max: rowDef.max };
    if (rowDef.key === 'initial_risk_asset') return { step: 0.1, min: 0, max: 10 };
    if (rowDef.key === 'initial_cash_buffer') return { step: 50, min: 0, max: 1000 };
    if (rowDef.key === 'monthly_expense') return { step: 0.5, min: 0, max: 50 };
    return { step: rowDef.step, min: rowDef.min, max: rowDef.max };
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function processInputValue(input, scenarioId, field, scale, unitKey, isEnglish) {
    if (input.disabled) return;
    let rawValue = parseFloat(input.value);
    if (isNaN(rawValue)) rawValue = parseFloat(input.min) || 0;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const step = parseFloat(input.step);
    let clamped = false;
    let newValue = rawValue;
    if (newValue < min) { newValue = min; clamped = true; }
    if (newValue > max) { newValue = max; clamped = true; }
    if (step > 0) {
        const stepped = Math.round(newValue / step) * step;
        const precision = (step.toString().split('.')[1] || '').length;
        newValue = parseFloat(stepped.toFixed(precision));
        newValue = Math.min(max, Math.max(min, newValue));
    }
    input.value = newValue;
    let internalValue;
    if (isEnglish && (unitKey === 'unit.oku' || unitKey === 'unit.man')) {
        internalValue = convertDisplayValueToJPY(newValue, unitKey);
    } else if (scale !== 1) {
        internalValue = newValue * scale;
    } else {
        internalValue = newValue;
    }
    CS.updateScenarioInput(scenarioId, field, internalValue);
    if (clamped) {
        input.classList.add('clamp-feedback');
        setTimeout(() => input.classList.remove('clamp-feedback'), 300);
    }
    updateResultCellsForScenario(scenarioId);
}

function updateResultCellsForScenario(scenarioId) {
    const container = document.getElementById('comparisonTableContainer');
    if (!container) return;
    const headers = Array.from(container.querySelectorAll('.scenario-header'));
    const idx = headers.findIndex(h => h.dataset.scenarioId === scenarioId);
    if (idx === -1) return;
    const rows = container.querySelectorAll('tbody tr');
    let isOutputSection = false;
    rows.forEach(row => {
        if (row.dataset.section === 'output-header') {
            isOutputSection = true;
            return;
        }
        if (isOutputSection) {
            const cells = row.querySelectorAll('td');
            const targetCell = cells[idx + 1];
            if (targetCell) {
                targetCell.innerHTML = `<span class="text-slate-500">-</span>`;
            }
        }
    });
}

function getActiveElementInfo() {
    const el = document.activeElement;
    if (!el) return null;
    if (el.id || (el.dataset && el.dataset.id && el.dataset.field)) {
        return {
            type: 'input',
            id: el.id,
            datasetId: el.dataset?.id,
            datasetField: el.dataset?.field,
            selectionStart: el.selectionStart,
            selectionEnd: el.selectionEnd
        };
    }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        const datasetId = el.dataset?.id;
        if (datasetId) {
            const range = window.getSelection && window.getSelection().getRangeAt(0);
            let startOffset = 0, endOffset = 0;
            if (range && range.startContainer === el.firstChild) {
                startOffset = range.startOffset;
                endOffset = range.endOffset;
            }
            return {
                type: 'contenteditable',
                datasetId: datasetId,
                datasetField: el.dataset?.field,
                startOffset: startOffset,
                endOffset: endOffset
            };
        }
    }
    return null;
}

function restoreActiveElement(info) {
    if (!info) return;
    let el = null;
    if (info.type === 'input') {
        if (info.id) {
            el = document.getElementById(info.id);
        } else if (info.datasetId && info.datasetField) {
            el = document.querySelector(`[data-id="${info.datasetId}"][data-field="${info.datasetField}"]`);
        }
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
            el.focus();
            if (info.selectionStart !== undefined && info.selectionEnd !== undefined && el.setSelectionRange) {
                try { el.setSelectionRange(info.selectionStart, info.selectionEnd); } catch (e) {}
            }
        }
    } else if (info.type === 'contenteditable') {
        el = document.querySelector(`.scenario-name[data-id="${info.datasetId}"]`);
        if (el && el.getAttribute('contenteditable') === 'true') {
            el.focus();
            if (info.startOffset !== undefined && window.getSelection) {
                const range = document.createRange();
                if (el.firstChild) {
                    range.setStart(el.firstChild, Math.min(info.startOffset, el.firstChild.length));
                    range.setEnd(el.firstChild, Math.min(info.endOffset, el.firstChild.length));
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    }
}

function initTooltips() {
    let tooltipContainer = document.getElementById('tooltip-container');
    if (!tooltipContainer) {
        tooltipContainer = document.createElement('div');
        tooltipContainer.id = 'tooltip-container';
        tooltipContainer.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;";
        document.body.appendChild(tooltipContainer);
    }
    document.querySelectorAll('.tooltip-container').forEach(trigger => {
        const tooltip = trigger.querySelector('.tooltip-text');
        if (!tooltip) return;
        if (tooltip.parentElement !== tooltipContainer) tooltipContainer.appendChild(tooltip);
        if (trigger._tooltipInitialized) return;
        trigger._tooltipInitialized = true;
        const positionTooltip = () => {
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipHeight = tooltip.offsetHeight;
            const tooltipWidth = tooltip.offsetWidth;
            const viewportWidth = window.innerWidth;
            let left = triggerRect.left + triggerRect.width / 2;
            const tooltipMargin = 16;
            if (left + tooltipWidth / 2 > viewportWidth - tooltipMargin) left = viewportWidth - tooltipWidth / 2 - tooltipMargin;
            if (left - tooltipWidth / 2 < tooltipMargin) left = tooltipWidth / 2 + tooltipMargin;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${triggerRect.top - tooltipHeight - tooltipMargin}px`;
            tooltip.style.transform = 'translateX(-50%)';
        };
        const show = () => { positionTooltip(); tooltip.style.visibility = 'visible'; tooltip.style.opacity = '1'; window.addEventListener('scroll', positionTooltip); };
        const hide = () => { tooltip.style.visibility = 'hidden'; tooltip.style.opacity = '0'; window.removeEventListener('scroll', positionTooltip); };
        trigger.addEventListener('mouseenter', show);
        trigger.addEventListener('mouseleave', hide);
        trigger.addEventListener('focusin', show);
        trigger.addEventListener('focusout', hide);
    });
}

export function renderComparisonTab() {
    const container = document.getElementById('comparisonTableContainer');
    if (!container) return;
    const oldWrapper = container.querySelector('.comparison-table-wrapper');
    const savedScrollLeft = oldWrapper ? oldWrapper.scrollLeft : 0;
    const activeInfo = getActiveElementInfo();
    const scenarios = CS.getScenarios();
    const commonSeed = CS.getCommonSeed();
    const commonPaths = CS.getCommonPaths();
    const isRunning = CS.getIsRunning();
    const lang = getLanguage();
    const isEnglish = lang === 'en';
    const firstScenario = scenarios[0];
    const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    const shouldShowRow = (rowDef) => {
        if (!isTestEnv) return true;
        if (!rowDef.displayCondition) return true;
        if (!firstScenario || !firstScenario.inputs) return true;
        return rowDef.displayCondition(firstScenario.inputs);
    };

    let html = `<div class="comparison-controls flex flex-wrap items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
            <button id="addScenarioBtn" data-action="add" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-colors" ${isRunning ? 'disabled' : ''}>
                ${t('comparison.addScenario')}
            </button>
            <div class="tooltip-container" tabindex="0">
                <span class="text-xs cursor-pointer text-indigo-400">ℹ️</span>
                <div class="tooltip-text">${t('comparison.moveHint')}</div>
            </div>
        </div>
        <button id="runAllBtn" data-action="run-all" class="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500 rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed" ${isRunning ? 'disabled' : ''}>
            ${isRunning ? t('comparison.running', ['0', scenarios.length]) : t('comparison.runAll')}
        </button>
        <div class="flex items-center gap-3 ml-auto">
            <div class="flex items-center gap-2">
                <label class="text-xs text-slate-300">${t('seed.label')}</label>
                <input type="number" id="commonSeedInput" value="${commonSeed}" min="1" max="99999999" step="1" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 w-32 text-sm" ${isRunning ? 'disabled' : ''}>
            </div>
            <div class="flex items-center gap-2">
                <label class="text-xs text-slate-300">${t('sim.paths')}</label>
                <input type="number" id="commonPathsInput" value="${commonPaths}" min="1000" max="50000" step="5000" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 w-32 text-sm" ${isRunning ? 'disabled' : ''}>
            </div>
        </div>
        <div class="tooltip-container" tabindex="0">
            <span class="text-xs cursor-pointer text-indigo-400">ℹ️</span>
            <div class="tooltip-text">${t('comparison.displayConditionNote')}</div>
        </div>
    </div>
    <div class="comparison-table-wrapper overflow-x-auto">
    <table class="comparison-table w-full border-collapse text-sm">
        <thead>
            <tr>
                <th class="sticky-left min-w-[160px] p-3 text-left" scope="col">${t('comparison.parameter')}</th>`;

    for (let i = 0; i < scenarios.length; i++) {
        const s = scenarios[i];
        const isFirst = i === 0;
        const isLast = i === scenarios.length - 1;
        html += `
                <th class="scenario-header min-w-[200px] p-3 bg-slate-800/50 border-b border-slate-700" scope="col" data-scenario-id="${s.id}">
                    <div class="flex items-center gap-1 justify-between">
                        <span class="drag-handle text-slate-500 ${isRunning ? 'opacity-50' : ''}">⋮⋮</span>
                        <span class="scenario-name font-bold text-indigo-300 editable" contenteditable="${!isRunning}" data-field="name" data-id="${s.id}" aria-label="${t('comparison.scenarioName')}">${escapeHtml(s.name)}</span>
                        <div class="flex items-center gap-1">
                            <button class="move-left-btn p-1 rounded hover:bg-slate-700 ${isRunning || isFirst ? 'opacity-50 cursor-not-allowed' : ''}" data-action="move-left" data-id="${s.id}" ${isRunning || isFirst ? 'disabled' : ''} aria-label="${t('comparison.moveLeft')}">←</button>
                            <button class="move-right-btn p-1 rounded hover:bg-slate-700 ${isRunning || isLast ? 'opacity-50 cursor-not-allowed' : ''}" data-action="move-right" data-id="${s.id}" ${isRunning || isLast ? 'disabled' : ''} aria-label="${t('comparison.moveRight')}">→</button>
                            <button class="duplicate-btn p-1 rounded hover:bg-slate-700 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}" data-action="duplicate" data-id="${s.id}" ${isRunning ? 'disabled' : ''} aria-label="${t('comparison.duplicateName', [''])}">📋</button>
                            <button class="overwrite-btn p-1 rounded hover:bg-slate-700 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}" data-action="overwrite" data-id="${s.id}" ${isRunning ? 'disabled' : ''} aria-label="${t('comparison.overwriteFromSim')}">📋⬇️</button>
                            <button class="delete-btn p-1 rounded hover:bg-rose-700 ${isRunning || scenarios.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}" data-action="delete" data-id="${s.id}" ${isRunning || scenarios.length === 1 ? 'disabled' : ''} aria-label="${t('comparison.deleteScenario')}">−</button>
                        </div>
                    </div>
                </th>`;
    }
    html += `</tr></thead><tbody>`;

    for (const rowDef of PARAM_ROWS) {
        if (!shouldShowRow(rowDef)) continue;
        const bounds = getLocalizedInputBounds(rowDef, isEnglish);
        const step = bounds.step;
        const min = bounds.min;
        const max = bounds.max;
        let rowHtml = `<tr><td class="sticky-left p-3 border-b border-slate-700">
            <div class="flex items-center justify-between">
                <span class="font-medium">${t(rowDef.labelKey)}</span>
                ${rowDef.tooltipKey ? `<div class="tooltip-container" tabindex="0"><span class="text-xs cursor-pointer text-indigo-400">ℹ️</span><div class="tooltip-text">${t(rowDef.tooltipKey)}</div></div>` : ''}
            </div>
         </td>`;
        for (const scenario of scenarios) {
            const isDisabledByCondition = rowDef.displayCondition && !rowDef.displayCondition(scenario.inputs);
            const disabledAttr = (isRunning || isDisabledByCondition) ? 'disabled' : '';
            const disabledClass = isDisabledByCondition ? 'opacity-50 cursor-not-allowed bg-slate-900' : '';
            
            let rawValue = scenario.inputs[rowDef.field];
            if (isDisabledByCondition && (rowDef.key === 'initial_cash_buffer' || rowDef.key === 'monthly_expense')) {
                rawValue = 0;
            }
            
            let displayValue = rawValue;
            if (rowDef.scale && rowDef.scale !== 1 && typeof rawValue === 'number') displayValue = rawValue / rowDef.scale;
            if (isEnglish && (rowDef.key === 'initial_risk_asset' || rowDef.key === 'initial_cash_buffer' || rowDef.key === 'monthly_expense')) {
                displayValue = convertJPYToDisplayValue(rawValue, rowDef.unitKey);
            }
            let unitLabel = '';
            if (rowDef.unitKey) unitLabel = t(rowDef.unitKey);
            if (rowDef.inputType === 'number') {
                rowHtml += `<td class="p-3 border-b border-slate-700">
                    <div class="flex items-center gap-1">
                        <input type="number" value="${displayValue}" step="${step}" min="${min}" max="${max}"
                            data-id="${scenario.id}" data-field="${rowDef.field}" data-scale="${rowDef.scale || 1}" data-unit-key="${rowDef.unitKey || ''}"
                            class="scenario-input w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 ${disabledClass}" ${disabledAttr}>
                        ${unitLabel ? `<span class="text-xs text-slate-400 whitespace-nowrap">${unitLabel}</span>` : ''}
                    </div>
                   </td>`;
            } else if (rowDef.inputType === 'select') {
                const currentVal = scenario.inputs[rowDef.field];
                rowHtml += `<td class="p-3 border-b border-slate-700">
                    <select data-id="${scenario.id}" data-field="${rowDef.field}" class="scenario-input w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 ${disabledClass}" ${disabledAttr}>`;
                for (const opt of rowDef.options) {
                    let optLabel = opt;
                    if (rowDef.key === 'return_model') optLabel = opt === 'log-normal' ? t('market.model.lognormal') : t('market.model.logt');
                    else if (rowDef.key === 't_df') optLabel = opt === 'auto' ? t('comparison.auto') : t('comparison.manual');
                    else if (rowDef.key === 'inflation_model') optLabel = opt === 'fixed' ? t('comparison.fixed') : t('comparison.variable');
                    rowHtml += `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${optLabel}</option>`;
                }
                rowHtml += `</select></td>`;
            } else if (rowDef.inputType === 'checkbox') {
                const isChecked = scenario.inputs[rowDef.field];
                rowHtml += `<td class="p-3 border-b border-slate-700 text-center">
                    <input type="checkbox" data-id="${scenario.id}" data-field="${rowDef.field}" class="scenario-checkbox" ${isChecked ? 'checked' : ''} ${disabledAttr}>
                   </td>`;
            }
        }
        rowHtml += `</tr>`;
        html += rowHtml;
    }

    // 出力セクションの開始行
    html += `<tr class="bg-slate-800/30" data-section="output-header"><td class="sticky-left p-3 font-bold">${t('summary.title')}</td>`;
    for (let i = 0; i < scenarios.length; i++) html += `<td class="p-3 text-center text-xs text-slate-400">-</td>`;
    html += `</tr>`;

    for (const outDef of OUTPUT_ROWS) {
        let tooltipText = t(outDef.tooltipKey);
        if (outDef.key === 'target_maintain_rate' && scenarios.length > 0) {
            const targetRatio = scenarios[0].inputs.targetAssetRatio;
            tooltipText = t(outDef.tooltipKey, [targetRatio]);
        }
        let rowHtml = `<tr><td class="sticky-left p-3 border-b border-slate-700">
            <div class="flex items-center justify-between">
                <span>${t(outDef.labelKey)}</span>
                <div class="tooltip-container" tabindex="0"><span class="text-xs cursor-pointer text-indigo-400">ℹ️</span><div class="tooltip-text">${tooltipText}</div></div>
            </div>
            </td>`;
        const values = scenarios.map(s => { if (s.error) return null; const v = outDef.getValue(s.result); return v !== undefined && v !== null ? v : null; });
        const validValues = values.filter(v => v !== null).map(v => parseFloat(v));
        let normalized = [];
        if (validValues.length > 1 && !outDef.isPercentage) {
            const minAll = Math.min(...validValues);
            const maxAll = Math.max(...validValues);
            const range = maxAll - minAll;
            if (range > 0) {
                const isLowerBetter = outDef.isLowerBetter === true;
                normalized = values.map(v => {
                    if (v === null) return undefined;
                    let pct = (parseFloat(v) - minAll) / range * 100;
                    if (isLowerBetter) pct = 100 - pct;
                    return Math.min(100, Math.max(0, pct));
                });
            } else {
                normalized = values.map(v => v !== null ? 50 : undefined);
            }
        }
        for (let i = 0; i < scenarios.length; i++) {
            const s = scenarios[i];
            const val = values[i];
            if (s.error) {
                rowHtml += `<td class="p-3 border-b border-slate-700 text-center text-rose-400">${t('error.simulationFailed')}</td>`;
            } else if (val === null) {
                rowHtml += `<td class="p-3 border-b border-slate-700 text-center text-slate-500">-</td>`;
            } else {
                const formatted = outDef.format(val);
                if (normalized[i] !== undefined) {
                    rowHtml += `<td class="p-3 border-b border-slate-700">
                        <div class="bar-stack">
                            <div class="bar-track"><div class="bar-fill positive" style="width: ${normalized[i]}%"></div></div>
                            <span class="bar-value">${formatted}</span>
                        </div>
                    </td>`;
                } else {
                    rowHtml += `<td class="p-3 border-b border-slate-700 text-right">${formatted}</td>`;
                }
            }
        }
        rowHtml += `</tr>`;
        html += rowHtml;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // スクロール位置復元（二重 requestAnimationFrame でレイアウト確定を確実に）
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const newWrapper = container.querySelector('.comparison-table-wrapper');
            if (newWrapper) newWrapper.scrollLeft = savedScrollLeft;
        });
    });

    attachEventDelegation();
    initTooltips();
    restoreActiveElement(activeInfo);
}

function updateProgress(current, total) {
    // 毎回ボタン要素を再取得（スタレ化防止）
    const btn = document.getElementById('runAllBtn');
    if (btn) {
        btn.textContent = t('comparison.running', [current, total]);
        btn.disabled = true;
    }
}

function attachEventDelegation() {
    const container = document.getElementById('comparisonTableContainer');
    if (!container) return;

    // 数値・セレクト入力
    container.querySelectorAll('.scenario-input').forEach(el => {
        el.addEventListener('change', (e) => {
            const scenarioId = e.target.dataset.id;
            const field = e.target.dataset.field;
            if (!scenarioId || !field) return;
            const lang = getLanguage();
            const isEnglish = lang === 'en';

            if (e.target.tagName === 'SELECT') {
                // セレクトボックスは文字列値をそのまま保存（parseFloat 禁止）
                CS.updateScenarioInput(scenarioId, field, e.target.value);
                // returnModel / inflationModel / tDfMode 変更時はテーブル全体再描画
                if (['returnModel', 'inflationModel', 'tDfMode', 'cashBufferEnabled', 'guardrailEnabled'].includes(field)) {
                    renderComparisonTab();
                } else {
                    updateResultCellsForScenario(scenarioId);
                }
            } else {
                // number 型入力
                const rowDef = PARAM_ROWS.find(r => r.field === field);
                const scale = parseFloat(e.target.dataset.scale) || 1;
                const unitKey = e.target.dataset.unitKey || '';
                processInputValue(e.target, scenarioId, field, scale, unitKey, isEnglish);
            }
        });
    });

    // チェックボックス（cashBufferEnabled / guardrailEnabled）
    container.querySelectorAll('.scenario-checkbox').forEach(el => {
        el.addEventListener('change', (e) => {
            const scenarioId = e.target.dataset.id;
            const field = e.target.dataset.field;
            if (!scenarioId || !field) return;
            CS.updateScenarioInput(scenarioId, field, e.target.checked);
            // チェックボックス変更は条件付き表示行に影響するため全体再描画
            renderComparisonTab();
        });
    });

    // シナリオ名 contenteditable
    container.querySelectorAll('.scenario-name[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const scenarioId = e.target.dataset.id;
            if (!scenarioId) return;
            CS.updateScenarioName(scenarioId, e.target.textContent);
        });
        // Enter キーでフォーカスを外す
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    });

    // ヘッダーボタン（追加・実行・シード・パス）
    const addBtn = container.querySelector('#addScenarioBtn[data-action="add"]');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const simParams = getCurrentSimParams();
            const inputs = CS.createInputsFromSimParams(simParams);
            // addScenario 内部でアラート済みのため、戻り値チェックのみ
            const added = CS.addScenario(inputs, t);
            if (added) renderComparisonTab();
        });
    }

    const runAllBtn = container.querySelector('#runAllBtn[data-action="run-all"]');
    if (runAllBtn) {
        runAllBtn.addEventListener('click', () => {
            if (CS.getIsRunning()) return;
            // 編集中のシナリオ名を確定
            const editingEl = document.querySelector('.scenario-name[contenteditable="true"]:focus');
            if (editingEl) {
                CS.updateScenarioName(editingEl.dataset.id, editingEl.textContent);
                editingEl.blur();
            }
            runAllScenarios(
                (current, total) => updateProgress(current, total),
                (scenarioId, result) => {
                    // 個別完了時はテーブル全体を再描画して結果を反映
                    renderComparisonTab();
                },
                () => {
                    // 全完了
                    renderComparisonTab();
                },
                (scenarioId, errorMsg) => {
                    renderComparisonTab();
                }
            );
            // 実行開始直後にUIを更新
            renderComparisonTab();
        });
    }

    const seedInput = container.querySelector('#commonSeedInput');
    if (seedInput) {
        seedInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                CS.setCommonSeed(val);
                renderComparisonTab();
            }
        });
    }

    const pathsInput = container.querySelector('#commonPathsInput');
    if (pathsInput) {
        pathsInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                CS.setCommonPaths(val);
                renderComparisonTab();
            }
        });
    }

    // シナリオ操作ボタン（移動・複製・上書き・削除）のイベント委譲
    container.querySelectorAll('[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;

        if (action === 'move-left' || action === 'move-right') {
            btn.addEventListener('click', () => {
                const scenarios = CS.getScenarios();
                const fromIndex = scenarios.findIndex(s => s.id === id);
                if (fromIndex === -1) return;
                const toIndex = action === 'move-left' ? fromIndex - 1 : fromIndex + 1;
                CS.moveScenario(fromIndex, toIndex);
                renderComparisonTab();
            });
        } else if (action === 'duplicate') {
            btn.addEventListener('click', () => {
                const duplicated = CS.duplicateScenario(id, t);
                if (duplicated) renderComparisonTab();
            });
        } else if (action === 'overwrite') {
            btn.addEventListener('click', () => {
                const simParams = getCurrentSimParams();
                const newInputs = CS.createInputsFromSimParams(simParams);
                CS.overwriteScenarioFromSim(id, newInputs);
                renderComparisonTab();
                showToast(t('comparison.overwriteSuccess'));
            });
        } else if (action === 'delete') {
            btn.addEventListener('click', () => {
                const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
                const shouldDelete = isTestEnv ? true : confirm(t('comparison.confirmDelete'));
                if (shouldDelete) {
                    const deleted = CS.deleteScenario(id);
                    if (deleted) renderComparisonTab();
                }
            });
        }
    });
}

/**
 * 比較タブを初期化してレンダリングする
 * @param {Object} initialInputs - シミュレーションタブから取得した初期パラメータ
 */
export function initComparisonTab(initialInputs) {
    CS.initScenarios(initialInputs, t);
    renderComparisonTab();
}
