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