// tests/fixtures/generate-reference.js
// Generates reference-results.json directly from the current TypeScript core modules.
// Run: node tests/fixtures/generate-reference.js

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
  const { DEFAULTS, calcAutoDf } = await server.ssrLoadModule('/src/core/params.ts');
  const { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } =
    await server.ssrLoadModule('/src/core/random.ts');
  const { runSinglePath } = await server.ssrLoadModule('/src/core/simulation.ts');
  const { aggregateResultsProduction } = await server.ssrLoadModule('/src/core/aggregation.ts');

  const simPaths = 1000;
  const simYears = DEFAULTS.simYears;
  const dataLen = simYears * 12 + 1;
  const params = {
    initialRiskAsset: DEFAULTS.initialRiskAsset * 100_000_000,
    initialCashBuffer: DEFAULTS.initialCashBuffer * 10_000,
    monthlyExpense: DEFAULTS.monthlyExpense * 10_000,
    expectedReturn: DEFAULTS.expectedReturn,
    volatility: DEFAULTS.volatility,
    inflationRate: DEFAULTS.inflationRate,
    simYears,
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

  const totals = new Float32Array(simPaths * dataLen);
  const cashes = new Float32Array(simPaths * dataLen);
  const dds = new Float32Array(simPaths * dataLen);
  const maxDds = new Float32Array(simPaths);
  const maxUws = new Float32Array(simPaths);
  const belowInitPeriods = new Float32Array(simPaths);
  const consecutiveSellPeriods = new Float32Array(simPaths);
  let bankruptCount = 0;

  for (let p = 0; p < simPaths; p++) {
    const rng = xoshiro128ss(params.seedNum + p);
    const normalGen = createNormalGenerator(rng);
    const gammaRand = createGammaGenerator(rng, normalGen);
    const tRand = createTGenerator(normalGen, gammaRand);
    const r = runSinglePath({ rng, normalGen, gammaRand, tRand }, params);
    const base = p * dataLen;
    totals.set(r.totals, base);
    cashes.set(r.cashes, base);
    dds.set(r.dds, base);
    maxDds[p] = r.maxDD;
    maxUws[p] = r.maxUW;
    belowInitPeriods[p] = r.maxBelowInitPeriod;
    consecutiveSellPeriods[p] = r.maxConsecutiveSellPeriod;
    if (r.bankrupt) bankruptCount++;
  }

  const percentiles = [10, 30, 50, 70, 90];
  const result = aggregateResultsProduction({
    totalsBuffer: totals.buffer,
    cashesBuffer: cashes.buffer,
    ddsBuffer: dds.buffer,
    maxDdPerPath: maxDds,
    maxUwPerPath: maxUws,
    belowInitPeriods,
    consecutiveSellPeriods,
    simPaths,
    dataLen,
    percentiles,
    bankruptCount,
    targetAssetRatio: params.targetAssetRatio,
    initialTotalAssets: params.initialRiskAsset + params.initialCashBuffer,
  });

  const ref = {
    _comment: 'v1.8.3 reference data. seed=123456, paths=1000, other default values',
    successRate: result.successRate,
    finalMedian: result.finalMedian,
    worst10MaxDd: result.worst10MaxDd,
    worst5MaxDd: result.worst5MaxDd,
    medianMaxUw: result.medianMaxUw,
    worst10MaxUw: result.worst10MaxUw,
    percentileFinalValues: percentiles.reduce((acc, pct, i) => {
      const lastIdx = result.totalPercentileData[i].length - 1;
      acc[String(pct)] = result.totalPercentileData[i][lastIdx];
      return acc;
    }, {}),
    seed: params.seedNum,
    modelType: 'log-t',
    usedDf: Math.max(2.5, calcAutoDf(params.volatility)),
  };

  const outPath = join(__dirname, 'reference-results.json');
  writeFileSync(outPath, JSON.stringify(ref, null, 2) + '\n', 'utf-8');
  console.log('Reference data generated:', outPath);
} finally {
  await server.close();
}
