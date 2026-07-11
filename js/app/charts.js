// ====================================================================
// js/app/charts.js
// グラフ描画関数群（Chart.js ラッパー）
// 依存: i18n.js, app/state.js のみ（循環インポート防止）
// ====================================================================

import { t, formatCurrency, formatYears, getLanguage } from '../i18n.js';
import {
    getAssetChart, setAssetChart,
    getCashChart, setCashChart,
    getDdHistChart, setDdHistChart,
    getUwHistChart, setUwHistChart,
    getBelowInitChart, setBelowInitChart,
    getSellChart, setSellChart,
    getLastSimResult,
} from './state.js';

// ====================================================================
// パーセンタイル色グラデーション（本数・昇順インデックスで決定）
// 赤→橙→黄→黄緑→緑 のグラデーション
// ====================================================================
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
    for (let i = 0; i < dataLen; i++) labels.push(i);
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
    if (month === 0) {
        return t('chart.tooltip.year', [year]);
    }
    return t('chart.tooltip.yearMonth', [year, month]);
}

// ====================================================================
// カスタムツールチップポジショナー（CCDFグラフ用）
// ポイントの真上（スペース不足時は真下）に配置し、ポイントを覆わない
// ====================================================================
const customTooltipPosition = function(items) {
    const chart = this.chart;
    const { top } = chart.chartArea;
    const item = items[0];
    if (!item) return { x: 0, y: 0 };

    const x = item.element.x;
    const y = item.element.y;

    // Y軸のアライメント判定（上部余白が足りない場合のみ下側に配置）
    let yAlignVal = 'bottom';
    // ツールチップの概算高さ(約40px)+マージン(12px)を考慮して判定
    if (y - 52 < top) {
        yAlignVal = 'top';
    }

    return {
        x: x,
        y: y,
        xAlign: 'center',
        yAlign: yAlignVal
    };
};

// テスト環境などでグローバルな Chart オブジェクトが存在しない場合のエラーを防ぐため、存在確認後に登録する
if (typeof Chart !== 'undefined' && Chart.Tooltip && Chart.Tooltip.positioners) {
    Chart.Tooltip.positioners.customTooltipPosition = customTooltipPosition;
}

