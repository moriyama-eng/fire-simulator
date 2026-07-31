// ====================================================================
// js/core/params.js
// ====================================================================

export const DEFAULTS = Object.freeze({
    initialRiskAsset: 1.0,
    initialCashBuffer: 1000,
    monthlyExpense: 30,
    expectedReturn: 10.0,
    volatility: 18.0,
    inflationRate: 2.0,
    simYears: 30,
    simPaths: 10000,
    drawdownTrigger: -20.0,
    drawdownReplenish: -5.0,
    replenishPace: 5.0,
    guardrailTrigger: -20.0,
    guardrailReduction: -20.0,
    guardrailRelease: -15.0,
    infVol: 2.0,
    infAr: 0.5,
    simDfNum: 4.0,
    seedNum: 123456,
    targetAssetRatio: 100.0
});

export function safeNumber(val, fallback) {
    if (typeof val === 'string') val = val.replace(/,/g, '');
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

export function calcAutoDf(volatility) {
    if (volatility <= 0) return 30.0;
    let df = 5.0 - 0.1 * (volatility - 10.0);
    if (volatility < 10) df = 5.0;
    if (volatility > 30) df = 3.0;
    return Math.max(2.5, Math.min(30.0, df));
}

export function getParamsFromInputs(inputs) {
    const raw = (key) => safeNumber(inputs[key] ?? DEFAULTS[key], DEFAULTS[key]);
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'ja';
    const isEn = lang === 'en';

    let cashBufferVal = raw('initialCashBufferNum');
    let monthlyExpenseVal = raw('monthlyExpenseNum');

    // In English mode, input values are in dollar units (excluding K unit values),
    // so adjust by multiplying by 10 here to convert to the original yen unit (input value * 100,000).
    // This, combined with the subsequent * 10_000, results in an accurate * 100,000 multiplication ($1 = 100 yen conversion).
    if (isEn) {
        cashBufferVal = cashBufferVal * 10;
        monthlyExpenseVal = monthlyExpenseVal * 10;
    }

    return {
        initialRiskAsset: raw('initialRiskAssetNum') * 100_000_000,
        initialCashBuffer: cashBufferVal * 10_000,
        monthlyExpense: monthlyExpenseVal * 10_000,
        expectedReturn: raw('expectedReturnNum'),
        volatility: raw('volatilityNum'),
        inflationRate: raw('inflationRateNum'),
        simYears: raw('simYearsNum'),
        simPaths: Math.max(5000, Math.min(50000, Math.round(raw('simPathsNum')))),
        cashBufferToggle: inputs.cashBufferToggle,
        drawdownTrigger: Math.min(0, raw('drawdownTriggerNum')),
        drawdownReplenish: Math.min(0, raw('drawdownReplenishNum')),
        replenishPace: Math.max(0, raw('replenishPaceNum')),
        guardrailToggle: inputs.guardrailToggle,
        guardrailTrigger: Math.min(0, raw('guardrailTriggerNum')),
        guardrailReduction: Math.min(0, raw('guardrailReductionNum')),
        guardrailRelease: Math.min(0, raw('guardrailReleaseNum')),
        useArInflation: inputs.inflationModelToggle,
        infVol: raw('infVolNum'),
        infAr: raw('infArNum'),
        useTDistribution: inputs.returnModelSelect === 'log-t',
        simDfManual: !inputs.simDfToggle,
        simDfNum: Math.max(2.5, raw('simDfNum')),
        useFixedSeed: !inputs.seedToggle,
        seedNum: raw('seedNum'),
        // targetAssetRatio: Ratio relative to initial total assets (%), default 100%. Not a currency, so no exchange rate conversion is applied (not affected by the fixed rate of 100 yen = $1).
        targetAssetRatio: parseFloat(raw('targetAssetRatioNum')) || DEFAULTS.targetAssetRatio
    };
}

// ---- Unit-independent clamp helpers (shared by normalizeHeadlessParams) ----
// Source of truth: getParamsFromInputs (UI path) and comparison-runner.
// NOTE: getParamsFromInputs rounds simPaths (Math.round), but comparison-runner /
// analysis-runner do NOT round. clampSimPaths intentionally includes Math.round to
// match the UI path, because normalizeHeadlessParams currently mirrors getParamsFromInputs.
// If this helper is ever reused for comparison/analysis paths, review the rounding difference.

// simPaths: clamp to [5000, 50000] with rounding (matches getParamsFromInputs)
export function clampSimPaths(v) {
    return Math.max(5000, Math.min(50000, Math.round(Number(v))));
}

// Non-positive clamp: values must be <= 0 (drawdown*/guardrail* triggers)
export function clampNonPositive(v) {
    return Math.min(0, Number(v));
}

// Non-negative clamp: values must be >= min (default 0) (replenishPace, infVol)
export function clampNonNegative(v, min = 0) {
    return Math.max(min, Number(v));
}

// Range clamp: composition order is Math.min(hi, Math.max(lo, x)) — do NOT reorder
// (matches infAr [0,1.0] and targetAssetRatio [0,500])
export function clampRange(v, lo, hi) {
    return Math.min(hi, Math.max(lo, Number(v)));
}

// simDfNum: minimum 2.5 (matches getParamsFromInputs)
export function clampMinDf(v) {
    return Math.max(2.5, Number(v));
}

// Guardrail cross-validation (PURE function — no DOM side effects).
// Source: actions.js runMain UI path, but the DOM write-back (releaseInput.value=...)
// is intentionally excluded; this returns only the resolved release value.
export function resolveGuardrailRelease(toggle, trigger, release) {
    return (toggle && release < trigger) ? trigger : release;
}