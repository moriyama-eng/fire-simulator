// js/analysis-state.js
// 分析タブ v2.0.0 状態管理

// ----- 因子定義 -----
// paramKey は baseEffectiveParams（app.js で生成）内のプロパティ名と厳密に一致させること。
// また、applyFactorChange (analysis-runner.js) で因子の変更を適用するプロパティ名でもある。
export const FACTORS = [
    { key: 'initial_risk_asset_jpy', label: '初期リスク資産', category: '資産', catClass: 'cat-asset', unit: '億円', step: 0.1, decimals: 1, scale: 1e8, paramKey: 'initialRiskAsset' },
    { key: 'initial_cash_buffer_jpy', label: '初期現金バッファ', category: '資産', catClass: 'cat-asset', unit: '万円', step: 500, decimals: 0, scale: 1e4, paramKey: 'initialCashBuffer' },
    { key: 'monthly_expense_jpy', label: '初期月間取崩し額', category: '資産', catClass: 'cat-asset', unit: '万円', step: 5, decimals: 0, scale: 1e4, paramKey: 'monthlyExpense' },
    { key: 'expected_return_pct', label: '期待リターン', category: 'マーケット', catClass: 'cat-market', unit: '%', step: 1.0, decimals: 1, scale: 1, paramKey: 'expectedReturn' },
    { key: 'volatility_pct', label: 'ボラティリティ', category: 'マーケット', catClass: 'cat-market', unit: '%', step: 1.0, decimals: 1, scale: 1, paramKey: 'volatility' },
    { key: 'inflation_rate_pct', label: 'インフレ率', category: 'マーケット', catClass: 'cat-market', unit: '%', step: 0.5, decimals: 1, scale: 1, paramKey: 'inflationRate' },
    { key: 'drawdown_trigger_pct', label: 'ドローダウン閾値<br>（取崩し判定）', category: '現金バッファ', catClass: 'cat-buffer', unit: '%', step: 5.0, decimals: 1, scale: 1, paramKey: 'drawdownTrigger', requiresFeature: 'cashBuffer' },
    { key: 'replenish_pace_x_expense', label: '補充ペース<br>（月間取崩し額比）', category: '現金バッファ', catClass: 'cat-buffer', unit: '倍', step: 0.5, decimals: 1, scale: 1, paramKey: 'replenishPace', requiresFeature: 'cashBuffer' },
    { key: 'guardrail_trigger_pct', label: 'ドローダウン閾値<br>（ガードレール発動）', category: 'ガードレール', catClass: 'cat-guardrail', unit: '%', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailTrigger', requiresFeature: 'guardrail' },
    { key: 'guardrail_reduction_pct', label: '発動時の支出調整率', category: 'ガードレール', catClass: 'cat-guardrail', unit: '%', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailReduction', requiresFeature: 'guardrail' },
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
    return raw / (factor.scale || 1);
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

/**
 * テスト専用: 状態を完全に初期化する
 * app.js, analysis-ui.js, analysis-runner.js からは絶対に呼び出さないこと
 */export function _resetStateForTest() {
  state.baseContext = null;
  state.baseEffectiveParams = null;
  state.selectedFactors = [];
  state.analysisResult = null;
  state.isRunning = false;
  state.errorMessage = null;
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