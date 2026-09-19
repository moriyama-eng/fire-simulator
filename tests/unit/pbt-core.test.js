import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { multiSelectTrue } from '../../js/core/percentile.js';
import { formatPercentileInput, parsePercentiles } from '../../js/core/format.js';
import { normalizeHeadlessParams, normalizeHeadlessPercentiles } from '../../js/core/headless-params.js';
import { buildSimulationUrl, parseQueryParams } from '../../js/core/url.js';

describe('Property-Based Testing (PBT) Core Suite', () => {
  // Helper to compute percentiles using multiSelectTrue
  function calculatePercentiles(data, percentiles) {
    const sortedPcts = [...percentiles].sort((a, b) => a - b);
    const ks = new Int32Array(sortedPcts.length);
    for (let i = 0; i < sortedPcts.length; i++) {
      ks[i] = Math.floor((sortedPcts[i] / 100) * (data.length - 1));
    }
    const workBuffer = new Float64Array(data);
    const out = new Float64Array(sortedPcts.length);
    multiSelectTrue(workBuffer, ks, out);
    return Array.from(out);
  }

  it('PBT 1: calculatePercentiles produces monotonically non-decreasing percentiles', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 500 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 5 }),
        (data, percentiles) => {
          const sortedPcts = [...percentiles].sort((a, b) => a - b);
          const results = calculatePercentiles(data, sortedPcts);
          expect(results.length).toBe(sortedPcts.length);
          for (let i = 1; i < results.length; i++) {
            expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
          }
          const minVal = Math.min(...data);
          const maxVal = Math.max(...data);
          for (const val of results) {
            expect(val).toBeGreaterThanOrEqual(minVal);
            expect(val).toBeLessThanOrEqual(maxVal);
          }
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });

  it('PBT 2: formatPercentileInput and parsePercentiles roundtrip and idempotence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.integer({ min: -20, max: 150 }), fc.string({ maxLength: 10 })), { maxLength: 10 }),
        (items) => {
          const raw = items.join(', ');
          const formatted = formatPercentileInput(raw);
          const parsed = parsePercentiles(raw);

          // All parsed entries must be valid integers in [1, 99]
          for (const n of parsed) {
            expect(Number.isInteger(n)).toBe(true);
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(99);
          }

          // Must be strictly sorted ascending
          for (let i = 1; i < parsed.length; i++) {
            expect(parsed[i]).toBeGreaterThan(parsed[i - 1]);
          }

          // Length is between 1 and 5
          expect(parsed.length).toBeGreaterThanOrEqual(1);
          expect(parsed.length).toBeLessThanOrEqual(5);

          // Idempotence
          const formattedAgain = formatPercentileInput(formatted);
          expect(formattedAgain).toBe(formatted);
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });

  it('PBT 3: normalizeHeadlessParams bounds invariant and idempotence', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialRiskAsset: fc.float({ noNaN: true, noDefaultInfinity: true }),
          initialCashBuffer: fc.float({ noNaN: true, noDefaultInfinity: true }),
          monthlyExpense: fc.float({ noNaN: true, noDefaultInfinity: true }),
          expectedReturn: fc.float({ noNaN: true, noDefaultInfinity: true }),
          volatility: fc.float({ noNaN: true, noDefaultInfinity: true }),
          inflationRate: fc.float({ noNaN: true, noDefaultInfinity: true }),
          simYears: fc.integer({ min: -10, max: 100 }),
          simPaths: fc.integer({ min: -1000, max: 100000 }),
          drawdownTrigger: fc.float({ noNaN: true, noDefaultInfinity: true }),
          drawdownReplenish: fc.float({ noNaN: true, noDefaultInfinity: true }),
          replenishPace: fc.float({ noNaN: true, noDefaultInfinity: true }),
          guardrailTrigger: fc.float({ noNaN: true, noDefaultInfinity: true }),
          guardrailReduction: fc.float({ noNaN: true, noDefaultInfinity: true }),
          guardrailRelease: fc.float({ noNaN: true, noDefaultInfinity: true }),
          infVol: fc.float({ noNaN: true, noDefaultInfinity: true }),
          infAr: fc.float({ noNaN: true, noDefaultInfinity: true }),
          simDfNum: fc.float({ noNaN: true, noDefaultInfinity: true }),
          seedNum: fc.integer({ min: -500, max: 200000000 }),
          targetAssetRatio: fc.float({ noNaN: true, noDefaultInfinity: true }),
          currency: fc.string({ maxLength: 5 })
        }, { requiredKeys: [] }),
        (raw) => {
          const p = normalizeHeadlessParams(raw);

          expect(p.simPaths).toBeGreaterThanOrEqual(5000);
          expect(p.simPaths).toBeLessThanOrEqual(50000);
          expect(p.simYears).toBeGreaterThanOrEqual(1);
          expect(p.seedNum).toBeGreaterThanOrEqual(1);
          expect(p.seedNum).toBeLessThanOrEqual(99999999);
          expect(p.initialRiskAsset).toBeGreaterThanOrEqual(0);
          expect(p.initialCashBuffer).toBeGreaterThanOrEqual(0);
          expect(p.monthlyExpense).toBeGreaterThanOrEqual(0);
          expect(p.drawdownTrigger).toBeLessThanOrEqual(0);
          expect(p.drawdownReplenish).toBeLessThanOrEqual(0);
          expect(p.guardrailTrigger).toBeLessThanOrEqual(0);
          expect(p.guardrailReduction).toBeLessThanOrEqual(0);
          expect(p.guardrailRelease).toBeLessThanOrEqual(0);
          expect(p.replenishPace).toBeGreaterThanOrEqual(0);
          expect(p.infVol).toBeGreaterThanOrEqual(0);
          expect(p.infAr).toBeGreaterThanOrEqual(0);
          expect(p.infAr).toBeLessThanOrEqual(1.0);
          expect(p.simDfNum).toBeGreaterThanOrEqual(2.5);
          expect(p.targetAssetRatio).toBeGreaterThanOrEqual(0);
          expect(p.targetAssetRatio).toBeLessThanOrEqual(500);
          expect(['JPY', 'USD']).toContain(p.currency);

          // Idempotence
          const p2 = normalizeHeadlessParams(p);
          expect(p2).toEqual(p);
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });

  it('PBT 4: buildSimulationUrl and parseQueryParams serialization roundtrip', () => {
    fc.assert(
      fc.property(
        fc.record({
          initialRiskAsset: fc.integer({ min: 0, max: 1_000_000_000 }),
          initialCashBuffer: fc.integer({ min: 0, max: 100_000_000 }),
          monthlyExpense: fc.integer({ min: 0, max: 10_000_000 }),
          expectedReturn: fc.float({ min: -50, max: 50, noNaN: true }),
          volatility: fc.float({ min: 1, max: 100, noNaN: true }),
          inflationRate: fc.float({ min: -20, max: 50, noNaN: true }),
          simYears: fc.integer({ min: 1, max: 60 }),
          simPaths: fc.integer({ min: 1000, max: 50000 }),
          cashBufferToggle: fc.boolean(),
          guardrailToggle: fc.boolean(),
          drawdownTrigger: fc.float({ min: -50, max: 0, noNaN: true }),
          drawdownReplenish: fc.float({ min: -50, max: 0, noNaN: true }),
          replenishPace: fc.float({ min: 0, max: 20, noNaN: true }),
          guardrailTrigger: fc.float({ min: -50, max: 0, noNaN: true }),
          guardrailRelease: fc.float({ min: -50, max: 0, noNaN: true }),
          guardrailReduction: fc.float({ min: -50, max: 0, noNaN: true }),
          useArInflation: fc.boolean(),
          infVol: fc.float({ min: 0, max: 20, noNaN: true }),
          infAr: fc.float({ min: 0, max: 1, noNaN: true }),
          useTDistribution: fc.boolean(),
          simDfManual: fc.boolean(),
          simDfNum: fc.float({ min: 2.5, max: 30, noNaN: true }),
          seedNum: fc.integer({ min: 1, max: 99999999 }),
          targetAssetRatio: fc.float({ min: 0, max: 500, noNaN: true })
        }),
        (p) => {
          const url = buildSimulationUrl(p, { baseUrl: 'http://localhost/' });
          const parsed = parseQueryParams(url.search);

          expect(parsed.asset).toBe((p.initialRiskAsset / 100_000_000).toString());
          expect(parsed.years).toBe(p.simYears.toString());
          expect(parsed.paths).toBe(p.simPaths.toString());
          expect(parsed.seed).toBe(p.seedNum.toString());
          expect(parsed.cb).toBe(p.cashBufferToggle ? '1' : '0');
          expect(parsed.gr).toBe(p.guardrailToggle ? '1' : '0');
          expect(parsed.model).toBe(p.useTDistribution ? 'log-t' : 'log-normal');
          expect(parsed.dfAuto).toBe(p.simDfManual ? '0' : '1');
          expect(parsed.infModel).toBe(p.useArInflation ? '1' : '0');
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
