import { getParamsFromInputs, calcAutoDf, DEFAULTS, safeNumber } from './core/params.js';
import { formatPercentileInput, parsePercentiles } from './core/format.js';
import { buildSimulationUrl, applyQueryParams } from './core/url.js';
import { getIsResultDirty, markInputChanged as coreMarkInputChanged, markResultClean } from './core/state.js';
import { transposeFlat, aggregateResultsProduction } from './core/aggregation.js';
import { runSimulation, setProgressCallback } from './simulation-engine.js';
import { t, setLanguage, getLanguage, formatCurrency, formatPercent, formatDate, formatYears, formatNumber } from './i18n.js';
import * as CS from './comparison-state.js';

// ====================================================================
// グローバル状態管理
// ====================================================================
let assetChart = null;
let cashChart = null;
let ddHistChart = null;
let uwHistChart = null;
let lastSimResult = null;
let isRunning = false;
let isResultDirty = false;  // 入力変更後未実行状態フラグ
let lastExecutedParams = null;      // 最後に成功した実行パラメータ
let lastMainExecutionMs = null;     // 実行時間ミリ秒
window.lastMainExecutionMs = null;

// ====================================================================
// i18n 周辺関数
// ====================================================================
let isTranslating = false;
function applyTranslations() {
    if (isTranslating) return;
    isTranslating = true;
    try {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        document.querySelectorAll('[data-i18n-attr]').forEach(el => {
            const spec = el.getAttribute('data-i18n-attr').split(':');
            if (spec.length === 2) el.setAttribute(spec[0], t(spec[1]));
        });
        document.title = t('header.title');
    } finally {
        isTranslating = false;
    }
}

// MutationObserver: 動的に追加された要素の翻訳を保証する（ES2020非依存）
var translationObserver = null;
function setupTranslationObserver() {
    if (translationObserver) translationObserver.disconnect();
    translationObserver = new MutationObserver(function (mutations) {
        var needsTranslation = false;
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute && node.hasAttribute('data-i18n')) {
                            needsTranslation = true;
                            break;
                        }
                        if (node.querySelector && node.querySelector('[data-i18n]')) {
                            needsTranslation = true;
                            break;
                        }
                    }
                }
            }
            if (needsTranslation) break;
        }
        if (needsTranslation) {
            applyTranslations();
        }
    });
    translationObserver.observe(document.body, { childList: true, subtree: true });
}
setupTranslationObserver();

