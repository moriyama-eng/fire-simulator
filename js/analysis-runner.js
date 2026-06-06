// js/analysis-runner.js
// 分析タブ v2.0.0 シナリオ生成・実行

import * as AS from './analysis-state.js';
import { runSimulation } from './simulation-engine.js';

/**
 * @typedef {Object} AnalysisResult
 * @property {Object} baseScenario
 * @property {BaseMetrics} baseScenario.metrics
 * @property {Object.<string, Array<ScenarioPoint>>} perFactorResults
 *
 * @typedef {Object} BaseMetrics
 * @property {number} success_rate_pct
 * @property {number} final_median_jpy
 * @property {number} final_p10_jpy
 * @property {number} worst10_max_dd
 *
 * @typedef {Object} ScenarioPoint
 * @property {number} level - -2, -1, 0, 1, 2
 * @property {BaseMetrics} metrics
 */

/**
 * 分析用の有効パラメータ(ep)をシミュレーションエンジン用のパラメータ形式に変換する。
 * app.js の convertToEffectiveParams と対になる逆変換の関係。
 */
export function convertToLegacyParams(ep) {
    return {
        initialRiskAsset: ep.initialRiskAsset,
        initialCashBuffer: ep.cashBufferToggle ? (ep.initialCashBuffer ?? 0) : 0,
        monthlyExpense: ep.monthlyExpense,
        expectedReturn: ep.expectedReturn,
        volatility: ep.volatility,
        inflationRate: ep.inflationRate,
        simYears: ep.simYears,
        simPaths: Math.max(1000, Math.min(50000, ep.simPaths)),
        cashBufferToggle: ep.cashBufferToggle ?? false,
        drawdownTrigger: ep.drawdownTrigger ?? 0,
        drawdownReplenish: ep.drawdownReplenish ?? 0,
        replenishPace: ep.replenishPace ?? 0,
        guardrailToggle: ep.guardrailToggle ?? false,
        guardrailTrigger: ep.guardrailTrigger ?? 0,
        guardrailReduction: ep.guardrailReduction ?? 0,
        guardrailRelease: ep.guardrailRelease ?? 0,
        useArInflation: ep.useArInflation ?? false,
        infVol: ep.infVol ?? 2.0,
        infAr: ep.infAr ?? 0.5,
        useTDistribution: ep.modelType === 'log-t',
        simDfManual: ep.simDfManual ?? false,
        simDfNum: ep.simDfNum ?? 4.0,
        useFixedSeed: true,
        seedNum: ep.seed,
        targetAssetRatio: ep.targetAssetRatio,
    };
}

export async function runAnalysis(onProgress) {
    const baseEp = AS.getState().baseEffectiveParams;
    if (!baseEp) throw new Error('error.noBase');
    const selected = AS.getSelectedFactors();
    if (selected.length === 0) throw new Error('error.noFactors');

    const baseLegacy = convertToLegacyParams(baseEp);
    const pcts = [10, 30, 50, 70, 90];
    const totalScenarios = 1 + selected.length * 4;
    if (onProgress) onProgress({ done: 0, total: totalScenarios });

    const baseRes = await runSimulation(baseLegacy, pcts);
    const baseMetrics = extractMetrics(baseRes);

    const perFactorResults = {};
    let current = 1;
    for (const factorKey of selected) {
        const factor = AS.FACTORS.find(f => f.key === factorKey);
        const baseValue = AS.getFactorBaseValue(factorKey); // UI単位
        const results = [];
        for (const level of [-2, -1, 0, 1, 2]) {
            if (level === 0) continue; // 基準水準(level=0)は既に実行済みのためスキップ
            const modifiedEp = { ...baseEp };
            // UI単位の値を渡す。applyFactorChange が内部で scale を掛けて生の値に変換する。
            applyFactorChange(modifiedEp, factor, baseValue + factor.step * level);
            const leg = convertToLegacyParams(modifiedEp);
            const res = await runSimulation(leg, pcts);
            results.push({ level, metrics: extractMetrics(res) });
            current++;
            if (onProgress) onProgress({ done: current, total: totalScenarios });
        }
        perFactorResults[factorKey] = results;
    }

    return {
        baseScenario: { metrics: baseMetrics },
        perFactorResults,
    };
}

export function applyFactorChange(ep, factor, value) {
    const scaledValue = factor.scale && factor.scale !== 1 ? Math.round(value * factor.scale) : value;
    ep[factor.paramKey] = scaledValue;
}

function extractMetrics(simResult) {
    const pcts = [10, 30, 50, 70, 90];
    const p10Idx = pcts.indexOf(10);
    return {
        success_rate_pct: simResult.successRate,
        final_median_jpy: simResult.finalMedian,
        final_p10_jpy: simResult.totalPercentileData[p10Idx][simResult.dataLen - 1],
        worst10_max_dd: simResult.worst10MaxDd,
        target_asset_maintain_rate: simResult.targetAssetMaintainRate,
    };
}