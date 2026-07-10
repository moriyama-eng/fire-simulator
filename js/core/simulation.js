// ====================================================================
// js/core/simulation.js
// 単一パスのシミュレーションロジック。Workerから呼び出される。
// 分析タブからの利用でも変更はない。
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

    // v2.3.0: 初期総資産（名目値、インフレ調整なし）
    // CB OFF時は activeInitialCashBuffer が 0 のため、リスク資産のみが初期総資産となる
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

    // v2.3.0: 新指標の状態変数
    // 指標①: 初期総資産割れ 継続期間（最長）
    let currentBelowInitPeriod = 0;
    let maxBelowInitPeriod = 0;
    // 指標②: リスク資産連続売却期間（割れ中かつ売却ありの場合のみカウント）
    let currentConsecutiveSellPeriod = 0;
    let maxConsecutiveSellPeriod = 0;
    // 当月の取崩しでリスク資産を売却したかを示すフラグ（毎月リセット）
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

        // v2.3.0: 月次先頭でsoldFromRiskフラグをリセット（取崩し処理内で適切に設定される）
        soldFromRisk = false;

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

        // ---- 取崩し処理 ----
        // soldFromRisk を適切に設定する（毎月リセット済み）
        if (cashBufferToggle && useCashNextMonth) {
            // 現金バッファから取崩し
            currentCash -= currentExpense;
            soldFromRisk = false; // 現金バッファから取崩したため売却なし
        } else if (cashBufferToggle && isReplenishMode && currentCash < currentBufferLimit) {
            // 補充モード（リスク資産から現金バッファへ補充後、取崩し）
            // 補充モード中の取崩しは実質的にリスク資産の売却として扱う（指標②の要件）
            const shortage = currentBufferLimit - currentCash;
            const replenishAmount = Math.min(shortage, currentExpense * replenishPace);
            const actualReplenish = Math.min(replenishAmount, currentRiskAsset);
            currentRiskAsset -= actualReplenish;
            currentCash += actualReplenish;
            currentRiskAsset -= currentExpense;
            soldFromRisk = true; // 補充モード中は実質的にリスク資産を売却したとみなす
        } else {
            // リスク資産から直接取崩し
            currentRiskAsset -= currentExpense;
            soldFromRisk = true;
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
            // 既存 of 停滞期間：破綻後は残り月数を加算
            currentUwMonths += (totalMonths - t) + 1;
            if (currentUwMonths > maxUwMonths) maxUwMonths = currentUwMonths;

            // v2.3.0: 破綻後は残り月数を両新指標に加算（破綻=シミュレーション終了まで割れ・売却継続）
            const remainingMonths = (totalMonths - t) + 1;
            // 指標①: 破綻月を含めた残り月数を加算
            currentBelowInitPeriod += remainingMonths;
            if (currentBelowInitPeriod > maxBelowInitPeriod) {
                maxBelowInitPeriod = currentBelowInitPeriod;
            }
            // 指標②: 破綻後も売却が継続したとみなして残り月数を加算
            currentConsecutiveSellPeriod += remainingMonths;
            if (currentConsecutiveSellPeriod > maxConsecutiveSellPeriod) {
                maxConsecutiveSellPeriod = currentConsecutiveSellPeriod;
            }
            break;
        }

        // v2.3.0: 取崩し額が0円以下の月は売却なしとみなす（リセット条件②）
        if (currentExpense <= 0) {
            soldFromRisk = false;
        }

        // ---- 補正処理 ----
        // 現金バッファが負になった場合、不足分をリスク資産で補填
        if (currentCash < 0) {
            currentRiskAsset += currentCash; // currentCash は負
            currentCash = 0;
            // 補正によりリスク資産が減少した場合は売却とみなす
            soldFromRisk = true;
        }
        // リスク資産が負になった場合（取崩し額が残高を超えたケース）
        if (currentRiskAsset < 0) {
            // 実質的にリスク資産の売却が行われたとして扱う（指標②のカウント継続）
            currentCash += currentRiskAsset;
            currentRiskAsset = 0;
            soldFromRisk = true;
        }

        // 支出後総資産
        const eomAsset = currentRiskAsset + currentCash;
        // 支出後総資産（月末資産）を算出
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

        // ---- v2.3.0: 新指標の計算（月末総資産 eomAsset を基準に判定） ----
        // ① 初期総資産割れ判定（同額以上 = 回復、それ未満 = 割れ状態）
        const isBelowInit = eomAsset < initialTotalAssets;

        // 指標①: 初期総資産割れ 継続期間（最長値を追跡）
        if (isBelowInit) {
            currentBelowInitPeriod++;
        } else {
            // 同額以上で回復とみなしカウントをリセット
            currentBelowInitPeriod = 0;
        }
        if (currentBelowInitPeriod > maxBelowInitPeriod) {
            maxBelowInitPeriod = currentBelowInitPeriod;
        }

        // 指標②: リスク資産連続売却期間（割れ中かつ売却あり場合のみカウント）
        // 補充モード中は soldFromRisk = true が維持されるため、
        // else ブロック（リセット）は補充モード中に実質的に実行されない（要件通り）
        if (isBelowInit && soldFromRisk) {
            currentConsecutiveSellPeriod++;
        } else {
            // 割れが解消したか、売却が行われなかった場合（現金バッファ取崩し等）はリセット
            currentConsecutiveSellPeriod = 0;
        }
        if (currentConsecutiveSellPeriod > maxConsecutiveSellPeriod) {
            maxConsecutiveSellPeriod = currentConsecutiveSellPeriod;
        }

        // 記録
        totals[t] = eomAsset;
        cashes[t] = currentCash;
        dds[t] = eomDD;
    }

    return {
        totals, cashes, dds,
        maxDD, maxUW: maxUwMonths,
        maxBelowInitPeriod,      // v2.3.0: 初期総資産割れ最長継続期間（月数）
        maxConsecutiveSellPeriod, // v2.3.0: リスク資産最長連続売却期間（月数）
        bankrupt
    };
}