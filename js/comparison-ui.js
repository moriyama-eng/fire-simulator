// js/comparison-ui.js
// 比較タブ UI 制御

import * as CS from './comparison-state.js';
import { runAllScenarios } from './comparison-runner.js';
import { getParamsFromInputs, calcAutoDf } from './core/params.js';
import { getCurrentSimParams } from './params-accessor.js';
import { t, getLanguage, formatCurrency, formatPercent, formatYears, formatNumber } from './i18n.js';

let runningState = null;

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
    { key: 'return_model', labelKey: 'market.modelLabel', inputType: 'select', options: ['log-normal', 'log-t'], tooltipKey: 'market.modelTooltip', field: 'returnModel', displayCondition: null },
    { key: 't_df', labelKey: 'comparison.dfLabel', inputType: 'select', options: ['auto', 'manual'], tooltipKey: 'market.dfTooltip', field: 'tDfMode', displayCondition: null },
    { key: 't_df_manual', labelKey: 'comparison.dfValue', inputType: 'number', unitKey: '', tooltipKey: 'market.dfTooltip', field: 'tDfManual', step: 0.1, min: 2.5, max: 30, scale: 1, displayCondition: (inputs) => inputs.tDfMode === 'manual' },
    { key: 'inflation_model', labelKey: 'market.inflationModelLabel', inputType: 'select', options: ['fixed', 'ar1'], tooltipKey: 'market.inflationModelTooltip', field: 'inflationModel', displayCondition: null },
    { key: 'inf_vol', labelKey: 'market.inflationVol', inputType: 'number', unitKey: 'unit.percent', tooltipKey: 'market.inflationVol.tooltip', field: 'infVol', step: 0.5, min: 0, max: 10, scale: 1, displayCondition: (inputs) => inputs.inflationModel === 'ar1' },
    { key: 'inf_ar', labelKey: 'market.inflationAr', inputType: 'number', unitKey: '', tooltipKey: 'market.inflationAr.tooltip', field: 'infAr', step: 0.1, min: 0, max: 1.0, scale: 1, displayCondition: (inputs) => inputs.inflationModel === 'ar1' },
    { key: 'sim_years', labelKey: 'sim.years', inputType: 'number', unitKey: 'unit.years', tooltipKey: 'sim.years.tooltip', field: 'simYears', step: 5, min: 5, max: 60, scale: 1, displayCondition: null },
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

    const hasPending = !isRunning && scenarios.some(s => !s.result || s.error);

    const existingToggle = document.getElementById('commonSeedToggle');
    const isSeedRandom = existingToggle ? existingToggle.checked : true;
    const isSeedDisabled = isRunning || isSeedRandom;
    const seedDisabledClass = isSeedDisabled ? 'opacity-50 cursor-not-allowed' : '';


    let html = `<div class="comparison-controls flex flex-wrap items-center gap-4 mb-4">
        <button id="runAllBtn" data-action="run-all" class="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500 rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed" ${isRunning ? 'disabled' : ''}>
            ${isRunning ? (runningState ? t('comparison.running', [runningState.current, runningState.total]) : t('comparison.running', ['0', scenarios.length])) : t('comparison.runAll')}
        </button>
        ${hasPending ? `
        <div class="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold select-none">
            ${t('comparison.pendingExecution')}
        </div>` : ''}
        <span class="text-xs text-slate-400 select-none">${t('comparison.moveHintText')}</span>
        <div class="flex flex-wrap items-center gap-3 ml-auto">
            <div class="flex-shrink-0 flex items-center gap-2">
                <label class="text-xs text-slate-300">${t('seed.label')}</label>
                <div class="flex items-center gap-1.5">
                    <span class="text-xs text-slate-300 font-medium">${t('seed.fixed')}</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="commonSeedToggle" class="sr-only peer" ${isSeedRandom ? 'checked' : ''}>
                        <div class="toggle-bg w-7 h-3.5 bg-slate-600 rounded-full peer peer-checked:bg-purple-600"></div>
                        <div class="toggle-dot absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-white rounded-full peer-checked:translate-x-3.5"></div>
                    </label>
                    <span class="text-xs text-slate-300 font-medium">${t('seed.random')}</span>
                </div>
                <div class="flex items-center gap-1">
                    <input type="number" id="commonSeedInput" value="${commonSeed}" min="1" max="99999999" step="1" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 min-w-[120px] w-auto flex-1 text-sm ${seedDisabledClass}" ${isSeedDisabled ? 'disabled' : ''}>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <label class="text-xs text-slate-300">${t('sim.paths')}</label>
                <input type="number" id="commonPathsInput" value="${commonPaths}" min="5000" max="50000" step="5000" class="bg-slate-800 border border-slate-600 rounded px-2 py-1 min-w-[120px] w-auto flex-1 text-sm" ${isRunning ? 'disabled' : ''}>
            </div>
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
        const isPending = !s.result || s.error;
        const pendingClass = isPending ? 'pending-col' : '';
        html += `
                <th class="scenario-header min-w-[200px] p-3 bg-slate-800 border-b border-slate-700 ${pendingClass}" scope="col" data-scenario-id="${s.id}">
                    <div class="flex justify-center mb-1">
                        <span class="scenario-name font-bold text-indigo-300 editable" contenteditable="${!isRunning}" data-field="name" data-id="${s.id}" aria-label="${t('comparison.scenarioName')}">${escapeHtml(s.name)}</span>
                    </div>
                    <div class="action-menu-wrapper mt-1 flex items-center justify-center gap-1" data-id="${s.id}">
                        <span class="drag-handle text-slate-500 ${isRunning ? 'opacity-50' : ''} cursor-grab">
                            <svg class="drag-handle-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ドラッグハンドル">
                                <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </span>
                        <button class="action-menu-trigger p-1.5 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-700/60 transition-colors" data-id="${s.id}" aria-haspopup="true" aria-expanded="false" ${isRunning ? 'disabled' : ''} title="${t('comparison.scenarioName')}">
                            <span class="sr-only">シナリオ操作メニュー</span>
                            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                        <div class="action-dropdown hidden" data-id="${s.id}" role="menu">
                            <button class="dropdown-item" data-action="move-left" data-id="${s.id}" role="menuitem" ${isRunning || isFirst ? 'disabled' : ''}>← ${t('comparison.moveLeft')}</button>
                            <button class="dropdown-item" data-action="move-right" data-id="${s.id}" role="menuitem" ${isRunning || isLast ? 'disabled' : ''}>→ ${t('comparison.moveRight')}</button>
                            <button class="dropdown-item" data-action="duplicate" data-id="${s.id}" role="menuitem" ${isRunning ? 'disabled' : ''}>📋 ${t('comparison.duplicateTitle')}</button>
                            <button class="dropdown-item" data-action="overwrite" data-id="${s.id}" role="menuitem" ${isRunning ? 'disabled' : ''}>🔄 ${t('comparison.overwriteFromSim')}</button>
                            <button class="dropdown-item text-rose-400 hover:bg-rose-950/40" data-action="delete" data-id="${s.id}" role="menuitem" ${isRunning || scenarios.length === 1 ? 'disabled' : ''}>🗑️ ${t('comparison.deleteScenario')}</button>
                        </div>
                    </div>
                </th>`;
    }
    html += `
                <th class="add-column bg-slate-800/20 border-b border-slate-700 p-3" scope="col">
                    <button id="addScenarioBtn" data-action="add" class="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-full text-white font-bold transition-colors shadow-md shadow-indigo-500/20 mx-auto" ${isRunning ? 'disabled' : ''} title="${t('comparison.addScenario')}">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </th>`;

    html += `</tr></thead><tbody>`;

    for (const rowDef of PARAM_ROWS) {
        const bounds = getLocalizedInputBounds(rowDef, isEnglish);
        const step = bounds.step;
        const min = bounds.min;
        const max = bounds.max;

        let sectionHeaderHtml = '';
        if (rowDef.key === 'initial_risk_asset') {
            sectionHeaderHtml = `<tr class="section-header-row"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('comparison.section.assets')}</span></td></tr>`;
        } else if (rowDef.key === 'expected_return') {
            sectionHeaderHtml = `<tr class="section-header-row"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('market.title')}</span></td></tr>`;
        } else if (rowDef.key === 'sim_years') {
            sectionHeaderHtml = `<tr class="section-header-row"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('sim.title')}</span></td></tr>`;
        } else if (rowDef.key === 'cash_buffer_enabled') {
            sectionHeaderHtml = `<tr class="section-header-row"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('cb.title')}</span></td></tr>`;
        } else if (rowDef.key === 'guardrail_enabled') {
            sectionHeaderHtml = `<tr class="section-header-row"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('gr.title')}</span></td></tr>`;
        }
        if (sectionHeaderHtml) {
            html += sectionHeaderHtml;
        }

        let rowHtml = `<tr><td class="sticky-left p-3 border-b border-slate-700">
            <div class="flex items-center justify-between">
                <span class="font-medium">${t(rowDef.labelKey)}</span>
                ${rowDef.tooltipKey ? `<div class="tooltip-container" tabindex="0"><span class="text-xs cursor-pointer text-indigo-400">ℹ️</span><div class="tooltip-text">${t(rowDef.tooltipKey)}</div></div>` : ''}
            </div>
         </td>`;
        for (const scenario of scenarios) {
            let isDisabledByCondition = rowDef.displayCondition && !rowDef.displayCondition(scenario.inputs);
            if (scenario.inputs.returnModel !== 'log-t') {
                if (rowDef.key === 't_df' || rowDef.key === 't_df_manual') {
                    isDisabledByCondition = true;
                }
            }
            const disabledAttr = (isRunning || isDisabledByCondition) ? 'disabled' : '';
            const disabledClass = isDisabledByCondition ? 'opacity-50 cursor-not-allowed bg-slate-900' : '';
            const isPending = !scenario.result || scenario.error;
            const pendingClass = isPending ? 'pending-col' : '';
            
            let rawValue = scenario.inputs[rowDef.field];
            if (isDisabledByCondition && (rowDef.key === 'initial_cash_buffer' || rowDef.key === 'monthly_expense')) {
                rawValue = 0;
            }
            
            let displayValue = rawValue;
            if (rowDef.scale && rowDef.scale !== 1 && typeof rawValue === 'number') displayValue = rawValue / rowDef.scale;
            if (isEnglish && (rowDef.key === 'initial_risk_asset' || rowDef.key === 'initial_cash_buffer' || rowDef.key === 'monthly_expense')) {
                displayValue = convertJPYToDisplayValue(rawValue, rowDef.unitKey);
            }

            let autoIndicator = '';
            if (rowDef.key === 't_df_manual' && scenario.inputs.tDfMode === 'auto') {
                displayValue = calcAutoDf(scenario.inputs.volatility).toFixed(1);
                autoIndicator = t('comparison.autoIndicator');
            }

            let unitLabel = '';
            if (rowDef.unitKey) {
                unitLabel = t(rowDef.unitKey);
            }
            if (rowDef.inputType === 'number') {
                rowHtml += `<td class="p-3 border-b border-slate-700 ${pendingClass}">
                    <div class="flex items-center gap-1">
                        <input type="number" value="${displayValue}" step="${step}" min="${min}" max="${max}"
                            data-id="${scenario.id}" data-field="${rowDef.field}" data-scale="${rowDef.scale || 1}" data-unit-key="${rowDef.unitKey || ''}"
                            class="scenario-input w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 ${disabledClass}" ${disabledAttr}>
                        ${autoIndicator ? `<span class="text-xs text-slate-400 whitespace-nowrap">${autoIndicator}</span>` : ''}
                        ${unitLabel ? `<span class="text-xs text-slate-400 whitespace-nowrap">${unitLabel}</span>` : ''}
                    </div>
                   </td>`;
            } else if (rowDef.inputType === 'select') {
                const currentVal = scenario.inputs[rowDef.field];
                rowHtml += `<td class="p-3 border-b border-slate-700 ${pendingClass}">
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
                rowHtml += `<td class="p-3 border-b border-slate-700 text-center ${pendingClass}">
                    <div class="flex justify-center items-center">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" data-id="${scenario.id}" data-field="${rowDef.field}" class="scenario-checkbox sr-only peer" ${isChecked ? 'checked' : ''} ${disabledAttr}>
                            <div class="toggle-bg w-7 h-3.5 bg-slate-600 rounded-full peer peer-checked:bg-indigo-600"></div>
                            <div class="toggle-dot absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-white rounded-full peer-checked:translate-x-3.5"></div>
                        </label>
                    </div>
                   </td>`;
            }
        }
        rowHtml += `<td class="add-column border-b border-slate-700 bg-slate-900/10"></td>`;
        rowHtml += `</tr>`;
        html += rowHtml;
    }

    html += `<tr class="section-header-row" data-section="output-header"><td colspan="${scenarios.length + 2}"><span class="section-header-title">${t('summary.title')}</span></td></tr>`;

    for (const outDef of OUTPUT_ROWS) {
        let tooltipText = t(outDef.tooltipKey);
        let rowHtml = `<tr><td class="sticky-left p-3 border-b border-slate-700">
            <div class="flex items-center justify-between">
                <span>${t(outDef.labelKey)}</span>
                <div class="tooltip-container" tabindex="0"><span class="text-xs cursor-pointer text-indigo-400">ℹ️</span><div class="tooltip-text">${tooltipText}</div></div>
            </div>
            </td>`;
        const values = scenarios.map(s => { if (s.error) return null; const v = outDef.getValue(s.result); return v !== undefined && v !== null ? v : null; });
        for (let i = 0; i < scenarios.length; i++) {
            const s = scenarios[i];
            const val = values[i];
            const isPending = !s.result || s.error;
            const pendingClass = isPending ? 'pending-col' : '';
            if (s.error) {
                rowHtml += `<td class="p-3 border-b border-slate-700 text-right ${pendingClass}"><span class="text-rose-400 text-xs font-semibold">⚠️ ${s.error}</span></td>`;
            } else if (val === null) {
                rowHtml += `<td class="p-3 border-b border-slate-700 text-right ${pendingClass}"></td>`;
            } else {
                const formatted = outDef.format(val);
                rowHtml += `<td class="p-3 border-b border-slate-700 text-right font-semibold text-indigo-100 ${pendingClass}">${formatted}</td>`;
            }
        }
        rowHtml += `<td class="add-column border-b border-slate-700 bg-slate-900/10"></td>`;
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

    setupEventDelegation();
    initTooltips();
    restoreActiveElement(activeInfo);
    // FIX-03: ドラッグ＆ドロップでシナリオ列を並び替え
    initSortable(container);
}

