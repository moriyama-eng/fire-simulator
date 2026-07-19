// js/analysis-state.js
// Analysis tab state management

// ----- Factor definitions -----
// paramKey must exactly match the property name in baseEffectiveParams (generated in app.js).
// It is also the property name used to apply factor changes in applyFactorChange (analysis-runner.js).
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

// ----- Analysis tab state management -----
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
 * Returns the currently available factors based on the base conditions.
 * Cash buffer factors are excluded when CB is OFF, and guardrail factors are excluded when GR is OFF.
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

// ----- State updates -----
export function setBaseContext(baseContext, baseEffectiveParams) {
    // Do not clear analysis results if the base condition is the same as the previous one
    const isSameBase = state.baseEffectiveParams && JSON.stringify(state.baseEffectiveParams) === JSON.stringify(baseEffectiveParams);

    state.baseContext = baseContext;
    state.baseEffectiveParams = baseEffectiveParams;

    if (isSameBase) return; // Do nothing if there is no change

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

// ----- Factor value calculation -----
/**
 * Returns the current base value of a factor in UI display units.
 * Scales down from the raw value of the internal parameter.
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
 * Returns the values at 5 levels in UI display units.
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
 * For testing only: forcibly sets factors
 */
export function _setAvailableFactorsForTest(factors) {
    // A hack that internally pollutes state
    // In practice, since getAvailableFactors depends on state.baseEffectiveParams,
    // it is better to call setBaseContext appropriately rather than adding functions for testing.
    // For now, modify the test code side.
}


/**
 * Returns the improvement margin in the target success rate according to the base success rate (pct).
 * - 95 or above → 0
 * - 90 or above and below 95 → 1.0
 * - 85 or above and below 90 → 2.0
 * - Below 85 → 5.0
 * @param {number} baseRatePct - Current success rate (%)
 * @returns {number} Improvement margin (%pt)
 */
export function getSuccessRateTargetDelta(baseRatePct) {
    if (baseRatePct >= 95) return 0;
    if (baseRatePct >= 90) return 1.0;
    if (baseRatePct >= 85) return 2.0;
    return 5.0;
}