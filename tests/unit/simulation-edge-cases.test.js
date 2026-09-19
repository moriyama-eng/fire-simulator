import { describe, it, expect } from 'vitest';
import { runSinglePath } from '../../js/core/simulation.js';
import { xoshiro128ss, createNormalGenerator } from '../../js/core/random.js';

describe('simulation-edge-cases (deficit compensation)', () => {
  it('exercises negative risk asset correction when monthly withdrawal exceeds risk balance but cash buffer remains', () => {
    const rng = xoshiro128ss(42);
    const normalGen = createNormalGenerator(rng);
    const rngs = { normalGen };

    const extremeParams = {
      initialRiskAsset: 1_000,
      initialCashBuffer: 10_000_000,
      monthlyExpense: 10_000,
      expectedReturn: 5.0,
      volatility: 15.0,
      inflationRate: 2.0,
      simYears: 1,
      cashBufferToggle: true,
      drawdownTrigger: -20.0,
      drawdownReplenish: -5.0,
      replenishPace: 5.0,
      guardrailToggle: false,
      guardrailTrigger: -20.0,
      guardrailReduction: -20.0,
      guardrailRelease: -15.0,
      useArInflation: false,
      infVol: 2.0,
      infAr: 0.5,
      useTDistribution: false,
      simDfManual: false,
      simDfNum: 4.0
    };

    const pathResult = runSinglePath(rngs, extremeParams);

    expect(pathResult).toBeDefined();
    expect(pathResult.totals).toBeInstanceOf(Float32Array);
    expect(pathResult.totals.length).toBe(13);
    // Verified that path runs to completion without premature bankruptcy
    expect(pathResult.bankrupt).toBe(false);
    expect(pathResult.totals[1]).toBeGreaterThan(0);
  });
});