/**
 * FIX-03: SortableJSを用いてtheadのth列をドラッグ可能にする
 * テスト環境（JSDOM）ではSortableが未定義のためスキップ
 * @param {HTMLElement} container - comparisonTableContainerの要素
 */
function initSortable(container) {
    // テスト環境やSortable未ロード時はスキップ
    if (typeof Sortable === 'undefined') return;
    if (CS.getIsRunning()) return;

    const thead = container.querySelector('.comparison-table thead tr');
    if (!thead) return;

    // 既存インスタンスがあれば破棄
    if (thead._sortableInstance) {
        thead._sortableInstance.destroy();
        thead._sortableInstance = null;
    }

    thead._sortableInstance = Sortable.create(thead, {
        handle: '.drag-handle',    // ドラッグハンドルアイコンのみを操作点に指定
        animation: 150,
        filter: '.sticky-left, .add-column',   // 左端「パラメータ」列と右端「追加」列は移動禁止
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            // stickyLeftの分だけインデックスをオフセット補正（theadの1列目はパラメータ列）
            const fromIndex = evt.oldIndex - 1;
            const toIndex = evt.newIndex - 1;
            if (fromIndex < 0 || toIndex < 0) return;
            CS.moveScenario(fromIndex, toIndex);
            renderComparisonTab();
        },
    });
}

