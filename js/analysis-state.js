// js/analysis-state.js
// Analysis tab state management

// ----- Factor definitions -----
// FACTORS moved to js/core/factors.js
// Import and re-export so that module-internal functions (like getAvailableFactors) can also reference it.
// Transparent re-export that can also be resolved via vi.mock importOriginal() in analysis-runner.test.js.
// paramKey must exactly match the property name in baseEffectiveParams (generated in app.js).
import { FACTORS } from './core/factors.js';
export { FACTORS };

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