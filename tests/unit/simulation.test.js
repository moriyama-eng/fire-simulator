import { readFileSync } from 'fs';
import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from '../../js/core/random.js';
import { runSinglePath } from '../../js/core/simulation.js';
import { getParamsFromInputs } from '../../js/core/params.js';
import { describe, it, expect } from 'vitest';
import { evaluateMonthEnd } from '../../js/core/simulation.js';

describe('evaluateMonthEnd', () => {
    const cfg = { cashBufferToggle: true, ddThreshold: -0.2, ddReplenishThreshold: -0.05, guardrailToggle: true, triggerGR: -0.2, releaseGR: -0.15 };
    it('activates guardrail when drawdown exceeds threshold', () => {
        const state = { isGuardrailActive: false, currentUwMonths: 0, maxUwMonths: 0, maxDD: 0, isReplenishMode: false };
        const res = evaluateMonthEnd(100, 120, -0.25, state, cfg);
        expect(res.isGuardrailActive).toBe(true);
    });
    it('uses cash buffer when drawdown threshold is met', () => {
        const state = { isGuardrailActive: false, currentUwMonths: 0, maxUwMonths: 0, maxDD: 0, isReplenishMode: false };
        const res = evaluateMonthEnd(100, 120, -0.25, state, cfg);
        expect(res.useCashNextMonth).toBe(true);
    });
    it('starts replenishment mode when asset exceeds high water mark', () => {
        const state = { isGuardrailActive: false, currentUwMonths: 0, maxUwMonths: 0, maxDD: 0, isReplenishMode: false };
        const res = evaluateMonthEnd(130, 120, 0, state, cfg);
        expect(res.isReplenishMode).toBe(true);
        expect(res.highWaterMark).toBe(130);
    });
});

const referenceResults = JSON.parse(readFileSync('tests/fixtures/reference-results.json', 'utf-8'));

const defaultInputs = {
    initialRiskAssetNum: '1.0', initialCashBufferNum: '1,000', monthlyExpenseNum: '30',
    expectedReturnNum: '10.0', volatilityNum: '18.0', inflationRateNum: '2.0',
    simYearsNum: '30', simPathsNum: '1000',
    cashBufferToggle: true, drawdownTriggerNum: '-20.0', drawdownReplenishNum: '-5.0', replenishPaceNum: '5.0',
    guardrailToggle: false, guardrailTriggerNum: '-20.0', guardrailReleaseNum: '-15.0', guardrailReductionNum: '-20.0',
    inflationModelToggle: false, infVolNum: '2.0', infArNum: '0.5',
    returnModelSelect: 'log-t', simDfToggle: true, simDfNum: '4.0',
    seedToggle: false, seedNum: '123456'
};

describe('Reproducibility', () => {
    it('matches reference data with fixed seed 123456', () => {
        const params = getParamsFromInputs(defaultInputs);
        // reference-results.json は paths=1000 で生成されたため、
        // getParamsFromInputs のクランプ（5000）を上書きして 1000 に戻す
        params.simPaths = 1000;
        const seed = params.seedNum;
        const finalValues = [];
        let bankruptCount = 0;
        for (let p = 0; p < params.simPaths; p++) {
            const rng = xoshiro128ss(seed + p);
            const normalGen = createNormalGenerator(rng);
            const gammaRand = createGammaGenerator(rng, normalGen);
            const tRand = createTGenerator(normalGen, gammaRand);
            const res = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
            finalValues.push(res.totals[res.totals.length - 1]);
            if (res.bankrupt) bankruptCount++;
        }
        const successRate = ((params.simPaths - bankruptCount) / params.simPaths * 100);
        finalValues.sort((a, b) => a - b);
        const medianIdx = Math.floor(0.50 * (params.simPaths - 1));
        const finalMedian = finalValues[medianIdx];
        expect(successRate).toBeCloseTo(referenceResults.successRate, 1);
        expect(finalMedian).toBeCloseTo(referenceResults.finalMedian, 0);
    });
});

