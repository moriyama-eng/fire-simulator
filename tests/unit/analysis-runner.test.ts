// tests/unit/analysis-runner.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runSimulation } from '../../src/simulation-engine.js';
import * as AS from '../../src/analysis-state.js';
import { runAnalysis, applyFactorChange, convertToLegacyParams } from '../../src/analysis-runner.js';
import { FACTORS } from '../../src/analysis-state.js';
import { makeDummySimResult, makeBaseEffectiveParams } from '../helpers/analysis-fixtures.js';
import type { FactorDefinition } from '../../src/types/params.js';

vi.mock('../../src/simulation-engine.js');
vi.mock('../../src/analysis-state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/analysis-state.js')>();
  const { FACTORS: originalFactors } = actual;
  const getStateMock = vi.fn();
  return {
    ...actual,
    getState: getStateMock,
    getSelectedFactors: vi.fn(() => []),
    getFactorBaseValue: vi.fn((key: string) => {
      const bp = getStateMock().baseEffectiveParams;
      if (!bp) return null;
      const factor = originalFactors.find((f: FactorDefinition) => f.key === key);
      if (!factor) return null;
      const raw = bp[factor.paramKey];
      if (raw == null) return null;
      return raw / (factor.scale || 1);
    }),
  };
});

const asMock = AS as unknown as {
  getState: ReturnType<typeof vi.fn>;
  getSelectedFactors: ReturnType<typeof vi.fn>;
  getFactorBaseValue: ReturnType<typeof vi.fn>;
};
const runSimulationMock = runSimulation as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  runSimulationMock.mockResolvedValue(makeDummySimResult());
  asMock.getState.mockReturnValue({
    baseEffectiveParams: makeBaseEffectiveParams(),
    selectedFactors: [],
    isRunning: false,
  });
});

describe('runAnalysis', () => {
  it('base scenario params include useFixedSeed and seedNum', async () => {
    asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    await runAnalysis(vi.fn());
    const firstCallArgs = runSimulationMock.mock.calls[0][0];
    expect(firstCallArgs.useFixedSeed).toBe(true);
    expect(firstCallArgs.seedNum).toBe(123456);
  });

  it('calls progress callback with correct counts', async () => {
    const onProgress = vi.fn();
    asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    await runAnalysis(onProgress);
    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress.mock.calls[0][0]).toEqual({ done: 0, total: 5 });
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.done).toBe(5);
  });

  it('rejects on error', async () => {
    try {
      runSimulationMock.mockRejectedValue(new Error('test error'));
      asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
      await expect(runAnalysis(vi.fn())).rejects.toThrow('test error');
    } finally {
      runSimulationMock.mockResolvedValue(makeDummySimResult());
    }
  });

  it('returns correct structure', async () => {
    asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    const result = await runAnalysis(vi.fn());
    expect(result).toHaveProperty('baseScenario');
    expect(result).toHaveProperty('perFactorResults');
    expect(Array.isArray(result.perFactorResults.expected_return_pct)).toBe(true);
    expect(result.perFactorResults.expected_return_pct.length).toBe(4);
  });
});

describe('convertToLegacyParams', () => {
  it('maps basic fields correctly', () => {
    const ep = makeBaseEffectiveParams({ initialRiskAsset: 100_000_000, expectedReturn: 10.0 });
    const result = convertToLegacyParams(ep);
    expect(result.initialRiskAsset).toBe(100_000_000);
    expect(result.expectedReturn).toBe(10.0);
    expect(result.useFixedSeed).toBe(true);
  });

  it('maps targetAssetRatio correctly', () => {
    const ep = makeBaseEffectiveParams({ targetAssetRatio: 120 });
    const result = convertToLegacyParams(ep);
    expect(result.targetAssetRatio).toBe(120);
  });

  it('returns 0 for initialCashBuffer when CB is OFF', () => {
    const epNull = makeBaseEffectiveParams({ cashBufferToggle: false, initialCashBuffer: 0 });
    expect(convertToLegacyParams(epNull).initialCashBuffer).toBe(0);
    const epUndef = makeBaseEffectiveParams({ cashBufferToggle: false });
    delete (epUndef as Record<string, unknown>).initialCashBuffer;
    expect(convertToLegacyParams(epUndef).initialCashBuffer).toBe(0);
  });

  it('sets useTDistribution true for log-t', () => {
    expect(convertToLegacyParams(makeBaseEffectiveParams({ modelType: 'log-t' })).useTDistribution).toBe(true);
  });

  it('sets useTDistribution false for log-normal', () => {
    expect(convertToLegacyParams(makeBaseEffectiveParams({ modelType: 'log-normal' })).useTDistribution).toBe(false);
  });

  it.each([
    [500, 5000],
    [100000, 50000],
    [5000, 5000],
    [50000, 50000],
  ])('clamps or passes simPaths %s -> %s', (input, expected) => {
    const ep = makeBaseEffectiveParams({ simPaths: input });
    expect(convertToLegacyParams(ep).simPaths).toBe(expected);
  });
});

