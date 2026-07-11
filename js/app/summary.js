// ====================================================================
// js/app/summary.js
// サマリーカード描画モジュール
// 依存: i18n.js, app/state.js, app/ui-helpers.js
// ====================================================================

import { t, formatCurrency, formatDate, formatYears, formatNumber, getLanguage } from '../i18n.js';
import { getIsResultDirty } from './state.js';
import { initTooltips } from './ui-helpers.js';

// ====================================================================
// applyTranslations の参照（summary内で呼ぶため動的インポートで循環を回避）
// init.js から注入する形でもよいが、ここでは直接モジュール関数を定義
// ====================================================================

/**
 * サマリーカードの内容を更新する
 * @param {object} result - シミュレーション結果
 * @param {object} params - 実行パラメータ
 */
export function updateSummaryCard(result, params) {
    const container = document.getElementById('summaryCardContainer');

    const successRate = result.successRate.toFixed(1);

    // 成功率に応じたステータスカラー
    let statusGrad = 'from-emerald-500/20 to-teal-500/5';
    let statusText = 'text-emerald-400';
    if (result.successRate < 80) {
        statusGrad = 'from-rose-500/20 to-red-500/5';
        statusText = 'text-rose-400';
    } else if (result.successRate < 90) {
        statusGrad = 'from-amber-500/20 to-orange-500/5';
        statusText = 'text-amber-400';
    }

    container.innerHTML = `
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div class="absolute inset-0 bg-gradient-to-br ${statusGrad} opacity-30"></div>
            <div class="relative z-10">
                <div class="flex items-center justify-between gap-4 mb-5 border-b border-white/10 pb-3">
                    <div class="flex items-center space-x-2">
                        <h3 class="text-sm font-bold tracking-widest text-slate-100 drop-shadow-sm" data-i18n="summary.title">シミュレーション結果 サマリ</h3>
                        ${getIsResultDirty() ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30" data-i18n="summary.dirtyWarning">条件変更あり</span>' : ''}
                    </div>
                    <span id="uiExecTime" class="text-xs text-slate-300 font-medium">${formatDate(new Date())}</span>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: KPIs -->
                    <div class="flex flex-col justify-start items-start lg:border-r border-white/10 lg:pr-6 space-y-4">
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1 flex justify-between">
                                <span data-i18n="summary.successRate">FIRE 成功率</span>
                            </p>
                            <p class="text-4xl font-extrabold ${statusText} drop-shadow-md">
                                ${successRate}<span class="text-xl ml-1">%</span>
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1" data-i18n="summary.finalMedian">最終総資産 中央値</p>
                            <p class="text-3xl font-bold text-blue-300 drop-shadow-md">
                                ${(() => {
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        if (isJa) return (result.finalMedian / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円';
        const usd = result.finalMedian / 100;
        const m = usd / 1000000;
        return '$' + m.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' M';
    })()}
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <div class="flex justify-between items-center mb-1">
                                <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest" data-i18n="summary.targetMaintainRate">目標資産維持確率</p>
                                <div class="tooltip-container tooltip-left-align" tabindex="0">
                                    <span class="text-xs cursor-pointer text-indigo-400 hover:text-indigo-300">ℹ️</span>
                                    <div class="tooltip-text">
                                        ${t('summary.targetMaintainRate.tooltip', [params.targetAssetRatio])}
                                    </div>
                                </div>
                            </div>
                            <p class="text-3xl font-bold ${result.targetAssetMaintainRate >= 80 ? 'text-emerald-400' : (result.targetAssetMaintainRate >= 50 ? 'text-amber-400' : 'text-rose-400')} drop-shadow-md">
                                ${result.targetAssetMaintainRate.toFixed(1)}<span class="text-xl ml-1">%</span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Right: Parameters -->
                    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-sm content-center">
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.riskAsset">初期リスク資産</p>
                            <p class="font-bold text-white text-base">${(function () {
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        return isJa
            ? (params.initialRiskAsset / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円'
            : '$' + (params.initialRiskAsset / 100000000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' M';
    })()}</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.cashBuffer">初期現金バッファ</p>
                            <p class="font-bold text-white text-base">${params.cashBufferToggle ? (() => {
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        if (isJa) return (params.initialCashBuffer / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '万円';
        // 万円 → 円 → ドル（÷100）→ Kドル（÷1000）
        const usd = params.initialCashBuffer / 100;
        const k = usd / 1000;
        return '$' + k.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' K';
    })() : '<span class="text-slate-500">0</span>'}</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.expense">初期月間取崩し額</p>
                            <p class="font-bold text-white text-base">${(() => {
        const lang = getLanguage() || '';
        const isJa = lang.startsWith('ja');
        if (isJa) return (params.monthlyExpense / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '万円';
        const usd = params.monthlyExpense / 100;
        const k = usd / 1000;
        return '$' + k.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' K';
    })()}</p>
                        </div>

                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.returnVol">期待リターン / ボラ</p>
                            <p class="font-bold text-white text-base">${params.expectedReturn.toFixed(1)}% / ${params.volatility.toFixed(1)}%</p>
                        </div>
                        <div class="space-y-1 shrink-0">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.inflation">期待インフレ率</p>
                            <p class="font-bold text-white text-base">${params.useArInflation ? t('summary.inflation.ar1', [params.inflationRate.toFixed(1), params.infVol.toFixed(1)]) : t('summary.inflation.fixed', [params.inflationRate.toFixed(1)])}</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.simSettings">シミュレーション設定</p>
                            <p class="font-bold text-white text-base">${formatYears(params.simYears)} / ${formatNumber(params.simPaths, 'unit.paths')}</p>
                        </div>
                        <div class="space-y-1 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.model.label">変動モデル</p>
                            <p class="font-bold text-white text-base">
                                ${result.modelType === 'log-t' ? `${t('summary.model.logt')} <span class="text-xs ml-1">(自由度: ${result.usedDf.toFixed(1)})</span>` : t('summary.model.lognormal')}
                            </p>
                        </div>
                        <div class="space-y-1 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.seed">乱数シード値</p>
                            <p class="font-bold text-white text-base">${result.usedSeed.toString()}</p>
                        </div>
                        <div class="hidden sm:block pt-2 border-t border-slate-700/50"></div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.cbSettings">現金バッファ設定</p>
                            <div class="font-bold text-slate-100 text-xs sm:text-sm space-y-0.5">
                                ${params.cashBufferToggle ? `
                                 <p><span class="text-slate-400">${t('summary.cb.triggerLabel')}:</span> <span class="font-bold text-white">${t('summary.cb.triggerValue', [params.drawdownTrigger])}</span></p>
                                 <p><span class="text-slate-400">${t('summary.cb.replenishStart')}:</span> <span class="font-bold text-white">${t('summary.cb.replenishStartValue')}</span></p>
                                 <p><span class="text-slate-400">${t('summary.cb.replenishEnd')}:</span> <span class="font-bold text-white">${t('summary.cb.replenishEndValue', [params.drawdownReplenish])}</span></p>
                                 <p><span class="text-slate-400">${t('summary.cb.replenishPace')}:</span> <span class="font-bold text-white">${t('summary.cb.replenishPaceValue', [params.replenishPace])}</span></p>
                                ` : `<p class="text-slate-500" data-i18n="summary.off">OFF</p>`}
                            </div>
                        </div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.grSettings">支出ガードレール設定</p>
                            <div class="font-bold text-slate-100 text-xs sm:text-sm">
                                ${params.guardrailToggle ? `
                                 <p><span class="text-slate-400">${t('summary.gr.triggerLabel')}:</span> <span class="font-bold text-white">${t('summary.gr.triggerValue', [params.guardrailTrigger])}</span></p>
                                 <p><span class="text-slate-400">${t('summary.gr.releaseLabel')}:</span> <span class="font-bold text-white">${t('summary.gr.releaseValue', [params.guardrailRelease])}</span></p>
                                 <p><span class="text-slate-400">${t('summary.gr.reductionLabel')}:</span> <span class="font-bold text-white">${t('summary.gr.reductionValue', [params.guardrailReduction])}</span></p>
                                ` : `<p class="text-slate-500" data-i18n="summary.off">OFF</p>`}
                            </div>
                        </div>

    </div>
    `;

    // フェードイン表示
    container.classList.remove('hidden');
    // reflow
    void container.offsetWidth;
    container.classList.add('opacity-100');

    // 動的翻訳適用（循環インポート回避のため動的インポートを使用）
    import('../i18n.js').then(({ t: _t }) => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = _t(el.getAttribute('data-i18n'));
        });
    });
    initTooltips();
}