// ====================================================================
// ツールチップ初期化（静的・動的を問わず全てのツールチップに適用）
// ====================================================================
function initTooltips() {
    const tooltipContainer = document.getElementById('tooltip-container');
    if (!tooltipContainer) return;

    document.querySelectorAll('.tooltip-container').forEach(trigger => {
        const tooltip = trigger.querySelector('.tooltip-text');
        if (!tooltip) return;

        // ツールチップ本体を body 直下の専用領域に移動（まだ移動していない場合のみ）
        if (tooltip.parentElement !== tooltipContainer) {
            tooltipContainer.appendChild(tooltip);
        }

        // 既存のリスナーを削除してから再設定（重複防止）
        const removeListeners = () => {
            trigger.removeEventListener('mouseenter', trigger._mouseEnterHandler);
            trigger.removeEventListener('mouseleave', trigger._mouseLeaveHandler);
            trigger.removeEventListener('focusin', trigger._focusInHandler);
            trigger.removeEventListener('focusout', trigger._focusOutHandler);
        };
        removeListeners();

        const positionTooltip = () => {
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipHeight = tooltip.offsetHeight;
            const tooltipWidth = tooltip.offsetWidth;
            const viewportWidth = window.innerWidth;

            let left = triggerRect.left + triggerRect.width / 2;
            const tooltipMargin = 16;
            const tooltipRight = left + tooltipWidth / 2;
            if (tooltipRight > viewportWidth - tooltipMargin) {
                left = viewportWidth - tooltipWidth / 2 - tooltipMargin;
            }
            const tooltipLeft = left - tooltipWidth / 2;
            if (tooltipLeft < tooltipMargin) {
                left = tooltipWidth / 2 + tooltipMargin;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${triggerRect.top - tooltipHeight - tooltipMargin}px`;
            tooltip.style.transform = 'translateX(-50%)';
        };

        const mouseEnterHandler = () => {
            positionTooltip();
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            window.addEventListener('scroll', positionTooltip);
        };
        const mouseLeaveHandler = () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
            window.removeEventListener('scroll', positionTooltip);
        };

        // ハンドラを保存して後で削除できるようにする
        trigger._mouseEnterHandler = mouseEnterHandler;
        trigger._mouseLeaveHandler = mouseLeaveHandler;
        trigger._focusInHandler = mouseEnterHandler;  // focusin は同じ処理
        trigger._focusOutHandler = mouseLeaveHandler; // focusout は同じ処理

        trigger.addEventListener('mouseenter', mouseEnterHandler);
        trigger.addEventListener('mouseleave', mouseLeaveHandler);
        trigger.addEventListener('focusin', mouseEnterHandler);
        trigger.addEventListener('focusout', mouseLeaveHandler);
    });
}

// t分布自由度パネルの更新（i18n対応・モジュールレベル）
function updateDfPanel() {
    const dfToggle = document.getElementById('simDfToggle');
    const dfAutoDisplayWrapper = document.getElementById('dfAutoDisplayWrapper');
    const dfManualWrapper = document.getElementById('dfManualWrapper');
    const volatilityInput = document.getElementById('volatilityNum');
    if (!dfToggle) return;

    if (!dfToggle.checked) {
        // 固定 (unchecked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.add('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.remove('h-0', 'opacity-50', 'pointer-events-none');
            setTimeout(() => { dfManualWrapper.classList.add('opacity-100'); }, 10);
        }
    } else {
        // 自動 (checked)
        if (dfAutoDisplayWrapper) dfAutoDisplayWrapper.classList.remove('hidden');
        if (dfManualWrapper) {
            dfManualWrapper.classList.add('h-0', 'opacity-50', 'pointer-events-none');
            dfManualWrapper.classList.remove('opacity-100');
        }
        // 値の更新
        if (volatilityInput && dfAutoDisplayWrapper) {
            const vol = parseFloat(volatilityInput.value) || 18.0;
            const dfVal = calcAutoDf(vol).toFixed(1);
            const wrappedDf = '<span id="autoDfDisplay" class="font-bold text-indigo-300">' + dfVal + '</span>';
            dfAutoDisplayWrapper.innerHTML = t('market.dfAutoDisplay', [wrappedDf]);
        }
    }
}

/**
 * 現金バッファと月間取崩し額の値を言語に応じて変換する
 * @param {string} targetLang - 'ja' または 'en'
 */
function convertCurrencyInputs(targetLang) {
    const cashInput = document.getElementById('initialCashBufferNum');
    const expenseInput = document.getElementById('monthlyExpenseNum');
    if (!cashInput || !expenseInput) return;

    // 現在の値を取得（カンマ除去）
    let cashVal = parseFloat(cashInput.value.replace(/,/g, ''));
    let expenseVal = parseFloat(expenseInput.value.replace(/,/g, ''));
    if (isNaN(cashVal)) cashVal = 0;
    if (isNaN(expenseVal)) expenseVal = 0;

    // ステップ・min・max を取得
    let cashStep = parseFloat(cashInput.getAttribute('step') || '500');
    let expenseStep = parseFloat(expenseInput.getAttribute('step') || '5');
    let cashMin = parseFloat(cashInput.getAttribute('min') || '0');
    let expenseMin = parseFloat(expenseInput.getAttribute('min') || '0');
    let cashMax = parseFloat(cashInput.getAttribute('max') || '10000');
    let expenseMax = parseFloat(expenseInput.getAttribute('max') || '500');

    if (targetLang === 'en') {
        // 日本語 → 英語（万円 → ドル、÷10）
        cashVal = cashVal / 10;
        expenseVal = expenseVal / 10;
        cashStep = cashStep / 10;
        expenseStep = expenseStep / 10;
        cashMin = cashMin / 10;
        expenseMin = expenseMin / 10;
        cashMax = cashMax / 10;
        expenseMax = expenseMax / 10;
    } else {
        // 英語 → 日本語（ドル → 万円、×10）
        cashVal = cashVal * 10;
        expenseVal = expenseVal * 10;
        cashStep = cashStep * 10;
        expenseStep = expenseStep * 10;
        cashMin = cashMin * 10;
        expenseMin = expenseMin * 10;
        cashMax = cashMax * 10;
        expenseMax = expenseMax * 10;
    }

    // 表示用フォーマット（整数の場合は小数点以下を表示しない）
    const formatNumber = (val) => {
        if (Number.isInteger(val)) return val.toString();
        return val.toFixed(1);
    };

    cashInput.value = formatNumber(cashVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    expenseInput.value = formatNumber(expenseVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // 属性を更新
    cashInput.setAttribute('step', cashStep.toString());
    expenseInput.setAttribute('step', expenseStep.toString());
    cashInput.setAttribute('min', cashMin.toString());
    expenseInput.setAttribute('min', expenseMin.toString());
    cashInput.setAttribute('max', cashMax.toString());
    expenseInput.setAttribute('max', expenseMax.toString());

    // 変更イベントを発火（dirty状態更新のため）
    cashInput.dispatchEvent(new Event('input', { bubbles: true }));
    expenseInput.dispatchEvent(new Event('input', { bubbles: true }));
}


function setupLangSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            if (lang === 'ja' || lang === 'en') {
                setLanguage(lang);
            }
        });
    });
}

function updateActiveLangButton() {
    const lang = getLanguage();
    document.querySelectorAll('.lang-btn').forEach(btn => {
        // クラスの切り替え
        btn.classList.toggle('active', btn.dataset.lang === lang);
        // ARIA属性も更新（アクセシビリティ向上）
        if (btn.dataset.lang === lang) {
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.setAttribute('aria-pressed', 'false');
        }
    });
}

// ====================================================================
// 入力パラメータのDOM取得とバリデーション
// ====================================================================
function markInputChanged() {
    coreMarkInputChanged(); // 内部で setDirty(true) とボタン無効化を実行
    if (lastSimResult) {
        const params = getParams();
        updateSummaryCard(lastSimResult, params);
    }
}

function getParams() {
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
// ダウンサイドフォーカス適用
// ====================================================================
function applyDownsideFocus(chart, enabled) {
    // まず全 dataset の表示・非表示を確定する
    chart.data.datasets.forEach((ds, i) => {
        const pct = parseInt(ds.label, 10);
        const visible = !enabled || pct <= 50;
        chart.setDatasetVisibility(i, visible);
    });

    // ファンチャートの fill 補正:
    let firstVisible = true;
    chart.data.datasets.forEach((ds) => {
        const pct = parseInt(ds.label, 10);
        const visible = !enabled || pct <= 50;
        if (visible) {
            if (firstVisible) {
                ds.fill = false;
                firstVisible = false;
            } else {
                ds.fill = '-1';
            }
        }
    });

    chart.update('none');
}



// ====================================================================
function setupHybridInputs() {
    const buttons = document.querySelectorAll('.stepper-btn');

    // 各インプットフィールドの属性から小数点以下の表示桁数を判定する
    function getPrecision(input) {
        const stepAttr = input.getAttribute('step') || "1";
        // リアルタイムの画面表示値を使用（カンマ除去）
        const currentValue = (input.value || "0").replace(/,/g, '');

        if (stepAttr.includes('.')) {
            return stepAttr.split('.')[1].length;
        }
        if (currentValue.includes('.')) {
            return currentValue.split('.')[1].length;
        }
        return 0;
    }

    buttons.forEach(btn => {
        let intervalId;
        let timeoutId;
        let isLongPress = false; // 長押し中フラグ（clickとの重複防止）

        const startIncrement = () => {
            isLongPress = true;
            updateValue();
            // 最初の遅延後に連続更新開始
            timeoutId = setTimeout(() => {
                intervalId = setInterval(updateValue, 50);
            }, 400); // 400ms長押しで連続開始
        };

        const stopIncrement = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            // clickイベントとの競合（二重発火）を防ぐため、フラグクリアを遅延させる
            setTimeout(() => {
                isLongPress = false;
            }, 50);
        };

        const updateValue = () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            let val = Number(input.value.replace(/,/g, ''));
            const step = Number(input.getAttribute('step')) || 1;
            const min = Number(input.getAttribute('min'));
            const max = Number(input.getAttribute('max'));
            const isIncrement = btn.classList.contains('increment');

            if (isIncrement) {
                val += step;
            } else {
                val -= step;
            }

            // min, max でクランプ
            let clamped = false;
            if (val < min) { val = min; clamped = true; }
            if (val > max) { val = max; clamped = true; }

            if (clamped) {
                const container = input.closest('.stepper-value-container');
                if (container) {
                    container.classList.add('ring-2', 'ring-rose-500', 'ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        container.classList.remove('ring-2', 'ring-rose-500');
                        setTimeout(() => container.classList.remove('ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300'), 300);
                    }, 500);
                } else {
                    input.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => input.classList.remove('ring-2', 'ring-rose-500'), 500);
                }
            }

            // 浮動小数点の丸め誤差を防ぎ、かつHTML属性に基づく表示桁数を維持する
            const precision = getPrecision(input);
            const formatted = val.toFixed(precision);

            if (input.classList.contains('formatted-number')) {
                const parts = formatted.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                input.value = parts.join('.');
            } else {
                input.value = formatted;
            }

            // 値が変更されたらイベントを発火（フォーカス時に実行ボタン等と連携する場合に備え）
            input.dispatchEvent(new Event('input', { bubbles: true }));
            markInputChanged();
        };

        // マウスタッチイベントの登録
        btn.addEventListener('mousedown', (e) => {
            // 左クリックのみ反応
            if (e.button !== 0) return;
            e.preventDefault();
            startIncrement();
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // デフォルトのスワイプ等を防ぐ
            startIncrement();
        });

        btn.addEventListener('mouseup', stopIncrement);
        btn.addEventListener('mouseleave', stopIncrement);
        btn.addEventListener('touchend', stopIncrement);
        btn.addEventListener('touchcancel', stopIncrement);

        // キーボード操作 (Enter / Space) による単発増減
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updateValue();
            }
        });
    });

    // 各インプットフィールドにフォーカスが外れた時のバリデーション（範囲内にクランプ）を追加
    document.querySelectorAll('.stepper-input').forEach(input => {
        input.addEventListener('blur', () => {
            let val = Number(input.value.replace(/,/g, ''));
            if (!Number.isFinite(val)) {
                val = Number(input.getAttribute('min')) || 0;
            }
            const min = Number(input.getAttribute('min'));
            const max = Number(input.getAttribute('max'));
            const step = Number(input.getAttribute('step')) || 1;

            let clamped = false;
            if (val < min) { val = min; clamped = true; }
            if (val > max) { val = max; clamped = true; }

            if (clamped) {
                const container = input.closest('.stepper-value-container');
                if (container) {
                    container.classList.add('ring-2', 'ring-rose-500', 'ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        container.classList.remove('ring-2', 'ring-rose-500');
                        setTimeout(() => container.classList.remove('ring-offset-2', 'ring-offset-slate-900', 'transition-all', 'duration-300'), 300);
                    }, 500);
                } else {
                    input.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => input.classList.remove('ring-2', 'ring-rose-500'), 500);
                }
            }

            const precision = getPrecision(input);
            const formatted = val.toFixed(precision);

            if (input.classList.contains('formatted-number')) {
                const parts = formatted.split('.');
                parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
                input.value = parts.join('.');
            } else {
                input.value = formatted;
            }
            markInputChanged();
        });
    });
}

// ====================================================================
// 結果集計（断面パーセンタイル計算）
// ====================================================================
// パーセンタイル入力のパース

// ====================================================================
// 結果集計（限界突破版：単一パス・マルチセレクト & GCゼロアロケーション）
// ====================================================================
// ====================================================================
// Chart.js 描画
// ====================================================================
// パーセンタイル色グラデーション（本数・昇順インデックスで決定）
// 赤→橙→黄→黄緑→緑 のグラデーション
const GRADIENT_COLORS_BY_COUNT = {
    1: ['#f1c40f'],
    2: ['#e74c3c', '#27ae60'],
    3: ['#e74c3c', '#f1c40f', '#27ae60'],
    4: ['#e74c3c', '#f39c12', '#2ecc71', '#27ae60'],
    5: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#27ae60'],
};

/**
 * 昇順インデックス(index)と総本数(total)から色を返す
 * index=0 が最小パーセンタイル（赤寄り）
 */
function getPercentileColorByIndex(index, total) {
    const palette = GRADIENT_COLORS_BY_COUNT[Math.min(total, 5)] || GRADIENT_COLORS_BY_COUNT[5];
    return palette[Math.min(index, palette.length - 1)];
}

// X軸ラベル生成（インデックスのみ、tick callbackで年表示）
function generateLabels(dataLen) {
    const labels = [];
    for (let t = 0; t < dataLen; t++) labels.push(t);
    return labels;
}

// X軸 tick callback: 適切な年間隔でラベルを表示
function xTickCallback(value, index) {
    const totalMonths = this.chart.data.labels.length - 1;
    const totalYears = totalMonths / 12;
    let interval;
    if (totalYears <= 15) interval = 2;
    else if (totalYears <= 40) interval = 5;
    else interval = 10;
    if (index % (interval * 12) === 0) return formatYears(Math.round(index / 12));
    return null;
}

// ツールチップのタイトル（経過年数を常に表示）
function tooltipTitleCallback(tooltipItems) {
    const index = tooltipItems[0].dataIndex;
    const year = Math.floor(index / 12);
    const month = index % 12;
    const lang = getLanguage() || '';
    const isJa = lang.startsWith('ja');
    if (month === 0) {
        return isJa ? t('chart.tooltip.year', [year]) : t('chart.tooltip.year', [year]);
    }
    return t('chart.tooltip.yearMonth', [year, month]);
}

function renderAssetChart(result, isLogScale) {
    const { percentiles, totalPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('assetChartCanvas').getContext('2d');

    if (assetChart) { assetChart.destroy(); assetChart = null; }

    // データセットを降順（高パーセンタイル低）で作成
    // 色は昇順インデックス(origIdx)と総本数で決定する
    const orderedPercentiles = [...percentiles].reverse();
    const total = percentiles.length;
    const datasets = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct); // 昇順での位置
        const color = getPercentileColorByIndex(origIdx, total);
        let data;
        if (isLogScale) {
            data = Array.from(totalPercentileData[origIdx]).map(v => (v > 0 ? v : null));
        } else {
            data = Array.from(totalPercentileData[origIdx]);
        }

        // ファンチャート化: 一番上の線（パーセンタイル最高値）以外は、一つ上の線までをグラデーションで塗りつぶす
        const fillMode = (idx === 0) ? false : '-1';

        return {
            label: (getLanguage() || '').startsWith('ja') ? `${pct}％` : `${pct}%`,
            data: data,
            borderColor: color,
            backgroundColor: color + '26', // HEXアルファ (26=約15%の透明度で一律塗りつぶし)
            borderWidth: pct === 50 ? 2.5 : 1.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: fillMode,
            spanGaps: true,
        };
    });

    assetChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    itemSort: function (a, b) {
                        return (b.parsed.y || 0) - (a.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context) {
                            const allItems = context.chart.tooltip.dataPoints;
                            // ラベル部分の最大文字数を算出（1桁vs2桁のパーセンタイル桁そろえ）
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = context.dataset.label.padStart(maxLblLen);

                            // IIFEにより、外側のスコープの変数との衝突を回避する
                            return (function () {
                                const v = context.parsed.y;
                                const lang = getLanguage() || '';
                                const isJa = lang.startsWith('ja');
                                if (v === null || v === undefined) {
                                    return isJa ? `${lbl}:  億円` : `${lbl}:  B JPY`;
                                }
                                if (isJa) {
                                    const oku = (v / 100000000).toFixed(2);
                                    const maxLen = Math.max(...allItems.map(item => {
                                        const iv = item.parsed.y;
                                        return (iv !== null && iv !== undefined) ? (iv / 100000000).toFixed(2).length : 1;
                                    }));
                                    return `${lbl}:${oku.padStart(maxLen + 1)} 億円`;
                                }
                                return `${lbl}: ${formatCurrency(v, '億円')}`;
                            })();
                        },
                    },
                },
                legend: {
                    labels: {
                        color: '#cbd5e1',
                        font: { size: 13 },
                        boxWidth: 16,
                        boxHeight: 2,
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: xTickCallback,
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                },
                y: {
                    type: isLogScale ? 'logarithmic' : 'linear',
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) {
                            // 対数スケール時: Y軸の表示桁幅（オーダー）による動的間引きアルゴリズム
                            const chart = this.chart;
                            const isLog = chart.options.scales.y.type === 'logarithmic';
                            if (isLog) {
                                // 現在のY軸の最小値最大値から表示桁幅を算出
                                const yMin = chart.scales.y.min || 10_000_000;
                                const yMax = chart.scales.y.max || 1_000_000_000;
                                const minOrder = Math.floor(Math.log10(yMin / 100000000));
                                const maxOrder = Math.floor(Math.log10(yMax / 100000000));
                                const orderRange = Math.max(1, maxOrder - minOrder + 1);

                                const exponent = Math.floor(Math.log10(value));
                                const mantissa = value / Math.pow(10, exponent);

                                // 桁幅の種類が4つ以上なら、間引きを強化して10の累乗(mantissa=1)のみ表示
                                if (orderRange >= 4) {
                                    if (Math.abs(mantissa - 1) > 0.05) return null;
                                } else {
                                    // 1, 2, 4, 6 に変更して重なりを解消
                                    const allowed = [1, 2, 4, 6];
                                    const isAllowed = allowed.some(a => Math.abs(mantissa - a) < 0.05);
                                    if (!isAllowed) return null;
                                }
                            }
                            return formatCurrency(value, value >= 1e8 ? '億円' : '万円');
                        },
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false },
                },
            },
        },
    });

    // ダウンサイドフォーカス初期適用
    const dfToggleAsset = document.getElementById('downsideFocusAsset');
    if (dfToggleAsset && dfToggleAsset.checked) {
        applyDownsideFocus(assetChart, true);
    }
}

function renderCashChart(result) {
    const { percentiles, cashPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('cashChartCanvas').getContext('2d');

    if (cashChart) { cashChart.destroy(); cashChart = null; }

    // データセットを降順（高パーセンタイル低）で作成
    // 色は昇順インデックス(origIdx)と総本数で決定する
    const orderedPercentiles = [...percentiles].reverse();
    const total = percentiles.length;
    const datasets = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct);
        const color = getPercentileColorByIndex(origIdx, total);
        const fillMode = (idx === 0) ? false : '-1';

        return {
            label: (getLanguage() || '').startsWith('ja') ? `${pct}％` : `${pct}%`,
            data: Array.from(cashPercentileData[origIdx]),
            borderColor: color,
            backgroundColor: color + '26',
            borderWidth: pct === 50 ? 2.5 : 1.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: fillMode,
            spanGaps: true,
        };
    });

    cashChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    itemSort: function (a, b) {
                        return (b.parsed.y || 0) - (a.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context) {
                            const val = context.parsed.y;
                            const allItems = context.chart.tooltip.dataPoints;
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = context.dataset.label.padStart(maxLblLen);
                            return `${lbl}: ${formatCurrency(val, '万円')}`;
                        },
                    },
                },
                legend: {
                    labels: {
                        color: '#cbd5e1',
                        font: { size: 13 },
                        boxWidth: 16,
                        boxHeight: 2,
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: xTickCallback,
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                },
                y: {
                    type: 'linear',
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) {
                            return formatCurrency(value, value >= 1e8 ? '億円' : '万円');
                        },
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false },
                },
            },
        },
    });

    // ダウンサイドフォーカス初期適用
    const dfToggleCash = document.getElementById('downsideFocusCash');
    if (dfToggleCash && dfToggleCash.checked) {
        applyDownsideFocus(cashChart, true);
    }
}

function renderDdCdfChart(result) {
    const { maxDdPerPath, params } = result;

    // 最大ドローダウン（マイナス値）の配列を昇順ソート
    const sortedDd = Float32Array.from(maxDdPerPath).sort();
    const simPaths = params.simPaths;

    // 同一X座標(-100%での破綻など)に対する「垂直な壁」の発生を防ぐため、Mapで一意化して最大の発生確率を残す
    const pointsMap = new Map();
    const step = Math.max(1, Math.floor(simPaths / 1000));

    for (let i = 0; i < simPaths; i += step) {
        let pct = sortedDd[i] * 100;
        if (pct < -100) pct = -100;
        if (pct > 0) pct = 0;
        // 小数第1位で丸めて一意化
        pct = Math.round(pct * 10) / 10;
        // 昇順イテレーションのため同XならY（累積確率）が上書きされて最大のものが残る
        pointsMap.set(pct, (i + 1) / simPaths * 100);
    }

    // 横軸0% (縦軸100%) の点を強制的に追加してグラフが0%まで伸びるようにする
    if (!pointsMap.has(0)) {
        pointsMap.set(0, 100);
    }

    // Mapから配列に戻してXの昇順でソート（Mapは挿入順なので念のため再ソート）
    const points = Array.from(pointsMap.entries())
        .map(([x, y]) => ({ x, y }))
        .sort((a, b) => a.x - b.x);

    const ctx = document.getElementById('ddHistCanvas').getContext('2d');
    if (ddHistChart) { ddHistChart.destroy(); }

    ddHistChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: t('chart.probability'),
                data: points,
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => t('chart.dd.tooltipTitle'),
                        label: function (context) {
                            if (context.parsed.x === -100) {
                                return [
                                    t('chart.tooltip.deadLabel'),
                                    t('chart.tooltip.probabilityLabel', [context.parsed.y.toFixed(1)])
                                ];
                            }
                            return [
                                t('chart.tooltip.ddWorseLabel', [context.parsed.x.toFixed(1)]),
                                t('chart.tooltip.probabilityLabel', [context.parsed.y.toFixed(1)])
                            ];
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: t('chart.dd.axisTitle'), color: '#94a3b8' },
                    min: -100,
                    max: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 20,
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false }
                }
            }
        }
    });
}

function renderUwCdfChart(result) {
    const { maxUwPerPath, params } = result;

    // 最長停滞期間（プラス値）の配列を昇順ソート
    const sortedUw = Float32Array.from(maxUwPerPath).sort();
    const simPaths = params.simPaths;

    const points = [];
    // 横軸0年 (縦軸100%) の点を強制的に先頭に追加
    points.push({ x: 0, y: 100 });

    // UIの負荷軽減のための間引き幅（約1000点）
    const step = Math.max(1, Math.floor(simPaths / 1000));

    for (let i = 0; i < simPaths; i += step) {
        let mo = sortedUw[i];
        if (points.length > 0 && points[points.length - 1].x === mo) {
            // 超過確率なので、同一月数の場合は「最初の登場（最も高いY）」が数学的に正しい P(X >= mo) となるため、Yは上書き「しない」
        } else {
            points.push({ x: mo, y: (simPaths - i) / simPaths * 100 });
        }
    }
    // 最後の点（一番停滞期間が長かったケース）を確実に拾う
    if ((simPaths - 1) % step !== 0) {
        let mo = sortedUw[simPaths - 1];
        if (points.length > 0 && points[points.length - 1].x === mo) {
            // 同一X回避
        } else {
            points.push({ x: mo, y: 1 / simPaths * 100 });
        }
    }

    const ctx = document.getElementById('uwHistCanvas').getContext('2d');
    if (uwHistChart) { uwHistChart.destroy(); }

    uwHistChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: t('chart.probability'),
                data: points,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => t('chart.uw.tooltipTitle'),
                        label: function (context) {
                            const totalMo = Math.round(context.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.uwLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [context.parsed.y.toFixed(1)])
                            ];
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: t('chart.uw.axisTitle'), color: '#94a3b8' },
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 60, // 5年(60ヵ月)刻みに統一
                        callback: function (value) {
                            return formatYears(value / 12);
                        }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 20,
                        callback: function (value) { return value + "%"; }
                    },
                    grid: { color: 'rgba(100,116,139,0.1)' },
                    title: { display: false }
                }
            }
        }
    });
}

// ====================================================================
// サマリーカード生成（全パラメータとKPIの表示）
// ====================================================================
function updateSummaryCard(result, params) {
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
    applyTranslations();
    initTooltips();
}

// ====================================================================
// 未実行状態のサマリカード描画
// ====================================================================
function renderEmptySummaryCard(cbChecked = false) {
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
    applyTranslations();
    initTooltips();
}

// ====================================================================
// メイン実行関数
// ====================================================================
async function runMain() {
    if (isRunning) return;
    const _analysisStartTime = performance.now();
    isRunning = true;

    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;

    const simSeedInput = document.getElementById('seedNum');
    if (document.getElementById('seedToggle').checked || !simSeedInput.value) {
        simSeedInput.value = Date.now() >>> 0;
    }

    const params = getParams();

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
        window.lastSimOnlyMs = performance.now() - simStartTime;
        lastSimResult = result;
        isResultDirty = false;

        const isLogScale = document.getElementById('logScaleToggle').checked;
        renderAssetChart(result, isLogScale);
        const cashChartCard = document.getElementById('cashChartCanvas')?.closest('.glass-card');
        if (cashChartCard) {
            cashChartCard.style.display = params.cashBufferToggle ? '' : 'none';
        }
        if (params.cashBufferToggle) renderCashChart(result);
        renderDdCdfChart(result);
        renderUwCdfChart(result);
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
        isRunning = false;
        if (lastSimResult) {
            lastExecutedParams = getParams();
            lastMainExecutionMs = performance.now() - _analysisStartTime;
            window.lastMainExecutionMs = lastMainExecutionMs;
            syncBaseToAnalysisIfOpen();
        }
    }
}

// ====================================================================
// 対数/線形スケール切替（再計算なし、グラフ再描画のみ）
// ====================================================================
function onScaleToggle() {
    if (!lastSimResult) return;
    const isLogScale = document.getElementById('logScaleToggle').checked;
    renderAssetChart(lastSimResult, isLogScale);
}



// ====================================================================
// 画像キャプチャ（PNG保存）ロジック
// ====================================================================
async function saveImage() {
    if (!lastSimResult || isRunning) return;
    const btn = document.getElementById('saveImageBtn');
    const originalHtml = btn.innerHTML;

    try {
        // ボタンをローディング状態に
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.savingImage')}`;

        const params = getParams();

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
// イベント登録
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    setProgressCallback((progress) => {
        const btn = document.getElementById('runBtn');
        if (!btn) return;
        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${t('button.running', [progress])}`;
        btn.style.background = `linear-gradient(to right, rgba(99, 102, 241, 0.8) ${progress}%, rgba(30, 41, 59, 1) ${progress}%)`;
    });
    setupHybridInputs();
    setupLangSwitcher();
    document.addEventListener('languageChanged', () => {
        // FIX-10: シミュレーション実行中（app.js本体 or 比較タブ）は言語切り替えをスキップ
        if (isRunning || CS.getIsRunning()) return;
        applyTranslations();
        updateDfPanel();
        // 言語切り替え時に通貨入力値を変換
        convertCurrencyInputs(getLanguage());
        if (lastSimResult && lastExecutedParams) {
            updateSummaryCard(lastSimResult, lastExecutedParams);
        } else {
            renderEmptySummaryCard(document.getElementById('cashBufferToggle')?.checked);
        }
        if (assetChart && lastSimResult) {
            const isLog = document.getElementById('logScaleToggle')?.checked;
            renderAssetChart(lastSimResult, isLog);
            applyDownsideFocus(assetChart, document.getElementById('downsideFocusAsset')?.checked);
        }
        if (cashChart && lastSimResult) {
            renderCashChart(lastSimResult);
            applyDownsideFocus(cashChart, document.getElementById('downsideFocusCash')?.checked);
        }
        if (ddHistChart && lastSimResult) renderDdCdfChart(lastSimResult);
        if (uwHistChart && lastSimResult) renderUwCdfChart(lastSimResult);
        import('./analysis-ui.js').then(AUI => AUI.renderAnalysisTab());
        // 比較タブが開いている場合は再描画
        import('./comparison-ui.js').then(CUI => {
            const compTab = document.getElementById('comparisonTab');
            if (compTab && !compTab.classList.contains('hidden')) {
                CUI.renderComparisonTab();
            }
        }).catch(() => {});
        updateActiveLangButton();
    });
    document.getElementById('runBtn').addEventListener('click', runMain);
    document.getElementById('logScaleToggle').addEventListener('change', onScaleToggle);

    // X共有ボタン画像保存ボタンのイベント登録
    document.getElementById('shareXBtn').addEventListener('click', shareToX);
    document.getElementById('saveImageBtn').addEventListener('click', saveImage);

    // マーケット変動モデル セレクトボックス連動
    const modelSelect = document.getElementById('returnModelSelect');
    const tDistParams = document.getElementById('tDistParams');
    const updateModelPanel = () => {
        if (modelSelect.value === 'log-t') {
            tDistParams.classList.remove('opacity-50', 'pointer-events-none', 'hidden');
            tDistParams.classList.add('opacity-100');
        } else {
            tDistParams.classList.add('opacity-50', 'pointer-events-none', 'hidden');
            tDistParams.classList.remove('opacity-100');
        }
    };
    if (modelSelect) {
        modelSelect.addEventListener('change', updateModelPanel);
        updateModelPanel();
    }

    // 自由度 (自動/固定) トグル連動
    const dfToggle = document.getElementById('simDfToggle');
    const volatilityInput = document.getElementById('volatilityNum');

    if (dfToggle && volatilityInput) {
        dfToggle.addEventListener('change', updateDfPanel);
        volatilityInput.addEventListener('input', () => {
            if (dfToggle.checked) {
                updateDfPanel();
            }
        });
        updateDfPanel();
    }

    // 乱数シード トグル連動
    const seedToggle = document.getElementById('seedToggle');
    const seedInputWrapper = document.getElementById('seedInputWrapper');
    const updateSeedPanel = () => {
        if (!seedToggle) return;
        if (!seedToggle.checked) {
            // 固定 (unchecked)
            seedInputWrapper.classList.remove('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.add('opacity-100');
        } else {
            // ランダム (checked)
            seedInputWrapper.classList.add('opacity-50', 'pointer-events-none');
            seedInputWrapper.classList.remove('opacity-100');
        }
    };
    if (seedToggle) {
        seedToggle.addEventListener('change', updateSeedPanel);
        updateSeedPanel();
    }

    // インフレ変動モデル (AR-1) トグル連動
    const infToggle = document.getElementById('inflationModelToggle');
    const arParamsPanel = document.getElementById('arModelParams');

    const updateArPanel = () => {
        if (infToggle.checked) {
            arParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.add('opacity-100');
        } else {
            arParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            arParamsPanel.classList.remove('opacity-100');
        }
    };

    infToggle.addEventListener('change', updateArPanel);
    updateArPanel(); // 初期ロード時の状態反映

    // 現金バッファ トグル連動（双方向）
    const cbToggle = document.getElementById('cashBufferToggle');
    const cbParamsPanel = document.getElementById('cashBufferParams');
    const cbInput = document.getElementById('initialCashBufferNum');

    // パネルのグレーアウト状態を更新する関数
    const updateCbPanel = () => {
        if (cbToggle.checked) {
            cbParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.add('opacity-100');
        } else {
            cbParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            cbParamsPanel.classList.remove('opacity-100');
        }
    };

    // トグルが変更されたとき → inputの値を更新する
    cbToggle.addEventListener('change', () => {
        if (cbToggle.checked) {
            // ONにした場合：デフォルト値に戻す（現在値が0の場合のみ）
            if (parseFloat(cbInput.value.replace(/,/g, '')) === 0) {
                cbInput.value = DEFAULTS.initialCashBuffer.toLocaleString('en-US');
                cbInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            // OFFにした場合：0に設定
            cbInput.value = '0';
            cbInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        updateCbPanel();
        // 未実行状態ならサマリカードを更新
        if (!lastSimResult) renderEmptySummaryCard(cbToggle.checked);
    });

    // inputの値が変更されたとき → トグル状態を更新する
    cbInput.addEventListener('input', () => {
        const val = parseFloat(cbInput.value.replace(/,/g, ''));
        if (val === 0) {
            if (cbToggle.checked) {
                cbToggle.checked = false;
                updateCbPanel();
            }
        } else {
            if (!cbToggle.checked) {
                cbToggle.checked = true;
                updateCbPanel();
            }
        }
        if (!lastSimResult) renderEmptySummaryCard(cbToggle.checked);
    });

    updateCbPanel(); // 初期ロード時の状態反映

    // 支出ガードレール トグル連動
    const grToggle = document.getElementById('guardrailToggle');
    const grParamsPanel = document.getElementById('guardrailParams');

    const updateGrPanel = () => {
        if (grToggle.checked) {
            grParamsPanel.classList.remove('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.add('opacity-100');
        } else {
            grParamsPanel.classList.add('opacity-50', 'pointer-events-none');
            grParamsPanel.classList.remove('opacity-100');
        }
    };

    grToggle.addEventListener('change', updateGrPanel);
    updateGrPanel();

    // 初期状態の（未実行）サマリカードを描画
    applyTranslations();
    updateActiveLangButton();  // 初期表示時に現在の言語に対応するボタンをアクティブにする
    renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);

    // 言語に応じて初期値を正しく設定する（英語モードでは日本語の初期値 1,000/30 を 100/3 に変換）
    // convertCurrencyInputs は内部でイベント発火も行うため、依存するリスナーも正常に動作する
    const initialLang = getLanguage();
    if (initialLang === 'en') {
        convertCurrencyInputs('en');
    }
    // 日本語モードの場合は HTML のデフォルト値（1,000 / 30）がそのまま使用されるため、追加の処理は不要

    // パラメータが変更されたら未実行サマリを更新または警告バッジを表示するリスナーを各input/selectに追加
    // 表示制御用のトグル（downsideFocusAsset, downsideFocusCash, logScaleToggle）は除外する (v1.8.3修正)
    const simulationTabEl = document.getElementById('simulationTab');
    const inputsAndSelects = simulationTabEl
        ? simulationTabEl.querySelectorAll('input:not(#downsideFocusAsset):not(#downsideFocusCash):not(#logScaleToggle), select')
        : [];
    inputsAndSelects.forEach(el => {
        el.addEventListener('change', () => {
            if (!lastSimResult) {
                renderEmptySummaryCard(document.getElementById('cashBufferToggle').checked);
            } else {
                markInputChanged();
            }
        });
    });

    // ダウンサイドフォーカス トグル連動
    const dfAsset = document.getElementById('downsideFocusAsset');
    const dfCash = document.getElementById('downsideFocusCash');
    if (dfAsset) {
        dfAsset.addEventListener('change', function () {
            if (assetChart && lastSimResult) {
                applyDownsideFocus(assetChart, this.checked);
            }
        });
    }
    if (dfCash) {
        dfCash.addEventListener('change', function () {
            if (cashChart && lastSimResult) {
                applyDownsideFocus(cashChart, this.checked);
            }
        });
    }

    // 比較タブボタン
    const compareTabBtn = document.getElementById('openCompareTabBtn');
    if (compareTabBtn) {
        compareTabBtn.addEventListener('click', openCompareTab);
    }

    // URLコピーボタン
    const copySimUrlBtn = document.getElementById('copySimUrlBtn');
    if (copySimUrlBtn) {
        copySimUrlBtn.addEventListener('click', copySimUrl);
    }

    // URLクエリパラメータの自動設定
    applyQueryParams(runMain);

    // ========== タブ切り替え (v2.2.0 比較タブ追加) ==========
    const simTabBtn = document.getElementById('simTabBtn');
    const analysisTabBtn = document.getElementById('analysisTabBtn');
    const comparisonTabBtn = document.getElementById('comparisonTabBtn');
    const simulationTab = document.getElementById('simulationTab');
    const analysisTabContent = document.getElementById('analysisTab');
    const comparisonTabContent = document.getElementById('comparisonTab');

    // 統一的なタブ切り替え関数（他のタブを確実に非表示にする）
    function switchTab(activeBtn, activeContent) {
        // 全タブボタンを非アクティブ化
        [simTabBtn, analysisTabBtn, comparisonTabBtn].filter(Boolean).forEach(btn => {
            btn.classList.remove('active', 'text-indigo-300');
            btn.classList.add('text-slate-400');
            btn.setAttribute('aria-selected', 'false');
        });
        // 全タブコンテンツを非表示
        [simulationTab, analysisTabContent, comparisonTabContent].filter(Boolean).forEach(content => {
            content.classList.add('hidden');
        });
        // 指定タブのみアクティブ化
        if (activeBtn) {
            activeBtn.classList.add('active', 'text-indigo-300');
            activeBtn.classList.remove('text-slate-400');
            activeBtn.setAttribute('aria-selected', 'true');
        }
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    if (simTabBtn) {
        simTabBtn.addEventListener('click', () => {
            switchTab(simTabBtn, simulationTab);
        });
    }
    if (analysisTabBtn) {
        analysisTabBtn.addEventListener('click', () => {
            switchTab(analysisTabBtn, analysisTabContent);
            syncBaseToAnalysis();
        });
    }
    if (comparisonTabBtn) {
        comparisonTabBtn.addEventListener('click', () => {
            switchTab(comparisonTabBtn, comparisonTabContent);
            // 比較タブを初めて開いたとき、またはすでに初期化済みの場合は再描画
            import('./comparison-ui.js').then(CUI => {
                if (!comparisonTabContent.dataset.initialized) {
                    // 初回：現在のシミュレーションパラメータで初期化
                    import('./params-accessor.js').then(PA => {
                        import('./comparison-state.js').then(CS => {
                            const simParams = PA.getCurrentSimParams();
                            const inputs = CS.createInputsFromSimParams(simParams);
                            CUI.initComparisonTab(inputs);
                            comparisonTabContent.dataset.initialized = 'true';
                        });
                    });
                } else {
                    CUI.renderComparisonTab();
                }
            }).catch(e => console.error('comparison-ui load error', e));
        });
    }
    import('./analysis-ui.js').then(AUI => { AUI.setupAnalysisEventDelegation(); })
        .catch(e => console.error('analysis-ui load error', e));

    // タブバー固定（CSS sticky が効かない環境へのフォールバック）
    const tabNavBar = document.querySelector('.tab-nav-bar');
    if (tabNavBar) {
        const sentinel = document.createElement('div');
        tabNavBar.parentNode.insertBefore(sentinel, tabNavBar);

        const observer = new IntersectionObserver(([entry]) => {
            const isSticky = entry.intersectionRatio < 1;
            if (isSticky) {
                // 固定時の幅を確定させるために、元のサイズを取得
                const originalWidth = tabNavBar.offsetWidth;
                tabNavBar.style.position = 'fixed';
                tabNavBar.style.top = '0';
                tabNavBar.style.zIndex = '100';
                tabNavBar.style.width = originalWidth + 'px';
                // 左右中央揃えを維持
                tabNavBar.style.left = '50%';
                tabNavBar.style.transform = 'translateX(-50%)';
            } else {
                tabNavBar.style.position = '';
                tabNavBar.style.top = '';
                tabNavBar.style.zIndex = '';
                tabNavBar.style.width = '';
                tabNavBar.style.left = '';
                tabNavBar.style.transform = '';
            }
        }, { threshold: [1] });

        observer.observe(sentinel);
    }

    // ツールチップ初期化（静的要素用）
    initTooltips();

    // ====================================================================
    // ダウンサイドフォーカス適用
    // ====================================================================
    function shareToX() {
        if (!lastSimResult || getIsResultDirty()) return;
        const p = getParams();
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

    function openCompareTab() {
        if (!lastSimResult || getIsResultDirty()) return;
        const p = getParams();
        const url = buildSimulationUrl(p, {
            autoRun: false, fixedSeed: true,
            seed: lastSimResult.usedSeed,
            percentileRaw: document.getElementById('percentileInput').value,
            lang: getLanguage()
        });
        window.open(url.toString(), '_blank');
    }

    async function copySimUrl() {
        if (!lastSimResult || getIsResultDirty()) return;
        const btn = document.getElementById('copySimUrlBtn');
        if (btn.disabled) return;
        const originalHtml = btn.innerHTML;
        const p = getParams();
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

    function syncBaseToAnalysis() {
        if (!lastSimResult || !lastExecutedParams) return;
        const ep = convertToEffectiveParams(lastExecutedParams, lastSimResult);
        import('./analysis-state.js').then(AS => {
            AS.setBaseContext({ source: 'LAST_MAIN_RUN', effectiveParams: ep, summary: { successRatePct: lastSimResult.successRate, finalMedianJpy: lastSimResult.finalMedian, worst10MaxDdPct: lastSimResult.worst10MaxDd } }, ep);
            import('./analysis-ui.js').then(AUI => AUI.renderAnalysisTab()).catch(e => console.error(e));
        }).catch(e => console.error(e));
    }
    function syncBaseToAnalysisIfOpen() {
        const tab = document.getElementById('analysisTab');
        if (tab && !tab.classList.contains('hidden')) syncBaseToAnalysis();
    }
    function convertToEffectiveParams(params, simResult) {
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
});
