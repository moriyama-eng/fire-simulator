// js/analysis-state.js
// 分析タブ v2.0.0 状態管理

// ----- 因子定義 -----
// paramKey は baseEffectiveParams（app.js で生成）内のプロパティ名と厳密に一致させること。
// また、applyFactorChange (analysis-runner.js) で因子の変更を適用するプロパティ名でもある。
export const FACTORS = [
    { key: 'initial_risk_asset_jpy', labelKey: 'analysis.factors.initial_risk_asset_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.oku', step: 0.1, decimals: 1, scale: 1e8, paramKey: 'initialRiskAsset' },
    { key: 'initial_cash_buffer_jpy', labelKey: 'analysis.factors.initial_cash_buffer_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.man', step: 500, decimals: 0, scale: 1e4, paramKey: 'initialCashBuffer' },
    { key: 'monthly_expense_jpy', labelKey: 'analysis.factors.monthly_expense_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.man', step: 5, decimals: 0, scale: 1e4, paramKey: 'monthlyExpense' },
    { key: 'expected_return_pct', labelKey: 'analysis.factors.expected_return_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 1.0, decimals: 1, scale: 1, paramKey: 'expectedReturn' },
    { key: 'volatility_pct', labelKey: 'analysis.factors.volatility_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 1.0, decimals: 1, scale: 1, paramKey: 'volatility' },
    { key: 'inflation_rate_pct', labelKey: 'analysis.factors.inflation_rate_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 0.5, decimals: 1, scale: 1, paramKey: 'inflationRate' },
    { key: 'drawdown_trigger_pct', labelKey: 'analysis.factors.drawdown_trigger_pct', categoryKey: 'analysis.category.buffer', catClass: 'cat-buffer', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'drawdownTrigger', requiresFeature: 'cashBuffer' },
    { key: 'replenish_pace_x_expense', labelKey: 'analysis.factors.replenish_pace_x_expense', categoryKey: 'analysis.category.buffer', catClass: 'cat-buffer', unitKey: 'unit.multiplier', step: 0.5, decimals: 1, scale: 1, paramKey: 'replenishPace', requiresFeature: 'cashBuffer' },
    { key: 'guardrail_trigger_pct', labelKey: 'analysis.factors.guardrail_trigger_pct', categoryKey: 'analysis.category.guardrail', catClass: 'cat-guardrail', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailTrigger', requiresFeature: 'guardrail' },
    { key: 'guardrail_reduction_pct', labelKey: 'analysis.factors.guardrail_reduction_pct', categoryKey: 'analysis.category.guardrail', catClass: 'cat-guardrail', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailReduction', requiresFeature: 'guardrail' },
];

// ----- 分析タブ状態管理 -----
const state = {
    baseContext: null,
    baseEffectiveParams: null,
    selectedFactors: [],
    analysisResult: null,
    isRunning: false,
    errorMessage: null,
};

export function getState() { return state; }
export function getBaseEffectiveParams() { return state.baseEffectiveParams; }
export function getSelectedFactors() { return [...state.selectedFactors]; }
export function getAnalysisResult() { return state.analysisResult; }
export function getErrorMessage() { return state.errorMessage; }

/**
 * Base条件に応じて現在利用可能な因子を返す
 * CB OFF 時は現金バッファ因子、GR OFF 時はガードレール因子が除外される
 */
export function getAvailableFactors() {
    const bp = state.baseEffectiveParams;
    if (!bp) return [];
    return FACTORS.filter(f => {
        if (f.requiresFeature === 'cashBuffer' && !bp.cashBufferToggle) return false;
        if (f.requiresFeature === 'guardrail' && !bp.guardrailToggle) return false;
        return true;
    });
}

// ----- 状態更新 -----
export function setBaseContext(baseContext, baseEffectiveParams) {
    // ベース条件が前回と同じなら分析結果を消さない
    const isSameBase = state.baseEffectiveParams && JSON.stringify(state.baseEffectiveParams) === JSON.stringify(baseEffectiveParams);

    state.baseContext = baseContext;
    state.baseEffectiveParams = baseEffectiveParams;

    if (isSameBase) return; // 変化がなければ何もしない

    const availableKeys = getAvailableFactors().map(f => f.key);
    state.selectedFactors = state.selectedFactors.filter(key => availableKeys.includes(key));
    state.analysisResult = null;
    state.errorMessage = null;
}

export function setSelectedFactors(factorKeys) {
    state.selectedFactors = [...factorKeys];
    state.analysisResult = null;
}

export function setRunning(isRunning) {
    state.isRunning = isRunning;
    if (!isRunning) state.errorMessage = null;
}

export function setAnalysisResult(result) {
    state.analysisResult = result;
    state.isRunning = false;
    state.errorMessage = null;
}

export function setErrorMessage(msg) {
    state.errorMessage = msg;
    state.isRunning = false;
}

// ----- 因子の値計算 -----
/**
 * 因子の現在のベース値をUI表示単位で返す
 * 内部パラメータの生の値からスケールダウンする
 */
export function getFactorBaseValue(factorKey) {
    const bp = state.baseEffectiveParams;
    if (!bp) return null;
    const factor = FACTORS.find(f => f.key === factorKey);
    if (!factor) return null;
    const raw = bp[factor.paramKey];
    if (raw == null) return null;
    let value = raw / (factor.scale || 1);

    return value;
}

/**
 * 5水準の値をUI表示単位で返す
 */
export function getGeneratedValues(factorKey) {
    const base = getFactorBaseValue(factorKey);
    if (base === null) return null;
    const factor = FACTORS.find(f => f.key === factorKey);
    const step = factor.step;
    return [-2, -1, 0, 1, 2].map(s => base + s * step);
}

export function getScenarioCount() {
    return 1 + state.selectedFactors.length * 4;
}

export function _resetStateForTest() {
    state.baseContext = null;
    state.baseEffectiveParams = null;
    state.selectedFactors = [];
    state.analysisResult = null;
    state.isRunning = false;
    state.errorMessage = null;
}

/**
 * テスト専用: 因子を強制設定する
 */
export function _setAvailableFactorsForTest(factors) {
    // 内部的に状態を汚染させる hack
    // 実際には getAvailableFactors が state.baseEffectiveParams に依存しているため
    // テスト用に関数を増やすより、setBaseContext を適切に呼ぶべき。
    // 今回はテストコード側を修正する
}


/**
 * ベース成功率(pct)に応じた目標成功率の改善幅を返す
 * - 95以上 → 0
 * - 90以上95未満 → 1.0
 * - 85以上90未満 → 2.0
 * - 85未満 → 5.0
 * @param {number} baseRatePct - 現在の成功率(%)
 * @returns {number} 改善幅(%pt)
 */
export function getSuccessRateTargetDelta(baseRatePct) {
    if (baseRatePct >= 95) return 0;
    if (baseRatePct >= 90) return 1.0;
    if (baseRatePct >= 85) return 2.0;
    return 5.0;
}