// ====================================================================
// v2.3.0: 新指標（初期総資産割れ継続期間・リスク資産連続売却期間）のユニットテスト
// ====================================================================
describe('New below-initial metrics', () => {
    /**
     * runSinglePath のヘルパー：RNG を固定シードで初期化して呼び出す
     */
    function runWithParams(inputs, seedOffset = 0) {
        const params = getParamsFromInputs(inputs);
        const seed = params.seedNum + seedOffset;
        const rng = xoshiro128ss(seed);
        const normalGen = createNormalGenerator(rng);
        const gammaRand = createGammaGenerator(rng, normalGen);
        const tRand = createTGenerator(normalGen, gammaRand);
        return runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
    }

    it('returns maxBelowInitPeriod and maxConsecutiveSellPeriod in result', () => {
        // 戻り値に新指標が含まれることを確認
        const result = runWithParams(defaultInputs);
        expect(result).toHaveProperty('maxBelowInitPeriod');
        expect(result).toHaveProperty('maxConsecutiveSellPeriod');
        expect(typeof result.maxBelowInitPeriod).toBe('number');
        expect(typeof result.maxConsecutiveSellPeriod).toBe('number');
    });

    it('maxConsecutiveSellPeriod <= maxBelowInitPeriod always holds', () => {
        // 指標②は割れ中かつ売却あり期間のみカウントするため、常に指標①以下
        const params = getParamsFromInputs(defaultInputs);
        for (let p = 0; p < 10; p++) {
            const rng = xoshiro128ss(params.seedNum + p);
            const normalGen = createNormalGenerator(rng);
            const gammaRand = createGammaGenerator(rng, normalGen);
            const tRand = createTGenerator(normalGen, gammaRand);
            const res = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
            expect(res.maxConsecutiveSellPeriod).toBeLessThanOrEqual(res.maxBelowInitPeriod);
        }
    });

    it('returns non-negative values for both metrics', () => {
        // 両指標が常に非負であることを確認
        const result = runWithParams(defaultInputs, 42);
        expect(result.maxBelowInitPeriod).toBeGreaterThanOrEqual(0);
        expect(result.maxConsecutiveSellPeriod).toBeGreaterThanOrEqual(0);
    });

    it('matches reference data for new metrics (reproducibility)', () => {
        // 参照データとの再現性確認（reference-belowinit-results.json の値と照合）
        const referenceData = JSON.parse(readFileSync('tests/fixtures/reference-belowinit-results.json', 'utf-8'));
        const params = getParamsFromInputs(defaultInputs);
        params.simPaths = 1000;
        const seed = params.seedNum;

        let maxBelowInit = 0;
        let maxConsecutiveSell = 0;
        for (let p = 0; p < params.simPaths; p++) {
            const rng = xoshiro128ss(seed + p);
            const normalGen = createNormalGenerator(rng);
            const gammaRand = createGammaGenerator(rng, normalGen);
            const tRand = createTGenerator(normalGen, gammaRand);
            const res = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
            if (res.maxBelowInitPeriod > maxBelowInit) maxBelowInit = res.maxBelowInitPeriod;
            if (res.maxConsecutiveSellPeriod > maxConsecutiveSell) maxConsecutiveSell = res.maxConsecutiveSellPeriod;
        }
        expect(maxBelowInit).toBe(referenceData.belowInitMaxPeriods);
        expect(maxConsecutiveSell).toBe(referenceData.consecutiveSellMaxPeriods);
    });

    it('resets count when recovered to initial total assets', () => {
        const customParams = getParamsFromInputs({
            ...defaultInputs,
            initialRiskAssetNum: '1000',
            initialCashBufferNum: '0',
            monthlyExpenseNum: '10', // 支出を10に小さくして破綻を防ぐ
            expectedReturnNum: '0',
            volatilityNum: '120', // monthlyVol ≒ 0.3464
            inflationRateNum: '0',
            simYearsNum: '1', // 12ヶ月
            cashBufferToggle: false,
            returnModelSelect: 'log-normal',
        });

        // 資産の初期値 = 1000
        // Z の列を設定して資産の動きをコントロールする
        // t=0: 1000
        // t=1: Z=-1 (資産減、支出後 < 1000) -> belowInit: 1
        // t=2: Z=-1 (資産減、支出後 < 1000) -> belowInit: 2
        // t=3: Z=3  (資産増、支出後 >= 1000) -> belowInit: 0 にリセット
        // t=4: Z=-1 (資産減、支出後 < 1000) -> belowInit: 1
        // t=5: Z=3  (資産増、支出後 >= 1000) -> belowInit: 0
        // 期待される maxBelowInitPeriod は 2。
        const zValues = [-1, -1, 3, -1, 3, 0, 0, 0, 0, 0, 0, 0];
        let zIdx = 0;
        const rngs = {
            rng: () => 0,
            normalGen: () => zValues[zIdx++],
            gammaRand: () => 0,
            tRand: () => 0
        };

        const res = runSinglePath(rngs, customParams);
        expect(res.maxBelowInitPeriod).toBe(2);
    });

    it('does not reset consecutive sell count during replenishment mode', () => {
        const customParams = getParamsFromInputs({
            ...defaultInputs,
            initialRiskAssetNum: '800',
            initialCashBufferNum: '200',
            monthlyExpenseNum: '50',
            expectedReturnNum: '0',
            volatilityNum: '120', // monthlyVol ≒ 0.3464
            inflationRateNum: '0',
            simYearsNum: '1', // 12ヶ月
            cashBufferToggle: true,
            drawdownTriggerNum: '-20.0', // ddThreshold = -0.2
            drawdownReplenishNum: '-5.0', // ddReplenishThreshold = -0.05
            replenishPaceNum: '5.0',
            returnModelSelect: 'log-normal',
        });

        // t=1: Z=-3 (資産減) -> eomAsset < 800 (belowInit), eomDD <= -0.2 -> useCashNextMonth = true
        // t=2: Z=6 (資産増) -> eomAsset >= HWM (1000) -> HWM更新, isReplenishMode = true. useCashNextMonth=trueによりcash=150.
        // t=3: Z=-1.25 (資産少し減) -> useCashNextMonth=false, isReplenishMode=true, cash=150<200.
        //      補充処理が走り、現金バッファから支出されるが soldFromRisk=true になる。
        //      支出後 eomAsset < 1000 となり belowInit=true.
        //      consecutiveSellPeriod が 1 になることを確認。
        const zValues = [-3, 6, -1.25, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let zIdx = 0;
        const rngs = {
            rng: () => 0,
            normalGen: () => zValues[zIdx++],
            gammaRand: () => 0,
            tRand: () => 0
        };

        const res = runSinglePath(rngs, customParams);
        // t=3 で consecutiveSellPeriod が 1 以上になっているはず
        expect(res.maxConsecutiveSellPeriod).toBeGreaterThanOrEqual(1);
    });

    it('resets consecutive sell count when withdrawal amount is zero', () => {
        const customParams = getParamsFromInputs({
            ...defaultInputs,
            initialRiskAssetNum: '1000',
            initialCashBufferNum: '0',
            monthlyExpenseNum: '100',
            expectedReturnNum: '0',
            volatilityNum: '120',
            inflationRateNum: '0',
            simYearsNum: '1',
            cashBufferToggle: false,
            guardrailToggle: true,
            guardrailTriggerNum: '-10.0',      // eomDD <= -0.10 で発動
            guardrailReleaseNum: '-5.0',
            guardrailReductionNum: '-100.0',   // 削減率 -100% (支出0)
            returnModelSelect: 'log-normal',
        });

        const zValues = [-3, 0, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let zIdx = 0;
        const rngs = {
            rng: () => 0,
            normalGen: () => zValues[zIdx++],
            gammaRand: () => 0,
            tRand: () => 0
        };

        const res = runSinglePath(rngs, customParams);
        expect(res.maxConsecutiveSellPeriod).toBe(1);
    });
});