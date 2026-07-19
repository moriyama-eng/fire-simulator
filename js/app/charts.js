// ====================================================================
// js/app/charts.js
// Collection of chart rendering functions (Chart.js wrappers)
// Dependencies: i18n.js and app/state.js only (to prevent circular imports)
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
// Percentile color gradient (determined by count and ascending index)
// Gradient from red → orange → yellow → yellow-green → green
// ====================================================================
const GRADIENT_COLORS_BY_COUNT = {
    1: ['#f1c40f'],
    2: ['#e74c3c', '#27ae60'],
    3: ['#e74c3c', '#f1c40f', '#27ae60'],
    4: ['#e74c3c', '#f39c12', '#2ecc71', '#27ae60'],
    5: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#27ae60'],
};

/**
 * Returns a color based on the ascending index (index) and total count (total)
 * index=0 corresponds to the lowest percentile (toward red)
 */
function getPercentileColorByIndex(index, total) {
    const palette = GRADIENT_COLORS_BY_COUNT[Math.min(total, 5)] || GRADIENT_COLORS_BY_COUNT[5];
    return palette[Math.min(index, palette.length - 1)];
}

// Generate X-axis labels (index only, year is displayed via tick callback)
function generateLabels(dataLen) {
    const labels = [];
    for (let i = 0; i < dataLen; i++) labels.push(i);
    return labels;
}

// X-axis tick callback: display labels at appropriate year intervals
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

