// tests/fixtures/generate-belowinit-reference.js
// Generates reference-belowinit-results.json directly from the current TypeScript core modules.
// Run: node tests/fixtures/generate-belowinit-reference.js

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { DEFAULTS } = await server.ssrLoadModule('/src/core/params.ts');
  const { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } =
    await server.ssrLoadModule('/src/core/random.ts');
  const { runSinglePath } = await server.ssrLoadModule('/src/core/simulation.ts');

  const simPaths = 1000;
  const params = {
    initialRiskAsset: DEFAULTS.initialRiskAsset * 100_000_000,
    initialCashBuffer: DEFAULTS.initialCashBuffer * 10_000,
    monthlyExpense: DEFAULTS.monthlyExpense * 10_000,
    expectedReturn: DEFAULTS.expectedReturn,
    volatility: DEFAULTS.volatility,
    inflationRate: DEFAULTS.inflationRate,
    simYears: DEFAULTS.simYears,
    simPaths,
    cashBufferToggle: true,
    drawdownTrigger: DEFAULTS.drawdownTrigger,
    drawdownReplenish: DEFAULTS.drawdownReplenish,
    replenishPace: DEFAULTS.replenishPace,
    guardrailToggle: false,
    guardrailTrigger: DEFAULTS.guardrailTrigger,
    guardrailReduction: DEFAULTS.guardrailReduction,
    guardrailRelease: DEFAULTS.guardrailRelease,
    useArInflation: false,
    infVol: DEFAULTS.infVol,
    infAr: DEFAULTS.infAr,
    useTDistribution: true,
    simDfManual: false,
    simDfNum: DEFAULTS.simDfNum,
    useFixedSeed: true,
    seedNum: DEFAULTS.seedNum,
    targetAssetRatio: DEFAULTS.targetAssetRatio,
  };

  let belowInitMaxPeriods = 0;
  let consecutiveSellMaxPeriods = 0;

  for (let p = 0; p < simPaths; p++) {
    const rng = xoshiro128ss(params.seedNum + p);
    const normalGen = createNormalGenerator(rng);
    const gammaRand = createGammaGenerator(rng, normalGen);
    const tRand = createTGenerator(normalGen, gammaRand);
    const r = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
    if (r.maxBelowInitPeriod > belowInitMaxPeriods) belowInitMaxPeriods = r.maxBelowInitPeriod;
    if (r.maxConsecutiveSellPeriod > consecutiveSellMaxPeriods) {
      consecutiveSellMaxPeriods = r.maxConsecutiveSellPeriod;
    }
  }

  const ref = {
    _comment: 'v2.3.0 reference data (for new metrics). seed=123456, paths=1000, other default values',
    belowInitMaxPeriods,
    consecutiveSellMaxPeriods,
  };

  const outPath = join(__dirname, 'reference-belowinit-results.json');
  writeFileSync(outPath, JSON.stringify(ref, null, 2) + '\n', 'utf-8');
  console.log('Reference data generated:', outPath);
} finally {
  await server.close();
}