// ====================================================================
// 未実行状態のサマリカード描画
// ====================================================================
export function renderEmptySummaryCard(cbChecked = false) {
    const container = document.getElementById('summaryCardContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div class="absolute inset-0 bg-slate-800/20 opacity-30"></div>
            <div class="relative z-10">
                <div class="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
                    <h3 class="text-sm font-bold tracking-widest text-slate-100 drop-shadow-sm" data-i18n="summary.title">シミュレーション結果 サマリ</h3>
                    <span class="text-xs text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis" data-i18n="summary.notExecuted">未実行</span>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: KPIs (Empty State) -->
                    <div class="flex flex-col justify-start items-start lg:border-r border-white/10 lg:pr-6 space-y-4">
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1 flex justify-between">
                                <span data-i18n="summary.successRate">FIRE 成功率</span>
                            </p>
                            <p class="text-4xl font-extrabold text-slate-500 drop-shadow-md">
                                -
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest mb-1" data-i18n="summary.finalMedian">最終総資産 中央値</p>
                            <p class="text-3xl font-bold text-slate-500 drop-shadow-md">
                                -
                            </p>
                        </div>
                        <div class="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                            <div class="flex justify-between items-center mb-1">
                                <p class="text-xs text-slate-200 font-semibold uppercase tracking-widest" data-i18n="summary.targetMaintainRate">目標資産維持確率</p>
                            </div>
                            <p class="text-3xl font-bold text-slate-500 drop-shadow-md">
                                -
                            </p>
                        </div>
                    </div>
                    
                    <!-- Right: Parameters (Empty State) -->
                    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-sm content-center opacity-70">
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.riskAsset">初期リスク資産</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.cashBuffer">初期現金バッファ</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.expense">初期月間取崩し額</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>

                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.returnVol">期待リターン / ボラ</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1 shrink-0">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.inflation">期待インフレ率</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.simSettings">シミュレーション設定</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.model.label">変動モデル</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="space-y-1 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.seed">乱数シード値</p>
                            <p class="font-bold text-slate-500 text-base">-</p>
                        </div>
                        <div class="hidden sm:block pt-2 border-t border-slate-700/50"></div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.cbSettings">現金バッファ設定</p>
                            <div class="font-bold text-slate-500 text-xs sm:text-sm">
                                <p>-</p>
                            </div>
                        </div>
                        
                        <div class="space-y-1 col-span-2 sm:col-span-3 pt-2 border-t border-slate-700/50">
                            <p class="text-xs text-slate-300 font-medium tracking-wide" data-i18n="summary.grSettings">支出ガードレール設定</p>
                            <div class="font-bold text-slate-500 text-xs sm:text-sm">
                                <p>-</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;

    container.classList.remove('hidden');
    void container.offsetWidth;
    container.classList.add('opacity-100');

    // 動的翻訳適用（循環インポート回避のため動的インポートを使用）
    import('../i18n.js').then(({ t: _t }) => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = _t(el.getAttribute('data-i18n'));
        });
    });
    initTooltips();
}
