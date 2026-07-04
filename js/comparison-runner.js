// js/comparison-runner.js
// 比較タブ 実行ロジック

import { runSimulation, setProgressCallback, getProgressCallback } from './simulation-engine.js';
import { setScenarioResult, setScenarioError, setIsRunning, getScenarios, getCommonSeed, getCommonPaths } from './comparison-state.js';
import { t } from './i18n.js';

export function convertComparisonParamsToLegacy(inputs, commonSeed, commonPaths) {
    const simPaths = Math.max(5000, Math.min(50000, commonPaths));
    const clampNegative = (val) => Math.min(0, val);
    const clampPositive = (val, minVal = 0) => Math.max(minVal, val);
    // tDfManual のガード（undefined 対策）デフォルト値は DEFAULTS.simDfNum (4.0) と同じ
    const tDfManualValue = (inputs.tDfManual !== undefined && inputs.tDfManual !== null) ? inputs.tDfManual : 4.0;

    return {
        initialRiskAsset: inputs.initialRiskAsset,
        initialCashBuffer: inputs.cashBufferEnabled ? inputs.initialCashBuffer : 0,
        monthlyExpense: inputs.monthlyExpense,
        expectedReturn: inputs.expectedReturn,
        volatility: inputs.volatility,
        inflationRate: inputs.inflationRate,
        simYears: inputs.simYears,
        simPaths: simPaths,
        cashBufferToggle: inputs.cashBufferEnabled,
        drawdownTrigger: clampNegative(inputs.drawdownTrigger),
        drawdownReplenish: clampNegative(inputs.drawdownReplenish),
        replenishPace: clampPositive(inputs.replenishPace),
        guardrailToggle: inputs.guardrailEnabled,
        guardrailTrigger: clampNegative(inputs.guardrailTrigger),
        guardrailReduction: clampNegative(inputs.guardrailReduction),
        guardrailRelease: clampNegative(inputs.guardrailRelease),
        useArInflation: inputs.inflationModel === 'ar1',
        infVol: clampPositive(inputs.infVol),
        infAr: Math.min(1.0, Math.max(0, inputs.infAr)),
        useTDistribution: inputs.returnModel === 'log-t',
        simDfManual: inputs.tDfMode === 'manual',
        simDfNum: Math.max(2.5, tDfManualValue),
        useFixedSeed: true,
        seedNum: commonSeed,
        targetAssetRatio: Math.min(500, Math.max(0, inputs.targetAssetRatio)),
    };
}

export async function runAllScenarios(onProgress, onScenarioComplete, onAllComplete, onError) {
    const scenarios = getScenarios();
    if (scenarios.length === 0) {
        onAllComplete();
        return;
    }

    setIsRunning(true);
    const seed = getCommonSeed();
    const paths = getCommonPaths();
    const percentiles = [10, 30, 50, 70, 90];

    const savedCallback = getProgressCallback();
    setProgressCallback(null);

    try {
        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            onProgress(i + 1, scenarios.length);
            try {
                const legacyParams = convertComparisonParamsToLegacy(scenario.inputs, seed, paths);
                const result = await runSimulation(legacyParams, percentiles);
                setScenarioResult(scenario.id, result);
                onScenarioComplete(scenario.id, result);
            } catch (err) {
                const errorMsg = err.message?.startsWith('error.') ? t(err.message) : (err.message || t('error.simulationFailed'));
                setScenarioError(scenario.id, errorMsg);
                onError(scenario.id, errorMsg);
                console.error(`Simulation failed for scenario "${scenario.name}":`, err);
            }
        }
        // ループ終了後の onProgress は呼ばない（二重実行防止）
    } finally {
        setIsRunning(false);
        setProgressCallback(savedCallback);
        onAllComplete();
    }
}
