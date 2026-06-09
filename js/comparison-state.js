// js/comparison-state.js
// 比較タブ v2.2.0 状態管理

import { DEFAULTS } from './core/params.js';

const MAX_SCENARIOS = 10;

let scenarios = [];
let commonSeed = 123456;
let commonPaths = 10000;
let isRunning = false;

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
}

export function createInputsFromSimParams(simParams) {
    return {
        initialRiskAsset: simParams.initialRiskAsset,
        initialCashBuffer: simParams.initialCashBuffer,
        monthlyExpense: simParams.monthlyExpense,
        targetAssetRatio: simParams.targetAssetRatio ?? DEFAULTS.targetAssetRatio,
        expectedReturn: simParams.expectedReturn,
        volatility: simParams.volatility,
        inflationRate: simParams.inflationRate,
        simYears: simParams.simYears,
        returnModel: simParams.useTDistribution ? 'log-t' : 'log-normal',
        tDfMode: simParams.simDfManual ? 'manual' : 'auto',
        tDfManual: simParams.simDfNum,
        inflationModel: simParams.useArInflation ? 'ar1' : 'fixed',
        infVol: simParams.infVol,
        infAr: simParams.infAr,
        cashBufferEnabled: simParams.cashBufferToggle,
        drawdownTrigger: simParams.drawdownTrigger,
        drawdownReplenish: simParams.drawdownReplenish,
        replenishPace: simParams.replenishPace,
        guardrailEnabled: simParams.guardrailToggle,
        guardrailTrigger: simParams.guardrailTrigger,
        guardrailRelease: simParams.guardrailRelease,
        guardrailReduction: simParams.guardrailReduction,
    };
}

export function createScenario(inputs, name) {
    return {
        id: generateId(),
        name,
        inputs: { ...inputs },
        result: null,
        error: null,
    };
}

export function initScenarios(initialInputs, t) {
    const defaultName = t ? t('comparison.scenarioDefaultName', [1]) : 'Scenario 1';
    scenarios = [createScenario(initialInputs, defaultName)];
}

export function getScenarios() { return [...scenarios]; }
export function getScenarioCount() { return scenarios.length; }
export function getCommonSeed() { return commonSeed; }
export function getCommonPaths() { return commonPaths; }
export function getIsRunning() { return isRunning; }
export function getMaxScenarios() { return MAX_SCENARIOS; }

export function setCommonSeed(seed) {
    const newSeed = Math.min(99999999, Math.max(1, Math.floor(seed)));
    if (commonSeed !== newSeed) {
        commonSeed = newSeed;
        clearAllResults();
    }
}

export function setCommonPaths(paths) {
    const newPaths = Math.min(50000, Math.max(1000, Math.floor(paths)));
    if (commonPaths !== newPaths) {
        commonPaths = newPaths;
        clearAllResults();
    }
}

export function setIsRunning(running) { isRunning = running; }

function clearAllResults() {
    scenarios.forEach(s => { s.result = null; s.error = null; });
}

export function addScenario(inputs, t) {
    if (scenarios.length >= MAX_SCENARIOS) {
        if (t) alert(t('comparison.maxScenarios'));
        return false;
    }
    const newName = t ? t('comparison.scenarioDefaultName', [scenarios.length + 1]) : `Scenario ${scenarios.length + 1}`;
    scenarios.push(createScenario(inputs, newName));
    return true;
}

export function deleteScenario(id) {
    if (scenarios.length <= 1) return false;
    const index = scenarios.findIndex(s => s.id === id);
    if (index !== -1) { scenarios.splice(index, 1); return true; }
    return false;
}

export function duplicateScenario(id, t) {
    if (scenarios.length >= MAX_SCENARIOS) {
        if (t) alert(t('comparison.maxScenarios'));
        return false;
    }
    const original = scenarios.find(s => s.id === id);
    if (!original) return false;
    const newName = t ? t('comparison.duplicateName', [original.name]) : `Copy of ${original.name}`;
    scenarios.push(createScenario(original.inputs, newName));
    return true;
}

export function updateScenarioName(id, newName) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario && newName && newName.trim() !== '') scenario.name = newName.trim();
}

export function overwriteScenarioFromSim(id, newInputs) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.inputs = { ...newInputs }; scenario.result = null; scenario.error = null; }
}

export function updateScenarioInput(id, field, value) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.inputs[field] = value; scenario.result = null; scenario.error = null; }
}

export function setScenarioResult(id, result) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.result = result; scenario.error = null; }
}

export function setScenarioError(id, errorMsg) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) { scenario.error = errorMsg; scenario.result = null; }
}

export function moveScenario(fromIndex, toIndex) {
    if (scenarios.length === 0) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= scenarios.length) return;
    if (toIndex < 0 || toIndex >= scenarios.length) return;
    const [moved] = scenarios.splice(fromIndex, 1);
    scenarios.splice(toIndex, 0, moved);
}

export function _resetComparisonStateForTest() {
    scenarios = [];
    commonSeed = 123456;
    commonPaths = 10000;
    isRunning = false;
}
