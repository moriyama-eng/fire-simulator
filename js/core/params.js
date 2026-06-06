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
    targetAssetRatio: 1.0
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

    // 英語モードの場合、入力値はドル単位（K単位を除外した数値）なので、
    // 元の円単位（入力値 * 100,000）に換算するためにここで10倍に調整する
    // これにより、戻り値の * 10_000 と合わさって正確に 100_000 倍（$1 = 100円換算）になる
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
        simPaths: Math.max(1000, Math.min(50000, Math.round(raw('simPathsNum')))),
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
        // targetAssetRatio: 初期総資産に対する割合（%）、デフォルト100%。通貨ではないため為替変換は行わない（固定レート100円=1ドルに影響しない）
        targetAssetRatio: parseFloat(raw('targetAssetRatioNum')) || DEFAULTS.targetAssetRatio
    };
}