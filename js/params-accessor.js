// js/params-accessor.js
// Simulation parameter retrieval utility (prevents circular imports)

import { getParamsFromInputs } from './core/params.js';

/**
 * Retrieves the current Simulation tab parameters (shared between the Comparison tab and Analysis tab)
 * @returns {Object} Parameter object (same format as getParamsFromInputs)
 */
export function getCurrentSimParams() {
    return getParamsFromInputs({
        initialRiskAssetNum: document.getElementById('initialRiskAssetNum')?.value || '1.0',
        initialCashBufferNum: document.getElementById('initialCashBufferNum')?.value || '1000',
        monthlyExpenseNum: document.getElementById('monthlyExpenseNum')?.value || '30',
        expectedReturnNum: document.getElementById('expectedReturnNum')?.value || '10.0',
        volatilityNum: document.getElementById('volatilityNum')?.value || '18.0',
        inflationRateNum: document.getElementById('inflationRateNum')?.value || '2.0',
        simYearsNum: document.getElementById('simYearsNum')?.value || '30',
        simPathsNum: document.getElementById('simPathsNum')?.value || '10000',
        cashBufferToggle: document.getElementById('cashBufferToggle')?.checked || false,
        drawdownTriggerNum: document.getElementById('drawdownTriggerNum')?.value || '-20.0',
        drawdownReplenishNum: document.getElementById('drawdownReplenishNum')?.value || '-5.0',
        replenishPaceNum: document.getElementById('replenishPaceNum')?.value || '5.0',
        guardrailToggle: document.getElementById('guardrailToggle')?.checked || false,
        guardrailTriggerNum: document.getElementById('guardrailTriggerNum')?.value || '-20.0',
        guardrailReleaseNum: document.getElementById('guardrailReleaseNum')?.value || '-15.0',
        guardrailReductionNum: document.getElementById('guardrailReductionNum')?.value || '-20.0',
        inflationModelToggle: document.getElementById('inflationModelToggle')?.checked || false,
        infVolNum: document.getElementById('infVolNum')?.value || '2.0',
        infArNum: document.getElementById('infArNum')?.value || '0.5',
        returnModelSelect: document.getElementById('returnModelSelect')?.value || 'log-normal',
        simDfToggle: document.getElementById('simDfToggle')?.checked || true,
        simDfNum: document.getElementById('simDfNum')?.value || '4.0',
        seedToggle: document.getElementById('seedToggle')?.checked || false,
        seedNum: document.getElementById('seedNum')?.value || '123456',
        targetAssetRatioNum: document.getElementById('targetAssetRatioNum')?.value || '100',
    });
}
