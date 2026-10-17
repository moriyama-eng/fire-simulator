// src/types/params.d.ts

export interface SimulationParams {
  initialRiskAsset: number;
  initialCashBuffer: number;
  monthlyExpense: number;
  expectedReturn: number;
  volatility: number;
  inflationRate: number;
  simYears: number;
  simPaths: number;
  cashBufferToggle: boolean;
  drawdownTrigger: number;
  drawdownReplenish: number;
  replenishPace: number;
  guardrailToggle: boolean;
  guardrailTrigger: number;
  guardrailReduction: number;
  guardrailRelease: number;
  useArInflation: boolean;
  infVol: number;
  infAr: number;
  useTDistribution: boolean;
  simDfManual: boolean;
  simDfNum: number;
  useFixedSeed?: boolean;
  seedNum: number;
  targetAssetRatio: number;
  currency?: string;
}

export interface HeadlessParams extends SimulationParams {
  currency?: 'JPY' | 'USD';
}

export interface RawInputs {
  initialRiskAssetNum?: string | number;
  initialCashBufferNum?: string | number;
  monthlyExpenseNum?: string | number;
  expectedReturnNum?: string | number;
  volatilityNum?: string | number;
  inflationRateNum?: string | number;
  simYearsNum?: string | number;
  simPathsNum?: string | number;
  cashBufferToggle?: boolean;
  drawdownTriggerNum?: string | number;
  drawdownReplenishNum?: string | number;
  replenishPaceNum?: string | number;
  guardrailToggle?: boolean;
  guardrailTriggerNum?: string | number;
  guardrailReductionNum?: string | number;
  guardrailReleaseNum?: string | number;
  inflationModelToggle?: boolean;
  infVolNum?: string | number;
  infArNum?: string | number;
  returnModelSelect?: string;
  simDfToggle?: boolean;
  simDfNum?: string | number;
  seedToggle?: boolean;
  seedNum?: string | number;
  targetAssetRatioNum?: string | number;
  [key: string]: unknown;
}

export interface FactorDefinition {
  key: string;
  labelKey: string;
  categoryKey: string;
  catClass: string;
  unitKey: string;
  step: number;
  decimals: number;
  scale: number;
  paramKey: string;
  requiresFeature?: 'cashBuffer' | 'guardrail';
}

export interface DefaultsConfig {
  readonly initialRiskAsset: number;
  readonly initialCashBuffer: number;
  readonly monthlyExpense: number;
  readonly expectedReturn: number;
  readonly volatility: number;
  readonly inflationRate: number;
  readonly simYears: number;
  readonly simPaths: number;
  readonly drawdownTrigger: number;
  readonly drawdownReplenish: number;
  readonly replenishPace: number;
  readonly guardrailTrigger: number;
  readonly guardrailReduction: number;
  readonly guardrailRelease: number;
  readonly infVol: number;
  readonly infAr: number;
  readonly simDfNum: number;
  readonly seedNum: number;
  readonly targetAssetRatio: number;
}