function updateProgress(current, total) {
    runningState = { current, total };
    // 毎回ボタン要素を再取得（スタレ化防止）
    const btn = document.getElementById('runAllBtn');
    if (btn) {
        btn.textContent = t('comparison.running', [current, total]);
        btn.disabled = true;
    }
}

// シナリオ操作を一元処理する関数
function handleScenarioAction(action, id) {
    if (CS.getIsRunning()) return;
    switch (action) {
        case 'move-left':
        case 'move-right': {
            const scenarios = CS.getScenarios();
            const fromIndex = scenarios.findIndex(s => s.id === id);
            if (fromIndex === -1) return;
            const toIndex = action === 'move-left' ? fromIndex - 1 : fromIndex + 1;
            CS.moveScenario(fromIndex, toIndex);
            renderComparisonTab();
            break;
        }
        case 'duplicate': {
            const duplicated = CS.duplicateScenario(id, t);
            if (duplicated) {
                renderComparisonTab();
                showToast(t('comparison.duplicateSuccess'));
            } else {
                showToast(t('comparison.maxScenarios'));
            }
            break;
        }
        case 'overwrite': {
            const simParams = getCurrentSimParams();
            const newInputs = CS.createInputsFromSimParams(simParams);
            CS.overwriteScenarioFromSim(id, newInputs);
            renderComparisonTab();
            showToast(t('comparison.overwriteSuccess'));
            break;
        }
        case 'delete': {
            if (CS.getScenarioCount() <= 1) {
                showToast(t('comparison.cannotDeleteLast'), 2000);
                return;
            }
            if (!window.confirm(t('comparison.confirmDelete'))) {
                return;
            }
            const deleted = CS.deleteScenario(id);
            if (deleted) {
                renderComparisonTab();
                showToast(t('comparison.deleteSuccess'), 1500);
            } else {
                showToast(t('comparison.deleteFailed'), 2000);
            }
            break;
        }
    }
}

