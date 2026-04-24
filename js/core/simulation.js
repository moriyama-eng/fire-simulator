// ====================================================================
// js/core/simulation.js
// ====================================================================

import { calcAutoDf } from './params.js';

const EPSILON = 1.0;

export function evaluateMonthEnd(eomAsset, highWaterMark, eomDD, state, cfg) {
    const {
        cashBufferToggle, ddThreshold, ddReplenishThreshold,
        guardrailToggle, triggerGR, releaseGR
    } = cfg;

    const useCashNextMonth = cashBufferToggle && (eomDD <= ddThreshold);

    let isGuardrailActive = state.isGuardrailActive;
    if (guardrailToggle) {
        if (eomDD <= triggerGR) {
            isGuardrailActive = true;
        } else if (isGuardrailActive && eomDD >= releaseGR) {
            isGuardrailActive = false;
        }
    }

    let isReplenishMode = state.isReplenishMode;
    let newHighWaterMark = highWaterMark;
    let currentUwMonths = state.currentUwMonths + 1;
    let maxUwMonths = state.maxUwMonths;

    if (eomAsset >= highWaterMark) {
        currentUwMonths = 0;
        newHighWaterMark = eomAsset;
        isReplenishMode = true;
    } else {
        if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
        if (eomDD <= ddReplenishThreshold) {
            isReplenishMode = false;
        }
    }

    const newMaxDD = Math.min(state.maxDD, eomDD);

    return {
        useCashNextMonth,
        isGuardrailActive,
        isReplenishMode,
        currentUwMonths,
        maxUwMonths,
        maxDD: newMaxDD,
        highWaterMark: newHighWaterMark
    };
}

export function runSinglePath(rngs, params) {
    const {
        initialRiskAsset, initialCashBuffer, monthlyExpense,
        expectedReturn, volatility, inflationRate, simYears,
        cashBufferToggle, drawdownTrigger, drawdownReplenish, replenishPace,
        guardrailToggle, guardrailTrigger, guardrailReduction, guardrailRelease,
        useArInflation, infVol, infAr,
        useTDistribution, simDfManual, simDfNum
    } = params;

    const totalMonths = simYears * 12;
    const dataLen = totalMonths + 1;

    const arithmeticReturn = expectedReturn / 100;
    const annualVol = volatility / 100;
    const adjustedAnnualDrift = Math.log(1 + arithmeticReturn) - (annualVol * annualVol) / 2;
    const monthlyDrift = adjustedAnnualDrift / 12;
    const monthlyVol = annualVol / Math.sqrt(12);
    const activeInitialCashBuffer = cashBufferToggle ? initialCashBuffer : 0;
    const ddThreshold = -Math.abs(drawdownTrigger / 100);
    const ddReplenishThreshold = -Math.abs(drawdownReplenish / 100);
    const triggerGR = guardrailTrigger / 100;
    const releaseGR = guardrailRelease / 100;
    const simDf = simDfManual ? simDfNum : calcAutoDf(volatility);

    const totals = new Float32Array(dataLen);
    const cashes = new Float32Array(dataLen);
    const dds = new Float32Array(dataLen);

    let currentRiskAsset = initialRiskAsset;
    let currentCash = activeInitialCashBuffer;
    let highWaterMark = initialRiskAsset + currentCash;
    let bankrupt = false;
    let isReplenishMode = false;
    let useCashNextMonth = false;
    let isGuardrailActive = false;
    let currentUwMonths = 0;
    let maxUwMonths = 0;
    let maxDD = 0;

    totals[0] = currentRiskAsset + currentCash;
    cashes[0] = currentCash;
    dds[0] = 0;

    const evalCfg = {
        cashBufferToggle, ddThreshold, ddReplenishThreshold,
        guardrailToggle, triggerGR, releaseGR
    };

    let currentInfRate = inflationRate / 100;
    let infMultiplier = 1.0;

    for (let t = 1; t <= totalMonths; t++) {
        if (bankrupt) break;

        // インフレ
        if (useArInflation) {
            const annualInfVol = infVol / 100;
            const monthlyInfVol = annualInfVol / Math.sqrt(12);
            const InfZ = rngs.normalGen();
            const expectedLongTermInf = inflationRate / 100;
            const C = (1 - infAr) * expectedLongTermInf;
            currentInfRate = C + (infAr * currentInfRate) + (monthlyInfVol * InfZ);
            infMultiplier *= Math.exp(currentInfRate / 12);
        } else {
            infMultiplier = Math.pow(1 + inflationRate / 100, t / 12);
        }

        // 市場リターン
        let Z;
        if (useTDistribution) {
            const tRand = rngs.tRand(simDf);
            Z = tRand / Math.sqrt(simDf / (simDf - 2));
        } else {
            Z = rngs.normalGen();
        }
        currentRiskAsset *= Math.exp(monthlyDrift + monthlyVol * Z);

        // 支出
        let currentExpense = monthlyExpense * infMultiplier;
        const currentBufferLimit = activeInitialCashBuffer * infMultiplier;

        if (isGuardrailActive) {
            currentExpense *= (1 + guardrailReduction / 100);
        }

        if (cashBufferToggle && useCashNextMonth) {
            currentCash -= currentExpense;
        } else if (cashBufferToggle && isReplenishMode && currentCash < currentBufferLimit) {
            const shortage = currentBufferLimit - currentCash;
            const replenishAmount = Math.min(shortage, currentExpense * replenishPace);
            const actualReplenish = Math.min(replenishAmount, currentRiskAsset);
            currentRiskAsset -= actualReplenish;
            currentCash += actualReplenish;
            currentRiskAsset -= currentExpense;
        } else {
            currentRiskAsset -= currentExpense;
        }

        // 破綻判定
        if (currentRiskAsset + currentCash <= EPSILON) {
            currentRiskAsset = 0;
            currentCash = 0;
            bankrupt = true;
            totals[t] = 0;
            cashes[t] = 0;
            dds[t] = -1.0;
            maxDD = -1.0;
            currentUwMonths += (totalMonths - t) + 1;
            if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;
            break;
        }
        if (currentCash < 0) { currentRiskAsset += currentCash; currentCash = 0; }
        if (currentRiskAsset < 0) { currentCash += currentRiskAsset; currentRiskAsset = 0; }

        // 支出後総資産
        const eomAsset = currentRiskAsset + currentCash;
        const safeHWM = Math.max(highWaterMark, EPSILON);
        const eomDD = Math.min(0, (eomAsset - safeHWM) / safeHWM);

        // 判定
        const newState = evaluateMonthEnd(eomAsset, highWaterMark, eomDD, {
            isGuardrailActive,
            currentUwMonths,
            maxUwMonths,
            maxDD,
            isReplenishMode
        }, evalCfg);

        useCashNextMonth = newState.useCashNextMonth;
        isGuardrailActive = newState.isGuardrailActive;
        isReplenishMode = newState.isReplenishMode;
        currentUwMonths = newState.currentUwMonths;
        maxUwMonths = newState.maxUwMonths;
        maxDD = newState.maxDD;
        highWaterMark = newState.highWaterMark;

        // 記録
        totals[t] = eomAsset;
        cashes[t] = currentCash;
        dds[t] = eomDD;
    }

    return { totals, cashes, dds, maxDD, maxUW: maxUwMonths, bankrupt };
}