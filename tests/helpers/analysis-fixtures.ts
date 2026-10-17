// tests/helpers/analysis-fixtures.ts
import type { AggregatedMetrics } from '../../src/types/simulation.js';

export interface BaseMetrics {
  success_rate_pct: number;
  final_median_jpy: number;
  final_p10_jpy: number;
  worst10_max_dd: number;
  target_asset_maintain_rate: number;
  [key: string]: unknown;
}

export interface ScenarioPoint {
  level: number;
  metrics: BaseMetrics;
}

export interface AnalysisResultFixture {
  baseScenario: { metrics: BaseMetrics };
  perFactorResults: Record<string, ScenarioPoint[]>;
}

export interface BaseEffectiveParams {
  initialRiskAsset: number;
  initialCashBuffer: number;
  monthlyExpense: number;
  expectedReturn: number;
  volatility: number;
  inflationRate: number;
  simYears: number;
  simPaths: number;
  seed: number;
  modelType: string;
  dfMode: string;
  simDfNum: number;
  simDfManual: boolean;
  usedDf: number;
  inflationMode: string;
  infVol: number;
  infAr: number;
  cashBufferToggle: boolean;
  drawdownTrigger: number;
  drawdownReplenish: number;
  replenishPace: number;
  guardrailToggle: boolean;
  guardrailTrigger: number;
  guardrailRelease: number;
  guardrailReduction: number;
  useArInflation: boolean;
  percentiles: number[] | null;
  targetAssetRatio: number;
  [key: string]: unknown;
}

/**
 * Generate base metrics (results of the base scenario).
 * final_p10_jpy is the final 10% percentile asset value (arbitrary value for test data).
 */
export function makeBaseMetrics(overrides: Partial<BaseMetrics> = {}): BaseMetrics {
  return {
    success_rate_pct: 93.23,
    final_median_jpy: 538074816,
    final_p10_jpy: 39342408,
    worst10_max_dd: -0.8054955005645752,
    target_asset_maintain_rate: 93.23,
    ...overrides
  };
}

/**
 * Generate a scenario point (result of a single level)
 */
export function makeScenarioPoint(level: number, metricsOverrides: Partial<BaseMetrics> = {}): ScenarioPoint {
  return { level, metrics: makeBaseMetrics(metricsOverrides) };
}

/**
 * Generate the entire analysis result object
 */
export function makeAnalysisResult(perFactorResults: Record<string, ScenarioPoint[]> = {}): AnalysisResultFixture {
  return {
    baseScenario: { metrics: makeBaseMetrics() },
    perFactorResults
  };
}

export interface DummySimResultOverrides {
  simYears?: number;
  finalMedian?: number;
  finalP10?: number;
  successRate?: number;
  worst10MaxDd?: number;
  worst5MaxDd?: number;
  medianMaxUw?: number;
  worst10MaxUw?: number;
  belowInitPeriods?: Float32Array;
  consecutiveSellPeriods?: Float32Array;
  usedSeed?: number;
  modelType?: string;
  usedDf?: number;
  targetAssetMaintainRate?: number;
  targetAssetRatio?: number;
  [key: string]: unknown;
}

/**
 * Generate a dummy simulation result (runSimulation return type).
 */
export function makeDummySimResult(overrides: DummySimResultOverrides = {}): AggregatedMetrics {
  const pcts = [10, 30, 50, 70, 90];
  const simYears = overrides.simYears ?? 30;
  const dataLen = simYears * 12 + 1;
  const finalMedian = overrides.finalMedian ?? 538074816;
  const finalP10 = overrides.finalP10 ?? 39342408;

  const buildPercentileData = (): Float32Array[] => {
    return pcts.map((pct) => {
      const arr = new Float32Array(dataLen).fill(100_000_000);
      if (pct === 10) arr[dataLen - 1] = finalP10;
      else if (pct === 50) arr[dataLen - 1] = finalMedian;
      else arr[dataLen - 1] = Math.round(finalMedian * (pct / 50));
      return arr;
    });
  };

  const totalPD = buildPercentileData();
  const cashPD = buildPercentileData();
  const ddPD = buildPercentileData();

  return {
    percentiles: pcts,
    totalPercentileData: totalPD,
    cashPercentileData: cashPD,
    ddPercentileData: ddPD,
    successRate: overrides.successRate ?? 93.23,
    finalMedian,
    worst10MaxDd: overrides.worst10MaxDd ?? -0.8054955005645752,
    worst5MaxDd: overrides.worst5MaxDd ?? -1,
    medianMaxUw: overrides.medianMaxUw ?? 102,
    worst10MaxUw: overrides.worst10MaxUw ?? 310,
    maxDdPerPath: new Float32Array(1000),
    maxUwPerPath: new Float32Array(1000),
    belowInitPeriods: overrides.belowInitPeriods ?? new Float32Array(1000),
    consecutiveSellPeriods: overrides.consecutiveSellPeriods ?? new Float32Array(1000),
    dataLen,
    usedSeed: overrides.usedSeed ?? 123456,
    modelType: overrides.modelType ?? 'log-t',
    usedDf: overrides.usedDf ?? 4.2,
    params: { simPaths: 1000, totalMonths: dataLen - 1 },
    targetAssetMaintainRate: overrides.targetAssetMaintainRate ?? 93.23,
    targetAssetRatio: overrides.targetAssetRatio ?? 1.0,
  };
}

/**
 * Mock of the base effective parameters.
 */
export function makeBaseEffectiveParams(overrides: Partial<BaseEffectiveParams> = {}): BaseEffectiveParams {
  return {
    initialRiskAsset: 100_000_000,
    initialCashBuffer: 10_000_000,
    monthlyExpense: 300_000,
    expectedReturn: 10.0,
    volatility: 18.0,
    inflationRate: 2.0,
    simYears: 30,
    simPaths: 10000,
    seed: 123456,
    modelType: 'log-t',
    dfMode: 'auto',
    simDfNum: 4.0,
    simDfManual: false,
    usedDf: 4.2,
    inflationMode: 'fixed',
    infVol: 2.0,
    infAr: 0.5,
    cashBufferToggle: true,
    drawdownTrigger: -20.0,
    drawdownReplenish: -5.0,
    replenishPace: 5.0,
    guardrailToggle: false,
    guardrailTrigger: -20.0,
    guardrailRelease: -15.0,
    guardrailReduction: -20.0,
    useArInflation: false,
    percentiles: null,
    targetAssetRatio: overrides.targetAssetRatio ?? 1.0,
    ...overrides
  };
}