function setupEventDelegation() {
    const container = document.getElementById('comparisonTableContainer');
    if (!container || container._delegationSetup) return;
    container._delegationSetup = true;

    // クリックイベントの委譲（ボタン関連 - 主にadd, run-all等、またはDropdownトリガー、Dropdownアイテム）
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        const isRunning = CS.getIsRunning();

        if (btn && !btn.disabled && !isRunning) {
            const action = btn.dataset.action;
            if (action === 'add') {
                const simParams = getCurrentSimParams();
                const inputs = CS.createInputsFromSimParams(simParams);
                const added = CS.addScenario(inputs, t);
                if (added) {
                    renderComparisonTab();
                    showToast(t('comparison.addSuccess'));
                    requestAnimationFrame(() => {
                        const wrapper = container.querySelector('.comparison-table-wrapper');
                        if (wrapper) wrapper.scrollLeft = wrapper.scrollWidth;
                    });
                } else {
                    showToast(t('comparison.maxScenarios'));
                }
            } else if (action === 'run-all') {
                const seedToggle = document.getElementById('commonSeedToggle');
                if (seedToggle && seedToggle.checked) {
                    const newSeed = (Date.now() >>> 0) % 99999999 + 1;
                    CS.setCommonSeed(newSeed);
                    const seedInput = document.getElementById('commonSeedInput');
                    if (seedInput) {
                        seedInput.value = CS.getCommonSeed();
                    }
                }
                // 編集中のシナリオ名を確定
                const editingEl = document.querySelector('.scenario-name[contenteditable="true"]:focus');
                if (editingEl) {
                    CS.updateScenarioName(editingEl.dataset.id, editingEl.textContent);
                    editingEl.blur();
                }
                runAllScenarios(
                    (current, total) => updateProgress(current, total),
                    (scenarioId, result) => {
                        renderComparisonTab();
                    },
                    () => {
                        runningState = null;
                        renderComparisonTab();
                    },
                    (scenarioId, errorMsg) => {
                        renderComparisonTab();
                    }
                );
                renderComparisonTab();
            }
        }

        // プルダウントリガーのクリック（開閉）
        const trigger = e.target.closest('.action-menu-trigger');
        if (trigger) {
            if (CS.getIsRunning()) return;
            if (!trigger.disabled) {
                e.stopPropagation();
                const wrapper = trigger.closest('.action-menu-wrapper');
                const dropdown = wrapper.querySelector('.action-dropdown');
                // 既に開いている他のメニューを閉じる
                document.querySelectorAll('.action-dropdown:not(.hidden)').forEach(el => {
                    if (el !== dropdown) el.classList.add('hidden');
                });
                dropdown.classList.toggle('hidden');
                const isOpened = !dropdown.classList.contains('hidden');
                trigger.setAttribute('aria-expanded', isOpened);
                
                if (isOpened) {
                    const firstItem = dropdown.querySelector('.dropdown-item');
                    if (firstItem) firstItem.focus();
                }
            }
        }

        // ドロップダウン項目のクリック
        const item = e.target.closest('.dropdown-item');
        if (item && !item.disabled && !isRunning) {
            e.stopPropagation();
            const action = item.dataset.action;
            const id = item.dataset.id;
            
            // ドロップダウンを閉じる
            const dropdown = item.closest('.action-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
            const trigger = item.closest('.action-menu-wrapper').querySelector('.action-menu-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');

            handleScenarioAction(action, id);
        }
    });

    // メニュー外クリックで閉じる（document に委譲）
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-menu-wrapper')) {
            document.querySelectorAll('.action-dropdown:not(.hidden)').forEach(el => {
                el.classList.add('hidden');
                const trigger = el.closest('.action-menu-wrapper').querySelector('.action-menu-trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // ドロップダウンを閉じるEscapeキーの監視
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeDropdown = document.querySelector('.action-dropdown:not(.hidden)');
            if (activeDropdown) {
                activeDropdown.classList.add('hidden');
                const wrapper = activeDropdown.closest('.action-menu-wrapper');
                const trigger = wrapper ? wrapper.querySelector('.action-menu-trigger') : null;
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            }
        }
    });

    container.addEventListener('change', (e) => {
        const isRunning = CS.getIsRunning();
        if (isRunning) return;

        const target = e.target;

        if (target.id === 'commonSeedToggle') {
            const seedInput = document.getElementById('commonSeedInput');
            if (seedInput) {
                const isChecked = target.checked; // true = ランダム（無効化）
                const isRunning = CS.getIsRunning();
                const shouldDisable = isChecked || isRunning;
                seedInput.disabled = shouldDisable;
                // クラスのトグルで視覚的グレーアウトを即時反映
                seedInput.classList.toggle('opacity-50', shouldDisable);
                seedInput.classList.toggle('cursor-not-allowed', shouldDisable);
            }
            // 再描画は不要（状態は即座に更新される）
            return;
        }

        if (target.id === 'commonSeedInput') {
            const val = parseInt(target.value, 10);
            if (!isNaN(val)) {
                CS.setCommonSeed(val);
                renderComparisonTab();
            }
            return;
        }

        if (target.id === 'commonPathsInput') {
            const val = parseInt(target.value, 10);
            if (!isNaN(val)) {
                CS.setCommonPaths(val);
                renderComparisonTab();
            }
            return;
        }

        if (target.classList.contains('scenario-input')) {
            const scenarioId = target.dataset.id;
            const field = target.dataset.field;
            if (!scenarioId || !field) return;
            const lang = getLanguage();
            const isEnglish = lang === 'en';

            if (target.tagName === 'SELECT') {
                CS.updateScenarioInput(scenarioId, field, target.value);
                if (['returnModel', 'inflationModel', 'tDfMode', 'cashBufferEnabled', 'guardrailEnabled'].includes(field)) {
                    renderComparisonTab();
                } else {
                    updateResultCellsForScenario(scenarioId);
                }
            } else {
                const scale = parseFloat(target.dataset.scale) || 1;
                const unitKey = target.dataset.unitKey || '';
                processInputValue(target, scenarioId, field, scale, unitKey, isEnglish);
            }
            return;
        }

        if (target.classList.contains('scenario-checkbox')) {
            const scenarioId = target.dataset.id;
            const field = target.dataset.field;
            if (!scenarioId || !field) return;
            CS.updateScenarioInput(scenarioId, field, target.checked);
            renderComparisonTab();
            return;
        }
    }, true);

    // フォーカスイン・フォーカスアウト・キーダウンイベントの委譲（シナリオ名の contenteditable 用）
    container.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('scenario-name')) {
            e.target._originalName = e.target.textContent;
        }
    });

    container.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('scenario-name')) {
            const scenarioId = e.target.dataset.id;
            if (!scenarioId) return;
            const newName = e.target.textContent.trim();
            const originalName = e.target._originalName || '';
            if (newName === '') {
                e.target.textContent = originalName;
            } else {
                CS.updateScenarioName(scenarioId, newName);
                e.target._originalName = newName;
            }
        }
    });

    container.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('scenario-name')) {
            const originalName = e.target._originalName || '';
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.target.textContent = originalName;
                e.target.blur();
            }
        }
    });
}

/**
 * 比較タブを初期化してレンダリングする
 * @param {Object} initialInputs - シミュレーションタブから取得した初期パラメータ
 */
export function initComparisonTab(initialInputs) {
    CS.initScenarios(initialInputs, t);
    setupEventDelegation();
    renderComparisonTab();
}
