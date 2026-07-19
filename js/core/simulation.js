// ====================================================================
// js/core/simulation.js
// Single-path simulation logic. Called from Workers.
// No changes when used from the Analysis tab.
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

    // v2.3.0: Initial total assets (nominal value, not inflation-adjusted)
    // When CB is OFF, activeInitialCashBuffer is 0, so only risk assets are the initial total assets
    const initialTotalAssets = initialRiskAsset + activeInitialCashBuffer;

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

    // v2.3.0: State variables for new indicators
    // Indicator ①: Longest consecutive period below initial total assets
    let currentBelowInitPeriod = 0;
    let maxBelowInitPeriod = 0;
    // Indicator ②: Consecutive risk asset sell period (counted only when below initial assets AND selling)
    let currentConsecutiveSellPeriod = 0;
    let maxConsecutiveSellPeriod = 0;
    // Flag indicating whether risk assets were sold in the current month's withdrawal (reset each month)
    let soldFromRisk = false;

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

        // v2.3.0: Reset the soldFromRisk flag at the beginning of each month (set appropriately in the withdrawal process)
        soldFromRisk = false;

        // Inflation
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

        // Market return
        let Z;
        if (useTDistribution) {
            const tRand = rngs.tRand(simDf);
            Z = tRand / Math.sqrt(simDf / (simDf - 2));
        } else {
            Z = rngs.normalGen();
        }
        currentRiskAsset *= Math.exp(monthlyDrift + monthlyVol * Z);

        // Spending
        let currentExpense = monthlyExpense * infMultiplier;
        const currentBufferLimit = activeInitialCashBuffer * infMultiplier;

        if (isGuardrailActive) {
            currentExpense *= (1 + guardrailReduction / 100);
        }

        // ---- Withdrawal processing ----
        // Set soldFromRisk appropriately (already reset at the start of the month)
        if (cashBufferToggle && useCashNextMonth) {
            // Withdraw from cash buffer
            currentCash -= currentExpense;
            soldFromRisk = false; // No selling because withdrawn from cash buffer
        } else if (cashBufferToggle && isReplenishMode && currentCash < currentBufferLimit) {
            // Replenishment mode (replenish cash buffer from risk assets, then withdraw)
            // Withdrawal during replenishment mode is treated as de facto risk asset selling (requirement for Indicator ②)
            const shortage = currentBufferLimit - currentCash;
            const replenishAmount = Math.min(shortage, currentExpense * replenishPace);
            const actualReplenish = Math.min(replenishAmount, currentRiskAsset);
            currentRiskAsset -= actualReplenish;
            currentCash += actualReplenish;
            currentRiskAsset -= currentExpense;
            soldFromRisk = true; // Treated as de facto risk asset selling during replenishment mode
        } else {
            // Withdraw directly from risk assets
            currentRiskAsset -= currentExpense;
            soldFromRisk = true;
        }

        // Bankruptcy determination
        if (currentRiskAsset + currentCash <= EPSILON) {
            currentRiskAsset = 0;
            currentCash = 0;
            bankrupt = true;
            totals[t] = 0;
            cashes[t] = 0;
            dds[t] = -1.0;
            maxDD = -1.0;
            // Existing stagnation period: add remaining months after bankruptcy
            currentUwMonths += (totalMonths - t) + 1;
            if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;

            // v2.3.0: After bankruptcy, add remaining months to both new indicators (bankruptcy = below initial assets and selling continues until end of simulation)
            const remainingMonths = (totalMonths - t) + 1;
            // Indicator ①: Add remaining months including the bankruptcy month
            currentBelowInitPeriod += remainingMonths;
            if (currentBelowInitPeriod > maxBelowInitPeriod) {
                maxBelowInitPeriod = currentBelowInitPeriod;
            }
            // Indicator ②: Treated as selling continuing after bankruptcy, add remaining months
            currentConsecutiveSellPeriod += remainingMonths;
            if (currentConsecutiveSellPeriod > maxConsecutiveSellPeriod) {
                maxConsecutiveSellPeriod = currentConsecutiveSellPeriod;
            }
            break;
        }

        // v2.3.0: If the withdrawal amount is 0 yen or less in a month, it is treated as no selling (reset condition ②)
        if (currentExpense <= 0) {
            soldFromRisk = false;
        }

        // ---- Correction processing ----
        // If cash buffer goes negative, make up the shortfall from risk assets
        if (currentCash < 0) {
            currentRiskAsset += currentCash; // currentCash is negative
            currentCash = 0;
            // If risk assets decreased due to correction, treat it as selling
            soldFromRisk = true;
        }
        // If risk assets go negative (case where withdrawal amount exceeds balance)
        if (currentRiskAsset < 0) {
            // Treat as de facto risk asset selling (continue counting for Indicator ②)
            currentCash += currentRiskAsset;
            currentRiskAsset = 0;
            soldFromRisk = true;
        }

        // Post-spending total assets
        const eomAsset = currentRiskAsset + currentCash;
        // Calculate end-of-month assets (post-spending total assets)
        const safeHWM = Math.max(highWaterMark, EPSILON);
        const eomDD = Math.min(0, (eomAsset - safeHWM) / safeHWM);

        // Determination
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

        // ---- v2.3.0: Calculation of new indicators (determined based on end-of-month total assets eomAsset) ----
        // ① Determination of whether below initial total assets (equal or above = recovery, below = below state)
        const isBelowInit = eomAsset < initialTotalAssets;

        // Indicator ①: Longest consecutive period below initial total assets (track maximum value)
        if (isBelowInit) {
            currentBelowInitPeriod++;
        } else {
            // Reset count when recovered to equal or above
            currentBelowInitPeriod = 0;
        }
        if (currentBelowInitPeriod > maxBelowInitPeriod) {
            maxBelowInitPeriod = currentBelowInitPeriod;
        }

        // Indicator ②: Consecutive risk asset sell period (counted only when below initial assets AND selling)
        // During replenishment mode, soldFromRisk = true is maintained,
        // so the else block (reset) is effectively not executed during replenishment mode (as per requirements)
        if (isBelowInit && soldFromRisk) {
            currentConsecutiveSellPeriod++;
        } else {
            // Reset if below-initial state is resolved, or if no selling occurred (e.g., cash buffer withdrawal)
            currentConsecutiveSellPeriod = 0;
        }
        if (currentConsecutiveSellPeriod > maxConsecutiveSellPeriod) {
            maxConsecutiveSellPeriod = currentConsecutiveSellPeriod;
        }

        // Record
        totals[t] = eomAsset;
        cashes[t] = currentCash;
        dds[t] = eomDD;
    }

    return {
        totals, cashes, dds,
        maxDD, maxUW: maxUwMonths,
        maxBelowInitPeriod,      // v2.3.0: Longest consecutive period below initial total assets (months)
        maxConsecutiveSellPeriod, // v2.3.0: Longest consecutive risk asset sell period (months)
        bankrupt
    };
}