// Tooltip title (always show elapsed years)
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
// Custom tooltip positioner (for CCDF charts)
// Placed directly above the point (below if space is insufficient) to avoid covering the point
// ====================================================================
const customTooltipPosition = function(items) {
    const chart = this.chart;
    const { top } = chart.chartArea;
    const item = items[0];
    if (!item) return { x: 0, y: 0 };

    const x = item.element.x;
    const y = item.element.y;

    // Determine Y-axis alignment (place below only when there is insufficient space above)
    let yAlignVal = 'bottom';
    // Determine position considering the estimated tooltip height (~40px) + margin (12px)
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

// Guard against errors when a global Chart object does not exist (e.g., in test environments); register only if it exists
if (typeof Chart !== 'undefined' && Chart.Tooltip && Chart.Tooltip.positioners) {
    Chart.Tooltip.positioners.customTooltipPosition = customTooltipPosition;
}

// ====================================================================
// Apply downside focus
// ====================================================================
export function applyDownsideFocus(chart, enabled) {
    // Guard against being called when the chart instance is in an incomplete state (e.g., during language switching)
    if (!chart || !chart.data) return;
    // First, determine the visibility of all datasets
    chart.data.datasets.forEach((ds, i) => {
        const pct = parseInt(ds.label, 10);
        const visible = !enabled || pct <= 50;
        chart.setDatasetVisibility(i, visible);
    });

    // Fan chart fill correction:
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
// v2.3.0: Common CCDF point generation helper (with thinning for reduced UI load)
// ====================================================================
export function buildCdfPoints(sortedData, simPaths, mode = 'ccdf') {
    const pointsMap = new Map();
    for (let i = 0; i < sortedData.length; i++) {
        const x = sortedData[i];
        let y;
        if (mode === 'cdf') {
            // CDF: P(X <= x) → last-wins (last occurrence) calculation
            y = (i + 1) / simPaths * 100;
        } else {
            // CCDF: P(X >= x) → first-wins (first occurrence) calculation
            if (pointsMap.has(x)) continue;
            y = (simPaths - i) / simPaths * 100;
        }
        pointsMap.set(x, y);
    }
    // Add a point at x=0 on the horizontal axis (required for all charts)
    pointsMap.set(0, 100);
    return Array.from(pointsMap.entries())
        .map(([x, y]) => ({ x, y }))
        .sort((a, b) => a.x - b.x);
}

// ====================================================================
// Asset trend chart rendering
// ====================================================================
export function renderAssetChart(result, isLogScale) {
    const { percentiles, totalPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('assetChartCanvas').getContext('2d');

    const currentChart = getAssetChart();
    if (currentChart) { currentChart.destroy(); setAssetChart(null); }

    // Create datasets in descending order (highest percentile first)
    // Color is determined by ascending index (origIdx) and total count
    const orderedPercentiles = [...percentiles].reverse();
    const total = percentiles.length;
    const datasets = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct); // Position in ascending order
        const color = getPercentileColorByIndex(origIdx, total);
        let data;
        if (isLogScale) {
            data = Array.from(totalPercentileData[origIdx]).map(v => (v > 0 ? v : null));
        } else {
            data = Array.from(totalPercentileData[origIdx]);
        }

        // Fan chart: all lines except the topmost (highest percentile) are filled with a gradient up to the line above
        const fillMode = (idx === 0) ? false : '-1';

        return {
            label: (getLanguage() || '').startsWith('ja') ? `${pct}％` : `${pct}%`,
            data: data,
            borderColor: color,
            backgroundColor: color + '26', // HEX alpha (26 = approx. 15% opacity, uniform fill)
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
                            // Calculate the maximum number of characters in the label part (align digits for 1-digit vs 2-digit percentiles)
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = context.dataset.label.padStart(maxLblLen);

                            // Use IIFE to avoid variable collisions with outer scope variables
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
                            // Logarithmic scale: dynamic thinning algorithm based on display digit width (order) of the Y-axis
                            const chart = this.chart;
                            const isLog = chart.options.scales.y.type === 'logarithmic';
                            if (isLog) {
                                // Calculate the display digit width from the current Y-axis min/max values
                                const yMin = chart.scales.y.min || 10_000_000;
                                const yMax = chart.scales.y.max || 1_000_000_000;
                                const minOrder = Math.floor(Math.log10(yMin / 100000000));
                                const maxOrder = Math.floor(Math.log10(yMax / 100000000));
                                const orderRange = Math.max(1, maxOrder - minOrder + 1);

                                const exponent = Math.floor(Math.log10(value));
                                const mantissa = value / Math.pow(10, exponent);

                                // If there are 4 or more types of digit widths, strengthen thinning to show only powers of 10 (mantissa=1)
                                if (orderRange >= 4) {
                                    if (Math.abs(mantissa - 1) > 0.05) return null;
                                } else {
                                    // Change to 1, 2, 4, 6 to resolve overlapping
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

    // Apply initial downside focus
    const dfToggleAsset = document.getElementById('downsideFocusAsset');
    if (dfToggleAsset && dfToggleAsset.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// Cash buffer trend chart rendering
// ====================================================================
export function renderCashChart(result) {
    const { percentiles, cashPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const ctx = document.getElementById('cashChartCanvas').getContext('2d');

    const currentChart = getCashChart();
    if (currentChart) { currentChart.destroy(); setCashChart(null); }

    // Create datasets in descending order (highest percentile first)
    // Color is determined by ascending index (origIdx) and total count
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

    // Apply initial downside focus
    const dfToggleCash = document.getElementById('downsideFocusCash');
    if (dfToggleCash && dfToggleCash.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// Maximum drawdown CDF chart rendering
// ====================================================================
export function renderDdCdfChart(result) {
    const { maxDdPerPath, params } = result;
    const simPaths = params.simPaths;

    // Convert max drawdown (negative value) to percentage, apply limits and rounding, then sort in ascending order
    const sortedDd = Float32Array.from(maxDdPerPath)
        .map(v => {
            let pct = v * 100;
            if (pct < -100) pct = -100;
            if (pct > 0) pct = 0;
            return Math.round(pct * 10) / 10;
        })
        .sort();

    // Generate points with buildCdfPoints
    const rawPoints = buildCdfPoints(sortedDd, simPaths, 'cdf');
    // The x-axis has negative values, so re-sort in ascending order of X (to move the { x: 0, y: 100 } point added at the beginning to the end)
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
// Longest underwater period CCDF chart rendering
// ====================================================================
export function renderUwCdfChart(result) {
    const { maxUwPerPath, params } = result;

    // Sort the array of longest stagnation periods (positive values) in ascending order
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
                        stepSize: 60, // Unified at 5-year (60-month) intervals
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
// v2.3.0: Below-initial-assets continuous period CCDF chart rendering
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
// v2.3.0: Consecutive risk asset sell period CCDF chart rendering
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
// Toggle between logarithmic/linear scale (no recalculation, chart redraw only)
// ====================================================================
export function onScaleToggle() {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult) return;
    const isLogScale = document.getElementById('logScaleToggle').checked;
    renderAssetChart(lastSimResult, isLogScale);
}
