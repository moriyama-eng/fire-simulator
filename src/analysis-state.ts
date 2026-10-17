// src/analysis-state.ts
// Analysis tab state management

import { FACTORS } from './core/factors.js';
import type { FactorDefinition } from './types/params.js';
export { FACTORS };

export interface BaseEffectiveParams {
    initialRiskAsset: number;
    initialCashBuffer: number;
    monthlyExpense: number;
    expectedReturn: number;
    volatility: number;
    inflationRate: number;
    simYears: number;
    simPaths: number;
    seed: number;
    modelType: string;
    dfMode?: string;
    simDfNum: number;
    simDfManual: boolean;
    usedDf?: number;
    inflationMode?: string;
    infVol: number;
    infAr: number;
    cashBufferToggle: boolean;
    drawdownTrigger: number;
    drawdownReplenish: number;
    replenishPace: number;
    guardrailToggle: boolean;
    guardrailTrigger: number;
    guardrailRelease: number;
    guardrailReduction: number;
    useArInflation: boolean;
    percentiles?: number[] | null;
    targetAssetRatio: number;
    [key: string]: unknown;
}

export interface BaseMetrics {
    success_rate_pct: number;
    final_median_jpy: number;
    final_p10_jpy: number;
    worst10_max_dd: number;
    target_asset_maintain_rate: number;
}

export interface ScenarioPoint {
    level: number;
    metrics: BaseMetrics;
    modifiedEp?: BaseEffectiveParams;
    modifiedValue?: number;
}

export interface AnalysisResult {
    baseScenario: { metrics: BaseMetrics };
    perFactorResults: Record<string, ScenarioPoint[]>;
}

export interface AnalysisState {
    baseContext: { summary?: Record<string, unknown>; [key: string]: unknown } | null;
    baseEffectiveParams: BaseEffectiveParams | null;
    selectedFactors: string[];
    analysisResult: AnalysisResult | null;
    isRunning: boolean;
    errorMessage: string | null;
}

// ----- Analysis tab state management -----
const state: AnalysisState = {
    baseContext: null,
    baseEffectiveParams: null,
    selectedFactors: [],
    analysisResult: null,
    isRunning: false,
    errorMessage: null,
};

export function getState(): AnalysisState { return state; }
export function getBaseEffectiveParams(): BaseEffectiveParams | null { return state.baseEffectiveParams; }
export function getSelectedFactors(): string[] { return [...state.selectedFactors]; }
export function getAnalysisResult(): AnalysisResult | null { return state.analysisResult; }
export function getErrorMessage(): string | null { return state.errorMessage; }

/**
 * Returns the currently available factors based on the base conditions.
 * Cash buffer factors are excluded when CB is OFF, and guardrail factors are excluded when GR is OFF.
 */
export function getAvailableFactors(): FactorDefinition[] {
    const bp = state.baseEffectiveParams;
    if (!bp) return [];
    return FACTORS.filter(f => {
        if (f.requiresFeature === 'cashBuffer' && !bp.cashBufferToggle) return false;
        if (f.requiresFeature === 'guardrail' && !bp.guardrailToggle) return false;
        return true;
    });
}

// ----- State updates -----
export function setBaseContext(
    baseContext: { summary?: Record<string, unknown>; [key: string]: unknown } | null,
    baseEffectiveParams: BaseEffectiveParams | null
): void {
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

export function setSelectedFactors(factorKeys: string[]): void {
    state.selectedFactors = [...factorKeys];
    state.analysisResult = null;
}

export function setRunning(isRunning: boolean): void {
    state.isRunning = isRunning;
    if (!isRunning) state.errorMessage = null;
}

export function setAnalysisResult(result: AnalysisResult | null): void {
    state.analysisResult = result;
    state.isRunning = false;
    state.errorMessage = null;
}

export function setErrorMessage(msg: string | null): void {
    state.errorMessage = msg;
    state.isRunning = false;
}

// ----- Factor value calculation -----
/**
 * Returns the current base value of a factor in UI display units.
 * Scales down from the raw value of the internal parameter.
 */
export function getFactorBaseValue(factorKey: string): number | null {
    const bp = state.baseEffectiveParams;
    if (!bp) return null;
    const factor = FACTORS.find(f => f.key === factorKey);
    if (!factor) return null;
    const raw = bp[factor.paramKey];
    if (typeof raw !== 'number') return null;
    const value = raw / (factor.scale || 1);

    return value;
}

/**
 * Returns the values at 5 levels in UI display units.
 */
export function getGeneratedValues(factorKey: string): number[] | null {
    const base = getFactorBaseValue(factorKey);
    if (base === null) return null;
    const factor = FACTORS.find(f => f.key === factorKey);
    if (!factor) return null;
    const step = factor.step;
    return [-2, -1, 0, 1, 2].map(s => base + s * step);
}

export function getScenarioCount(): number {
    return 1 + state.selectedFactors.length * 4;
}

export function _resetStateForTest(): void {
    state.baseContext = null;
    state.baseEffectiveParams = null;
    state.selectedFactors = [];
    state.analysisResult = null;
    state.isRunning = false;
    state.errorMessage = null;
}

/**
 * Returns the improvement margin in the target success rate according to the base success rate (pct).
 * - 95 or above -> 0
 * - 90 or above and below 95 -> 1.0
 * - 85 or above and below 90 -> 2.0
 * - Below 85 -> 5.0
 * @param baseRatePct - Current success rate (%)
 * @returns Improvement margin (%pt)
 */
export function getSuccessRateTargetDelta(baseRatePct: number): number {
    if (baseRatePct >= 95) return 0;
    if (baseRatePct >= 90) return 1.0;
    if (baseRatePct >= 85) return 2.0;
    return 5.0;
}
