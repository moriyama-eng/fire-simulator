// src/comparison-state.ts
// Comparison tab state management

import { DEFAULTS } from './core/params.js';
import type { SimulationParams } from './types/params.js';
import type { AggregatedMetrics } from './types/simulation.js';

const MAX_SCENARIOS = 10;

export interface ComparisonScenarioInputs {
    initialRiskAsset: number;
    initialCashBuffer: number;
    monthlyExpense: number;
    targetAssetRatio: number;
    expectedReturn: number;
    volatility: number;
    inflationRate: number;
    simYears: number;
    returnModel: string;
    tDfMode: string;
    tDfManual: number;
    inflationModel: string;
    infVol: number;
    infAr: number;
    cashBufferEnabled: boolean;
    drawdownTrigger: number;
    drawdownReplenish: number;
    replenishPace: number;
    guardrailEnabled: boolean;
    guardrailTrigger: number;
    guardrailRelease: number;
    guardrailReduction: number;
    [key: string]: unknown;
}

export interface ComparisonScenario {
    id: string;
    name: string;
    inputs: ComparisonScenarioInputs;
    result: AggregatedMetrics | null;
    error: string | null;
}

let scenarios: ComparisonScenario[] = [];
let commonSeed = 123456;
let commonPaths = 10000;
let isRunning = false;

function generateId(): string {
    return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : Date.now() + '-' + Math.random();
}

export function createInputsFromSimParams(simParams: Partial<SimulationParams>): ComparisonScenarioInputs {
    return {
        initialRiskAsset: simParams.initialRiskAsset ?? DEFAULTS.initialRiskAsset,
        initialCashBuffer: simParams.initialCashBuffer ?? DEFAULTS.initialCashBuffer,
        monthlyExpense: simParams.monthlyExpense ?? DEFAULTS.monthlyExpense,
        targetAssetRatio: simParams.targetAssetRatio ?? DEFAULTS.targetAssetRatio,
        expectedReturn: simParams.expectedReturn ?? DEFAULTS.expectedReturn,
        volatility: simParams.volatility ?? DEFAULTS.volatility,
        inflationRate: simParams.inflationRate ?? DEFAULTS.inflationRate,
        simYears: simParams.simYears ?? DEFAULTS.simYears,
        returnModel: simParams.useTDistribution ? 'log-t' : 'log-normal',
        tDfMode: simParams.simDfManual ? 'manual' : 'auto',
        tDfManual: simParams.simDfNum ?? DEFAULTS.simDfNum,
        inflationModel: simParams.useArInflation ? 'ar1' : 'fixed',
        infVol: simParams.infVol ?? DEFAULTS.infVol,
        infAr: simParams.infAr ?? DEFAULTS.infAr,
        cashBufferEnabled: simParams.cashBufferToggle ?? false,
        drawdownTrigger: simParams.drawdownTrigger ?? DEFAULTS.drawdownTrigger,
        drawdownReplenish: simParams.drawdownReplenish ?? DEFAULTS.drawdownReplenish,
        replenishPace: simParams.replenishPace ?? DEFAULTS.replenishPace,
        guardrailEnabled: simParams.guardrailToggle ?? false,
        guardrailTrigger: simParams.guardrailTrigger ?? DEFAULTS.guardrailTrigger,
        guardrailRelease: simParams.guardrailRelease ?? DEFAULTS.guardrailRelease,
        guardrailReduction: simParams.guardrailReduction ?? DEFAULTS.guardrailReduction,
    };
}

export function createScenario(inputs: ComparisonScenarioInputs, name: string): ComparisonScenario {
    return {
        id: generateId(),
        name,
        inputs: { ...inputs },
        result: null,
        error: null,
    };
}

export function initScenarios(initialInputs: ComparisonScenarioInputs, _t?: unknown): void {
    // Scenario names are user-editable data, not UI labels.
    // We use fixed English base names to prevent unintended translation when switching languages.
    const defaultName = 'Scenario 1';
    scenarios = [createScenario(initialInputs, defaultName)];
}

export function getScenarios(): ComparisonScenario[] { return [...scenarios]; }
export function getScenarioCount(): number { return scenarios.length; }
export function getCommonSeed(): number { return commonSeed; }
export function getCommonPaths(): number { return commonPaths; }
export function getIsRunning(): boolean { return isRunning; }
export function getMaxScenarios(): number { return MAX_SCENARIOS; }

export function setCommonSeed(seed: number): void {
    const newSeed = Math.min(99999999, Math.max(1, Math.floor(seed)));
    if (commonSeed !== newSeed) {
        commonSeed = newSeed;
        clearAllResults();
    }
}

export function setCommonPaths(paths: number): void {
    const newPaths = Math.min(50000, Math.max(5000, Math.floor(paths)));
    if (commonPaths !== newPaths) {
        commonPaths = newPaths;
        clearAllResults();
    }
}

export function setIsRunning(running: boolean): void { isRunning = running; }

function clearAllResults(): void {
    scenarios.forEach(s => { s.result = null; s.error = null; });
}

export function addScenario(inputs: ComparisonScenarioInputs, _t?: unknown): boolean {
    if (scenarios.length >= MAX_SCENARIOS) {
        return false;
    }
    // Scenario names are user-editable data, not UI labels.
    // We use fixed English base names to prevent unintended translation when switching languages.
    const newName = 'Scenario ' + (scenarios.length + 1);
    scenarios.push(createScenario(inputs, newName));
    return true;
}

export function deleteScenario(id: string): boolean {
    if (scenarios.length <= 1) return false;
    const index = scenarios.findIndex(s => s.id === id);
    if (index !== -1) { scenarios.splice(index, 1); return true; }
    return false;
}

export function duplicateScenario(id: string, _t?: unknown): boolean {
    if (scenarios.length >= MAX_SCENARIOS) {
        return false;
    }
    const original = scenarios.find(s => s.id === id);
    if (!original) return false;
    // Scenario names are user-editable data, not UI labels.
    // We use fixed English base names to prevent unintended translation when switching languages.
    const newName = 'Copy of ' + original.name;
    scenarios.push(createScenario(original.inputs, newName));
    return true;
}

export function updateScenarioName(id: string, newName: string): void {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario && newName && newName.trim() !== '') scenario.name = newName.trim();
}

export function overwriteScenarioFromSim(id: string, newInputs: ComparisonScenarioInputs): void {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.inputs = { ...newInputs }; scenario.result = null; scenario.error = null; }
}

export function updateScenarioInput(id: string, field: string, value: unknown): void {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.inputs[field] = value; scenario.result = null; scenario.error = null; }
}

export function setScenarioResult(id: string, result: AggregatedMetrics | null): void {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.result = result; scenario.error = null; }
}

export function setScenarioError(id: string, errorMsg: string | null): void {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.error = errorMsg; scenario.result = null; }
}

export function moveScenario(fromIndex: number, toIndex: number): void {
    if (scenarios.length === 0) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= scenarios.length) return;
    if (toIndex < 0 || toIndex >= scenarios.length) return;
    const [moved] = scenarios.splice(fromIndex, 1);
    scenarios.splice(toIndex, 0, moved);
}

export function _resetComparisonStateForTest(): void {
    scenarios = [];
    commonSeed = 123456;
    commonPaths = 10000;
    isRunning = false;
}