describe('applyFactorChange', () => {
  it('converts scale 1e8 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'initial_risk_asset_jpy')!;
    const ep = makeBaseEffectiveParams({ initialRiskAsset: 100_000_000 });
    applyFactorChange(ep, factor, 1.2);
    expect(ep.initialRiskAsset).toBe(120_000_000);
  });

  it('converts scale 1 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'expected_return_pct')!;
    const ep = makeBaseEffectiveParams({ expectedReturn: 10.0 });
    applyFactorChange(ep, factor, 11.0);
    expect(ep.expectedReturn).toBe(11.0);
  });

  it('converts scale 1e4 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'initial_cash_buffer_jpy')!;
    const ep = makeBaseEffectiveParams({ initialCashBuffer: 10_000_000 });
    applyFactorChange(ep, factor, 1500);
    expect(ep.initialCashBuffer).toBe(15_000_000);
  });
});

// ===== Tests for target_asset_maintain_rate =====
describe('extractMetrics - target_asset_maintain_rate', () => {
  beforeEach(() => {
    runSimulationMock.mockReset();
    runSimulationMock.mockResolvedValue(makeDummySimResult({ targetAssetMaintainRate: 88.5 }));
  });

  it('includes target_asset_maintain_rate in extracted metrics', async () => {
    asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    const result = await runAnalysis(vi.fn());
    
    expect(result.baseScenario.metrics).toHaveProperty('target_asset_maintain_rate');
    expect(result.baseScenario.metrics.target_asset_maintain_rate).toBe(88.5);
    
    const factorResults = result.perFactorResults.expected_return_pct;
    expect(factorResults[0]?.metrics).toHaveProperty('target_asset_maintain_rate');
  });
});

describe('runAnalysis guard errors and level params', () => {
  it('rejects with error.noBase when baseEffectiveParams is missing', async () => {
    asMock.getState.mockReturnValue({
      baseEffectiveParams: null,
      selectedFactors: ['expected_return_pct'],
      isRunning: false,
    });
    await expect(runAnalysis(vi.fn())).rejects.toThrow('error.noBase');
  });

  it('rejects with error.noFactors when no factors are selected', async () => {
    asMock.getSelectedFactors.mockReturnValue([]);
    await expect(runAnalysis(vi.fn())).rejects.toThrow('error.noFactors');
  });

  it('passes applyFactorChange params per level to runSimulation', async () => {
    const baseReturn = 10.0;
    asMock.getState.mockReturnValue({
      baseEffectiveParams: makeBaseEffectiveParams({ expectedReturn: baseReturn }),
      selectedFactors: ['expected_return_pct'],
      isRunning: false,
    });
    asMock.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    asMock.getFactorBaseValue.mockReturnValue(baseReturn);
    await runAnalysis(vi.fn());
    const factor = FACTORS.find(f => f.key === 'expected_return_pct')!;
    const expectedByLevel = [-2, -1, 1, 2].map(level => baseReturn + factor.step * level);
    expect(runSimulationMock.mock.calls[0][0].expectedReturn).toBe(baseReturn);
    const levelReturns = runSimulationMock.mock.calls.slice(1).map(c => c[0].expectedReturn);
    expect(levelReturns).toEqual(expectedByLevel);
  });

  it('handles runAnalysis without onProgress, missing factors, and null factor base values', async () => {
    asMock.getSelectedFactors.mockReturnValue(['unknown_factor', 'expected_return_pct', 'missing_base_value']);
    asMock.getFactorBaseValue.mockImplementation((k: string) => k === 'missing_base_value' ? null : 10.0);
    const result = await runAnalysis();
    expect(result.baseScenario).toBeDefined();
    expect(result.perFactorResults['expected_return_pct']).toBeDefined();
  });

  it('maps optional fields with defaults in convertToLegacyParams', () => {
    const epWithUndefined = makeBaseEffectiveParams({
      cashBufferToggle: true,
      initialCashBuffer: 50_000,
      drawdownTrigger: undefined,
      drawdownReplenish: undefined,
      replenishPace: undefined,
      guardrailToggle: true,
      guardrailTrigger: undefined,
      guardrailReduction: undefined,
      guardrailRelease: undefined,
      useArInflation: true,
      infVol: undefined,
      infAr: undefined,
      simDfManual: true,
      simDfNum: undefined,
    });
    const result = convertToLegacyParams(epWithUndefined);
    expect(result.initialCashBuffer).toBe(50_000);
    expect(result.drawdownTrigger).toBe(0);
    expect(result.drawdownReplenish).toBe(0);
    expect(result.replenishPace).toBe(0);
    expect(result.guardrailTrigger).toBe(0);
    expect(result.guardrailReduction).toBe(0);
    expect(result.guardrailRelease).toBe(0);
    expect(result.infVol).toBe(2.0);
    expect(result.infAr).toBe(0.5);
    expect(result.simDfNum).toBe(4.0);
  });
});
