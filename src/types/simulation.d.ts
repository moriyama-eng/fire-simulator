// src/types/simulation.d.ts
import type { SimulationParams } from './params.js';

export interface RngGenerators {
  rng?: () => number;
  normalGen: () => number;
  gammaRand?: (alpha: number) => number;
  tRand?: (df: number) => number;
}

export interface MonthEndState {
  isGuardrailActive: boolean;
  currentUwMonths: number;
  maxUwMonths: number;
  maxDD: number;
  isReplenishMode: boolean;
}

export interface MonthEndConfig {
  cashBufferToggle: boolean;
  ddThreshold: number;
  ddReplenishThreshold: number;
  guardrailToggle: boolean;
  triggerGR: number;
  releaseGR: number;
}

export interface MonthEndEvaluationResult {
  useCashNextMonth: boolean;
  isGuardrailActive: boolean;
  isReplenishMode: boolean;
  currentUwMonths: number;
  maxUwMonths: number;
  maxDD: number;
  highWaterMark: number;
}

export interface SinglePathResult {
  totals: Float32Array;
  cashes: Float32Array;
  dds: Float32Array;
  maxDD: number;
  maxUW: number;
  maxBelowInitPeriod: number;
  maxConsecutiveSellPeriod: number;
  bankrupt: boolean;
}

export interface BatchResult {
  totals: Float32Array;
  cashes: Float32Array;
  dds: Float32Array;
  maxDds: Float32Array;
  maxUws: Float32Array;
  belowInitPeriods: Float32Array;
  consecutiveSellPeriods: Float32Array;
  bankruptCount: number;
}

export interface AggregatedMetrics {
  percentiles: number[];
  totalPercentileData: Float32Array[];
  cashPercentileData: Float32Array[];
  ddPercentileData: Float32Array[];
  successRate: number;
  finalMedian: number;
  worst10MaxDd: number;
  worst5MaxDd: number;
  medianMaxUw: number;
  worst10MaxUw: number;
  maxDdPerPath: Float32Array;
  maxUwPerPath: Float32Array;
  belowInitPeriods: Float32Array;
  consecutiveSellPeriods: Float32Array;
  params: { simPaths: number; totalMonths: number };
  dataLen: number;
  targetAssetMaintainRate: number;
  targetAssetRatio: number;
  usedSeed?: number;
  modelType?: string;
  usedDf?: number;
  runTimeMs?: number;
  currency?: string;
}

export interface AggregateProductionOptions {
  totalsBuffer: ArrayBufferLike;
  cashesBuffer: ArrayBufferLike;
  ddsBuffer: ArrayBufferLike;
  maxDdPerPath: Float32Array | ArrayLike<number>;
  maxUwPerPath: Float32Array | ArrayLike<number>;
  belowInitPeriods?: Float32Array | ArrayLike<number>;
  consecutiveSellPeriods?: Float32Array | ArrayLike<number>;
  simPaths: number;
  dataLen: number;
  percentiles: number[];
  bankruptCount: number;
  targetAssetRatio: number;
  initialTotalAssets: number;
}