// ====================================================================
// ダウンサイドフォーカス適用
// ====================================================================
export function applyDownsideFocus(chart, enabled) {
    // チャートインスタンスが不完全な状態で呼ばれた場合のガード（言語切替タイミング等）
    if (!chart || !chart.data) return;
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
// v2.3.0: 共通 CCDF 点生成ヘルパー（UI負荷軽減のための間引き付き）
// ====================================================================
export function buildCdfPoints(sortedData, simPaths, mode = 'ccdf') {
    const pointsMap = new Map();
    for (let i = 0; i < sortedData.length; i++) {
        const x = sortedData[i];
        let y;
        if (mode === 'cdf') {
            // CDF: P(X <= x) → 後勝ち（最後の出現）で計算
            y = (i + 1) / simPaths * 100;
        } else {
            // CCDF: P(X >= x) → 先勝ち（最初の出現）で計算
            if (pointsMap.has(x)) continue;
            y = (simPaths - i) / simPaths * 100;
        }
        pointsMap.set(x, y);
    }
    // 横軸 0 の点を追加（すべてのグラフで必要）
    pointsMap.set(0, 100);
    return Array.from(pointsMap.entries())
        .map(([x, y]) => ({ x, y }))
        .sort((a, b) => a.x - b.x);
}

// ====================================================================
// 資産推移グラフ描画
// ====================================================================
export function renderAssetChart(result, isLogScale) {
    const { percentiles, totalPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('assetChartCanvas').getContext('2d');

    const currentChart = getAssetChart();
    if (currentChart) { currentChart.destroy(); setAssetChart(null); }

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

    const newChart = new Chart(ctx, {
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

    setAssetChart(newChart);

    // ダウンサイドフォーカス初期適用
    const dfToggleAsset = document.getElementById('downsideFocusAsset');
    if (dfToggleAsset && dfToggleAsset.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// 現金バッファ推移グラフ描画
// ====================================================================
export function renderCashChart(result) {
    const { percentiles, cashPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('cashChartCanvas').getContext('2d');

    const currentChart = getCashChart();
    if (currentChart) { currentChart.destroy(); setCashChart(null); }

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

    const newChart = new Chart(ctx, {
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

    setCashChart(newChart);

    // ダウンサイドフォーカス初期適用
    const dfToggleCash = document.getElementById('downsideFocusCash');
    if (dfToggleCash && dfToggleCash.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// 最大ドローダウン CDF グラフ描画
// ====================================================================
export function renderDdCdfChart(result) {
    const { maxDdPerPath, params } = result;
    const simPaths = params.simPaths;

    // 最大ドローダウン（マイナス値）を%換算し、制限と丸めを施して昇順ソート
    const sortedDd = Float32Array.from(maxDdPerPath)
        .map(v => {
            let pct = v * 100;
            if (pct < -100) pct = -100;
            if (pct > 0) pct = 0;
            return Math.round(pct * 10) / 10;
        })
        .sort();

    // buildCdfPoints で点生成
    const rawPoints = buildCdfPoints(sortedDd, simPaths, 'cdf');
    // 横軸が負の値なので、Xの昇順で再ソートする（先頭に追加された { x: 0, y: 100 } を末尾に持っていくため）
    const points = rawPoints.sort((a, b) => a.x - b.x);

    const ctx = document.getElementById('ddHistCanvas').getContext('2d');
    const currentChart = getDdHistChart();
    if (currentChart) { currentChart.destroy(); }

    setDdHistChart(new Chart(ctx, {
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
                    position: 'customTooltipPosition',
                    caretSize: 0,
                    caretPadding: 12,
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
                legend: { display: false }
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
    }));
}

// ====================================================================
// 最長水面下期間 CCDF グラフ描画
// ====================================================================
export function renderUwCdfChart(result) {
    const { maxUwPerPath, params } = result;

    // 最長停滞期間（プラス値）の配列を昇順ソート
    const sortedUw = Float32Array.from(maxUwPerPath).sort();
    const simPaths = params.simPaths;

    const points = buildCdfPoints(sortedUw, simPaths);

    const ctx = document.getElementById('uwHistCanvas').getContext('2d');
    const currentChart = getUwHistChart();
    if (currentChart) { currentChart.destroy(); }

    setUwHistChart(new Chart(ctx, {
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
                    position: 'customTooltipPosition',
                    caretSize: 0,
                    caretPadding: 12,
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
                legend: { display: false }
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
    }));
}

// ====================================================================
// v2.3.0: 初期総資産割れ 継続期間 CCDF グラフ描画
// ====================================================================
export function renderBelowInitCdfChart(result) {
    const { belowInitPeriods, params } = result;
    const sorted = Float32Array.from(belowInitPeriods).sort();
    const points = buildCdfPoints(sorted, params.simPaths);
    const ctx = document.getElementById('belowInitChartCanvas').getContext('2d');
    const currentChart = getBelowInitChart();
    if (currentChart) { currentChart.destroy(); }
    setBelowInitChart(new Chart(ctx, {
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
                    position: 'customTooltipPosition',
                    caretSize: 0,
                    caretPadding: 12,
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => t('chart.belowInit.title'),
                        label: function (context) {
                            const totalMo = Math.round(context.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.belowInitLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [context.parsed.y.toFixed(1)])
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: t('chart.belowInit.axisTitle'), color: '#94a3b8' },
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 60, // 5年(60ヵ月)刻み
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
    }));
}

// ====================================================================
// v2.3.0: リスク資産連続売却期間 CCDF グラフ描画
// ====================================================================
export function renderConsecutiveSellCdfChart(result) {
    const { consecutiveSellPeriods, params } = result;
    const sorted = Float32Array.from(consecutiveSellPeriods).sort();
    const points = buildCdfPoints(sorted, params.simPaths);
    const ctx = document.getElementById('sellChartCanvas').getContext('2d');
    const currentChart = getSellChart();
    if (currentChart) { currentChart.destroy(); }
    setSellChart(new Chart(ctx, {
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
                    position: 'customTooltipPosition',
                    caretSize: 0,
                    caretPadding: 12,
                    bodyFont: { family: "'Courier New', Courier, monospace", size: 12 },
                    titleFont: { family: "'Inter', system-ui, sans-serif", size: 13 },
                    callbacks: {
                        title: () => t('chart.sell.title'),
                        label: function (context) {
                            const totalMo = Math.round(context.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.sellLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [context.parsed.y.toFixed(1)])
                            ];
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: t('chart.sell.axisTitle'), color: '#94a3b8' },
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 13 },
                        stepSize: 60, // 5年(60ヵ月)刻み
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
    }));
}

// ====================================================================
// 対数/線形スケール切替（再計算なし、グラフ再描画のみ）
// ====================================================================
export function onScaleToggle() {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult) return;
    const isLogScale = document.getElementById('logScaleToggle').checked;
    renderAssetChart(lastSimResult, isLogScale);
}
