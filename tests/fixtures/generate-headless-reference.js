// tests/fixtures/generate-headless-reference.js
// Headless reference data generator script (run via Node.js directly)
// Run: node tests/fixtures/generate-headless-reference.js

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeHeadlessParams } from '../../js/core/headless-params.js';
import { runSimulationHeadless } from '../../js/headless.js';

// T1: HEADLESS_DEFAULTS-equivalent params + simPaths=1000
// Note: normalizeHeadlessParams clamps simPaths to [5000, 50000],
// so the actual simulation runs with 5000 paths.
const params = normalizeHeadlessParams({
    simPaths: 1000,
    seedNum: 123456,
    // All other parameters fallback to HEADLESS_DEFAULTS
});

const percentiles = [10, 30, 50, 70, 90];
const result = runSimulationHeadless(params, percentiles);

const ref = {
    _comment: 'v2.4.0 headless reference data. seed=123456, simPaths input=1000 → clamped to 5000 by normalizeHeadlessParams, HEADLESS_DEFAULTS equivalent',
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
    seed: result.usedSeed,
    modelType: result.modelType,
    usedDf: result.usedDf,
    currency: result.currency,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = join(__dirname, 'headless-reference-results.json');
writeFileSync(outPath, JSON.stringify(ref, null, 2), 'utf-8');
console.log('✅ 参照データを生成しました:', outPath);
console.log(JSON.stringify(ref, null, 2));
