// src/params-accessor.ts
// Simulation parameter retrieval utility (prevents circular imports)

import { getParamsFromInputs } from './core/params.js';
import type { SimulationParams } from './types/params.js';

function getInputValue(id: string, fallback: string): string {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        return el.value || fallback;
    }
    return fallback;
}

function getInputChecked(id: string, fallback: boolean): boolean {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
        return el.checked;
    }
    return fallback;
}

/**
 * Retrieves the current Simulation tab parameters (shared between the Comparison tab and Analysis tab)
 * @returns Parameter object (same format as getParamsFromInputs)
 */
export function getCurrentSimParams(): SimulationParams {
    return getParamsFromInputs({
        initialRiskAssetNum: getInputValue('initialRiskAssetNum', '1.0'),
        initialCashBufferNum: getInputValue('initialCashBufferNum', '1000'),
        monthlyExpenseNum: getInputValue('monthlyExpenseNum', '30'),
        expectedReturnNum: getInputValue('expectedReturnNum', '10.0'),
        volatilityNum: getInputValue('volatilityNum', '18.0'),
        inflationRateNum: getInputValue('inflationRateNum', '2.0'),
        simYearsNum: getInputValue('simYearsNum', '30'),
        simPathsNum: getInputValue('simPathsNum', '10000'),
        cashBufferToggle: getInputChecked('cashBufferToggle', false),
        drawdownTriggerNum: getInputValue('drawdownTriggerNum', '-20.0'),
        drawdownReplenishNum: getInputValue('drawdownReplenishNum', '-5.0'),
        replenishPaceNum: getInputValue('replenishPaceNum', '5.0'),
        guardrailToggle: getInputChecked('guardrailToggle', false),
        guardrailTriggerNum: getInputValue('guardrailTriggerNum', '-20.0'),
        guardrailReleaseNum: getInputValue('guardrailReleaseNum', '-15.0'),
        guardrailReductionNum: getInputValue('guardrailReductionNum', '-20.0'),
        inflationModelToggle: getInputChecked('inflationModelToggle', false),
        infVolNum: getInputValue('infVolNum', '2.0'),
        infArNum: getInputValue('infArNum', '0.5'),
        returnModelSelect: getInputValue('returnModelSelect', 'log-normal'),
        simDfToggle: getInputChecked('simDfToggle', true),
        simDfNum: getInputValue('simDfNum', '4.0'),
        seedToggle: getInputChecked('seedToggle', false),
        seedNum: getInputValue('seedNum', '123456'),
        targetAssetRatioNum: getInputValue('targetAssetRatioNum', '100'),
    });
}
