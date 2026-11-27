// ====================================================================
// src/core/params.ts
// ====================================================================

import type { DefaultsConfig, RawInputs, SimulationParams } from '../types/params.js';

function getLanguage(): string {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { __getLanguage?: () => string }).__getLanguage === 'function') {
        return (globalThis as unknown as { __getLanguage: () => string }).__getLanguage();
    }
    return (typeof globalThis !== 'undefined' && globalThis.__currentLang) ? globalThis.__currentLang : 'ja';
}

export const DEFAULTS: DefaultsConfig = Object.freeze({
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

export type NumericInputKey =
    | 'initialRiskAssetNum'
    | 'initialCashBufferNum'
    | 'monthlyExpenseNum'
    | 'expectedReturnNum'
    | 'volatilityNum'
    | 'inflationRateNum'
    | 'simYearsNum'
    | 'simPathsNum'
    | 'drawdownTriggerNum'
    | 'drawdownReplenishNum'
    | 'replenishPaceNum'
    | 'guardrailTriggerNum'
    | 'guardrailReductionNum'
    | 'guardrailReleaseNum'
    | 'infVolNum'
    | 'infArNum'
    | 'simDfNum'
    | 'seedNum'
    | 'targetAssetRatioNum';

export const INPUT_TO_DEFAULT_KEY: Record<NumericInputKey, keyof DefaultsConfig> = Object.freeze({
    initialRiskAssetNum: 'initialRiskAsset',
    initialCashBufferNum: 'initialCashBuffer',
    monthlyExpenseNum: 'monthlyExpense',
    expectedReturnNum: 'expectedReturn',
    volatilityNum: 'volatility',
    inflationRateNum: 'inflationRate',
    simYearsNum: 'simYears',
    simPathsNum: 'simPaths',
    drawdownTriggerNum: 'drawdownTrigger',
    drawdownReplenishNum: 'drawdownReplenish',
    replenishPaceNum: 'replenishPace',
    guardrailTriggerNum: 'guardrailTrigger',
    guardrailReductionNum: 'guardrailReduction',
    guardrailReleaseNum: 'guardrailRelease',
    infVolNum: 'infVol',
    infArNum: 'infAr',
    simDfNum: 'simDfNum',
    seedNum: 'seedNum',
    targetAssetRatioNum: 'targetAssetRatio'
});

export function getDefaultValue(key: NumericInputKey): number {
    return DEFAULTS[INPUT_TO_DEFAULT_KEY[key]];
}

export function safeNumber(val: unknown, fallback: number): number {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        if (cleaned === '') return fallback;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : fallback;
    }
    if (typeof val === 'number') {
        return Number.isFinite(val) ? val : fallback;
    }
    return fallback;
}

export function calcAutoDf(volatility: number): number {
    if (volatility <= 0) return 30.0;
    let df = 5.0 - 0.1 * (volatility - 10.0);
    if (volatility < 10) df = 5.0;
    if (volatility > 30) df = 3.0;
    return Math.max(2.5, Math.min(30.0, df));
}

export function getParamsFromInputs(inputs: RawInputs): SimulationParams {
    const raw = (key: NumericInputKey): number => {
        const fallback = getDefaultValue(key);
        const inputVal = inputs[key];
        return safeNumber(inputVal, fallback);
    };

    const lang = getLanguage();
    const isEn = lang === 'en';

    let cashBufferVal = raw('initialCashBufferNum');
    let monthlyExpenseVal = raw('monthlyExpenseNum');

    // In English mode, input values are in K-dollar units ($1K = 100,000 JPY display convention),
    // so multiply by 10 here before the subsequent * 10_000 (giving an exact * 100,000 conversion).
    if (isEn) {
        cashBufferVal = cashBufferVal * 10;
        monthlyExpenseVal = monthlyExpenseVal * 10;
    }

    const targetRaw = inputs['targetAssetRatioNum'] !== undefined
        ? safeNumber(inputs['targetAssetRatioNum'], getDefaultValue('targetAssetRatioNum'))
        : NaN;
    const guardrailToggle = Boolean(inputs.guardrailToggle);
    const guardrailTrigger = clampNonPositive(raw('guardrailTriggerNum'));
    const rawSeed = raw('seedNum');

    return {
        initialRiskAsset: Math.max(0, raw('initialRiskAssetNum') * 100_000_000),
        initialCashBuffer: Math.max(0, cashBufferVal * 10_000),
        monthlyExpense: Math.max(0, monthlyExpenseVal * 10_000),
        expectedReturn: Math.max(-99.99, raw('expectedReturnNum')),
        volatility: raw('volatilityNum'),
        inflationRate: Math.max(-99.99, raw('inflationRateNum')),
        simYears: Math.max(1, Math.round(raw('simYearsNum'))),
        simPaths: clampSimPaths(raw('simPathsNum')),
        cashBufferToggle: Boolean(inputs.cashBufferToggle),
        drawdownTrigger: clampNonPositive(raw('drawdownTriggerNum')),
        drawdownReplenish: clampNonPositive(raw('drawdownReplenishNum')),
        replenishPace: clampNonNegative(raw('replenishPaceNum')),
        guardrailToggle,
        guardrailTrigger,
        guardrailReduction: clampRange(raw('guardrailReductionNum'), -100, 0),
        guardrailRelease: resolveGuardrailRelease(
            guardrailToggle,
            guardrailTrigger,
            clampNonPositive(raw('guardrailReleaseNum'))
        ),
        useArInflation: Boolean(inputs.inflationModelToggle),
        infVol: clampNonNegative(raw('infVolNum')),
        infAr: clampRange(raw('infArNum'), 0, 1.0),
        useTDistribution: inputs.returnModelSelect === 'log-t',
        simDfManual: !inputs.simDfToggle,
        simDfNum: clampMinDf(raw('simDfNum')),
        useFixedSeed: !inputs.seedToggle,
        seedNum: Math.min(99999999, Math.max(1, Math.floor(rawSeed === 0 ? DEFAULTS.seedNum : rawSeed))),
        // targetAssetRatio: Ratio relative to initial total assets (%), default 100%. Not a currency, so no exchange rate conversion is applied (not affected by the fixed rate of 100 yen = $1).
        targetAssetRatio: clampRange(Number.isFinite(targetRaw) ? targetRaw : DEFAULTS.targetAssetRatio, 0, 500)
    };
}

// ---- Unit-independent clamp helpers (shared by normalizeHeadlessParams) ----
// Source of truth: getParamsFromInputs (UI path) and comparison-runner.
// NOTE: getParamsFromInputs rounds simPaths (Math.round), but comparison-runner /
// analysis-runner do NOT round. clampSimPaths intentionally includes Math.round to
// match the UI path, because normalizeHeadlessParams currently mirrors getParamsFromInputs.
// If this helper is ever reused for comparison/analysis paths, review the rounding difference.

// simPaths: clamp to [5000, 50000] with rounding (matches getParamsFromInputs)
export function clampSimPaths(v: unknown): number {
    return Math.max(5000, Math.min(50000, Math.round(Number(v))));
}

// Non-positive clamp: values must be <= 0 (drawdown*/guardrail* triggers)
export function clampNonPositive(v: unknown): number {
    return Math.min(0, Number(v));
}

// Non-negative clamp: values must be >= min (default 0) (replenishPace, infVol)
export function clampNonNegative(v: unknown, min: number = 0): number {
    return Math.max(min, Number(v));
}

// Range clamp: composition order is Math.min(hi, Math.max(lo, x)) -- do NOT reorder
// (matches infAr [0,1.0] and targetAssetRatio [0,500])
export function clampRange(v: unknown, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, Number(v)));
}

// simDfNum: minimum 2.5 (matches getParamsFromInputs)
export function clampMinDf(v: unknown): number {
    return Math.max(2.5, Number(v));
}

// Guardrail cross-validation (PURE function -- no DOM side effects).
// Source: app/actions.ts runMain UI path, but the DOM write-back (releaseInput.value=...)
// is intentionally excluded; this returns only the resolved release value.
export function resolveGuardrailRelease(toggle: boolean, trigger: number, release: number): number {
    return (toggle && release < trigger) ? trigger : release;
}
