// ====================================================================
// src/app/charts.ts
// Collection of chart rendering functions (Chart.js wrappers)
// Dependencies: i18n.ts and app/state.ts only (to prevent circular imports)
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
import type { ChartInstance, ChartDataset } from '../types/global.js';
import type { AggregatedMetrics } from '../types/simulation.js';

// ====================================================================
// Percentile color gradient (determined by count and ascending index)
// Gradient from red -> orange -> yellow -> yellow-green -> green
// ====================================================================
const GRADIENT_COLORS_BY_COUNT: Record<number, string[]> = {
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
function getPercentileColorByIndex(index: number, total: number): string {
    const palette = GRADIENT_COLORS_BY_COUNT[Math.min(total, 5)] || GRADIENT_COLORS_BY_COUNT[5];
    return palette[Math.min(index, palette.length - 1)];
}

// Generate X-axis labels (index only, year is displayed via tick callback)
function generateLabels(dataLen: number): number[] {
    const labels: number[] = [];
    for (let i = 0; i < dataLen; i++) labels.push(i);
    return labels;
}

interface TickContext {
    chart: {
        data: {
            labels?: unknown[];
        };
    };
}

// X-axis tick callback: display labels at appropriate year intervals
function xTickCallback(this: unknown, _value: unknown, index: number): string | null {
    const ctx = this as TickContext;
    const labels = ctx.chart.data.labels;
    const totalMonths = (labels ? labels.length : 1) - 1;
    const totalYears = totalMonths / 12;
    let interval: number;
    if (totalYears <= 15) interval = 2;
    else if (totalYears <= 40) interval = 5;
    else interval = 10;
    if (index % (interval * 12) === 0) return formatYears(Math.round(index / 12));
    return null;
}

interface TooltipItem {
    dataIndex: number;
}

// Tooltip title (always show elapsed years)
function tooltipTitleCallback(tooltipItems: TooltipItem[]): string {
    const item = tooltipItems[0];
    if (!item) return '';
    const index = item.dataIndex;
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
interface TooltipPositionItem {
    element: {
        x: number;
        y: number;
    };
}

interface ChartAreaContext {
    chart: {
        chartArea: {
            top: number;
        };
    };
}

const customTooltipPosition = function (
    this: unknown,
    items: TooltipPositionItem[]
): { x: number; y: number; xAlign?: string; yAlign?: string } {
    const ctx = this as ChartAreaContext;
    const chart = ctx.chart;
    const top = chart?.chartArea?.top ?? 0;
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
if (typeof Chart !== 'undefined' && Chart?.Tooltip?.positioners) {
    Chart.Tooltip.positioners.customTooltipPosition = customTooltipPosition;
}

// ====================================================================
// Apply downside focus
// ====================================================================
export function applyDownsideFocus(chart: ChartInstance | null | undefined, enabled: boolean): void {
    // Guard against being called when the chart instance is in an incomplete state (e.g., during language switching)
    if (!chart || !chart.data || !chart.data.datasets) return;
    // First, determine the visibility of all datasets
    chart.data.datasets.forEach((ds, i) => {
        const pct = parseInt(ds.label || '0', 10);
        const visible = !enabled || pct <= 50;
        chart.setDatasetVisibility?.(i, visible);
    });

    // Fan chart fill correction:
    let firstVisible = true;
    chart.data.datasets.forEach((ds) => {
        const pct = parseInt(ds.label || '0', 10);
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
export function buildCdfPoints(
    sortedData: ArrayLike<number>,
    simPaths: number,
    mode: 'cdf' | 'ccdf' = 'ccdf'
): Array<{ x: number; y: number }> {
    const pointsMap = new Map<number, number>();
    for (let i = 0; i < sortedData.length; i++) {
        const x = sortedData[i];
        let y: number;
        if (mode === 'cdf') {
            // CDF: P(X <= x) -> last-wins (last occurrence) calculation
            y = ((i + 1) / simPaths) * 100;
        } else {
            // CCDF: P(X >= x) -> first-wins (first occurrence) calculation
            if (pointsMap.has(x)) continue;
            y = ((simPaths - i) / simPaths) * 100;
        }
        pointsMap.set(x, y);
    }
    // Add a point at x=0 on the horizontal axis (required for all charts)
    pointsMap.set(0, 100);
    return Array.from(pointsMap.entries())
        .map(([x, y]) => ({ x, y }))
        .sort((a, b) => a.x - b.x);
}

/**
 * Format asset tooltip label for Chart.js tooltips.
 * Pure function independent of Chart.js / DOM. Works with arguments only.
 */
export function formatAssetTooltipLabel({
    label,
    value,
    allValues,
    isJa
}: {
    label: string;
    value: number | null | undefined;
    allValues: (number | null | undefined)[];
    isJa: boolean;
}): string {
    if (value === null || value === undefined) {
        return `${label}: —`; // U+2014 em dash, shared across JA/EN
    }
    if (isJa) {
        const oku = (value / 100000000).toFixed(2);
        const maxLen = Math.max(...allValues.map(v =>
            (v !== null && v !== undefined) ? (v / 100000000).toFixed(2).length : 1));
        return `${label}:${oku.padStart(maxLen + 1)} 億円`;
    }
    return `${label}: ${formatCurrency(value, '億円')}`;
}

// ====================================================================
// Asset trend chart rendering
// ====================================================================
export function renderAssetChart(result: AggregatedMetrics, isLogScale?: boolean): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

    const { percentiles, totalPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const canvas = document.getElementById('assetChartCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getAssetChart();
    if (currentChart) { currentChart.destroy(); setAssetChart(null); }

    // Create datasets in descending order (highest percentile first)
    // Color is determined by ascending index (origIdx) and total count
    const orderedPercentiles = [...percentiles].reverse();
    const total = percentiles.length;
    const datasets: ChartDataset[] = orderedPercentiles.map((pct, idx) => {
        const origIdx = percentiles.indexOf(pct); // Position in ascending order
        const color = getPercentileColorByIndex(origIdx, total);
        let data: unknown[];
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

    const newChart = new ChartClass(ctx, {
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
                    itemSort: function (a: unknown, b: unknown) {
                        const itemA = a as { parsed: { y?: number } };
                        const itemB = b as { parsed: { y?: number } };
                        return (itemB.parsed.y || 0) - (itemA.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context: unknown) {
                            const ctxObj = context as {
                                chart: {
                                    tooltip: {
                                        dataPoints: Array<{
                                            dataset: { label: string };
                                            parsed: { y: number | null | undefined };
                                        }>;
                                    };
                                };
                                dataset: { label: string };
                                parsed: { y: number | null | undefined };
                            };
                            const allItems = ctxObj.chart.tooltip.dataPoints;
                            // Calculate the maximum number of characters in the label part (align digits for 1-digit vs 2-digit percentiles)
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = ctxObj.dataset.label.padStart(maxLblLen);
                            const allValues = allItems.map(item => item.parsed.y);
                            const lang = getLanguage() || '';
                            const isJa = lang.startsWith('ja');
                            return formatAssetTooltipLabel({
                                label: lbl,
                                value: ctxObj.parsed.y,
                                allValues,
                                isJa,
                            });
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
                        callback: function (this: unknown, value: unknown) {
                            const numVal = Number(value);
                            // Logarithmic scale: dynamic thinning algorithm based on display digit width (order) of the Y-axis
                            const tickCtx = this as {
                                chart: {
                                    options: { scales: { y: { type: string } } };
                                    scales: { y: { min?: number; max?: number } };
                                };
                            };
                            const chart = tickCtx.chart;
                            const isLog = chart.options.scales.y.type === 'logarithmic';
                            if (isLog) {
                                // Calculate the display digit width from the current Y-axis min/max values
                                const yMin = chart.scales.y.min || 10_000_000;
                                const yMax = chart.scales.y.max || 1_000_000_000;
                                const minOrder = Math.floor(Math.log10(yMin / 100000000));
                                const maxOrder = Math.floor(Math.log10(yMax / 100000000));
                                const orderRange = Math.max(1, maxOrder - minOrder + 1);

                                const exponent = Math.floor(Math.log10(numVal));
                                const mantissa = numVal / Math.pow(10, exponent);

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
                            return formatCurrency(numVal, numVal >= 1e8 ? '億円' : '万円');
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
    const dfToggleAsset = document.getElementById('downsideFocusAsset') as HTMLInputElement | null;
    if (dfToggleAsset && dfToggleAsset.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// Cash buffer trend chart rendering
// ====================================================================
export function renderCashChart(result: AggregatedMetrics): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

    const { percentiles, cashPercentileData, dataLen } = result;
    const labels = generateLabels(dataLen);
    const canvas = document.getElementById('cashChartCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getCashChart();
    if (currentChart) { currentChart.destroy(); setCashChart(null); }

    // Create datasets in descending order (highest percentile first)
    // Color is determined by ascending index (origIdx) and total count
    const orderedPercentiles = [...percentiles].reverse();
    const total = percentiles.length;
    const datasets: ChartDataset[] = orderedPercentiles.map((pct, idx) => {
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

    const newChart = new ChartClass(ctx, {
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
                    itemSort: function (a: unknown, b: unknown) {
                        const itemA = a as { parsed: { y?: number } };
                        const itemB = b as { parsed: { y?: number } };
                        return (itemB.parsed.y || 0) - (itemA.parsed.y || 0);
                    },
                    callbacks: {
                        title: tooltipTitleCallback,
                        label: function (context: unknown) {
                            const ctxObj = context as {
                                chart: {
                                    tooltip: {
                                        dataPoints: Array<{
                                            dataset: { label: string };
                                        }>;
                                    };
                                };
                                dataset: { label: string };
                                parsed: { y: number };
                            };
                            const val = ctxObj.parsed.y;
                            const allItems = ctxObj.chart.tooltip.dataPoints;
                            const maxLblLen = Math.max(...allItems.map(item => item.dataset.label.length));
                            const lbl = ctxObj.dataset.label.padStart(maxLblLen);
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
                        callback: function (value: unknown) {
                            const numVal = Number(value);
                            return formatCurrency(numVal, numVal >= 1e8 ? '億円' : '万円');
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
    const dfToggleCash = document.getElementById('downsideFocusCash') as HTMLInputElement | null;
    if (dfToggleCash && dfToggleCash.checked) {
        applyDownsideFocus(newChart, true);
    }
}

// ====================================================================
// Maximum drawdown CDF chart rendering
// ====================================================================
export function renderDdCdfChart(result: AggregatedMetrics): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

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

    const canvas = document.getElementById('ddHistCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getDdHistChart();
    if (currentChart) { currentChart.destroy(); }

    setDdHistChart(new ChartClass(ctx, {
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
                        label: function (context: unknown) {
                            const ctxObj = context as { parsed: { x: number; y: number } };
                            if (ctxObj.parsed.x === -100) {
                                return [
                                    t('chart.tooltip.deadLabel'),
                                    t('chart.tooltip.probabilityLabel', [ctxObj.parsed.y.toFixed(1)])
                                ];
                            }
                            return [
                                t('chart.tooltip.ddWorseLabel', [ctxObj.parsed.x.toFixed(1)]),
                                t('chart.tooltip.probabilityLabel', [ctxObj.parsed.y.toFixed(1)])
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
                        callback: function (value: unknown) { return value + "%"; }
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
                        callback: function (value: unknown) { return value + "%"; }
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
export function renderUwCdfChart(result: AggregatedMetrics): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

    const { maxUwPerPath, params } = result;

    // Sort the array of longest stagnation periods (positive values) in ascending order
    const sortedUw = Float32Array.from(maxUwPerPath).sort();
    const simPaths = params.simPaths;

    const points = buildCdfPoints(sortedUw, simPaths);

    const canvas = document.getElementById('uwHistCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getUwHistChart();
    if (currentChart) { currentChart.destroy(); }

    setUwHistChart(new ChartClass(ctx, {
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
                        label: function (context: unknown) {
                            const ctxObj = context as { parsed: { x: number; y: number } };
                            const totalMo = Math.round(ctxObj.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.uwLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [ctxObj.parsed.y.toFixed(1)])
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
                        callback: function (value: unknown) {
                            return formatYears(Number(value) / 12);
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
                        callback: function (value: unknown) { return value + "%"; }
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
export function renderBelowInitCdfChart(result: AggregatedMetrics): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

    const { belowInitPeriods, params } = result;
    const sorted = Float32Array.from(belowInitPeriods).sort();
    const points = buildCdfPoints(sorted, params.simPaths);
    const canvas = document.getElementById('belowInitChartCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getBelowInitChart();
    if (currentChart) { currentChart.destroy(); }
    setBelowInitChart(new ChartClass(ctx, {
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
                        label: function (context: unknown) {
                            const ctxObj = context as { parsed: { x: number; y: number } };
                            const totalMo = Math.round(ctxObj.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.belowInitLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [ctxObj.parsed.y.toFixed(1)])
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
                        stepSize: 60, // 5 years (60 months) intervals
                        callback: function (value: unknown) {
                            return formatYears(Number(value) / 12);
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
                        callback: function (value: unknown) { return value + "%"; }
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
export function renderConsecutiveSellCdfChart(result: AggregatedMetrics): void {
    const ChartClass = typeof Chart !== 'undefined' ? Chart : undefined;
    if (!ChartClass) return;

    const { consecutiveSellPeriods, params } = result;
    const sorted = Float32Array.from(consecutiveSellPeriods).sort();
    const points = buildCdfPoints(sorted, params.simPaths);
    const canvas = document.getElementById('sellChartCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentChart = getSellChart();
    if (currentChart) { currentChart.destroy(); }
    setSellChart(new ChartClass(ctx, {
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
                        label: function (context: unknown) {
                            const ctxObj = context as { parsed: { x: number; y: number } };
                            const totalMo = Math.round(ctxObj.parsed.x);
                            const y = Math.floor(totalMo / 12);
                            const m = totalMo % 12;
                            const periodStr = t('chart.tooltip.uwPeriod', [y, m]);
                            return [
                                t('chart.tooltip.sellLongerLabel', [periodStr]),
                                t('chart.tooltip.probabilityLabel', [ctxObj.parsed.y.toFixed(1)])
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
                        stepSize: 60, // 5 years (60 months) intervals
                        callback: function (value: unknown) {
                            return formatYears(Number(value) / 12);
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
                        callback: function (value: unknown) { return value + "%"; }
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
export function onScaleToggle(): void {
    const lastSimResult = getLastSimResult();
    if (!lastSimResult) return;
    const toggle = document.getElementById('logScaleToggle') as HTMLInputElement | null;
    const isLogScale = toggle ? toggle.checked : false;
    renderAssetChart(lastSimResult, isLogScale);
}
