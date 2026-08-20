// tests/unit/analysis-runner.test.js
// [Vitest 1.6 compatibility] vi.mocked() is prohibited; access mockFn properties directly
// [MOST IMPORTANT] Do not reference import bindings inside vi.mock factory
//   FACTORS must come from importOriginal(), and getState via a local spy

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runSimulation } from '../../js/simulation-engine.js';
import * as AS from '../../js/analysis-state.js';
import { runAnalysis, applyFactorChange, convertToLegacyParams } from '../../js/analysis-runner.js';
// Continue importing the actual FACTORS for use in applyFactorChange tests
import { FACTORS } from '../../js/analysis-state.js';
import { makeDummySimResult, makeBaseEffectiveParams } from '../helpers/analysis-fixtures.js';

vi.mock('../../js/simulation-engine.js');
vi.mock('../../js/analysis-state.js', async (importOriginal) => {
  const actual = await importOriginal();
  // Obtain FACTORS used in the factory from importOriginal() (import bindings are undefined)
  const { FACTORS: originalFactors } = actual;
  // Define the spy for getState as a local variable
  const getStateMock = vi.fn();
  return {
    ...actual,
    getState: getStateMock,
    getSelectedFactors: vi.fn(() => []),
    // Mock for getFactorBaseValue: get baseEffectiveParams via getStateMock.
    // Since getStateMock() is evaluated each time a test runs, it can handle dynamic state.
    getFactorBaseValue: vi.fn((key) => {
      const bp = getStateMock().baseEffectiveParams;
      if (!bp) return null;
      const factor = originalFactors.find(f => f.key === key);
      if (!factor) return null;
      const raw = bp[factor.paramKey];
      if (raw == null) return null;
      return raw / (factor.scale || 1);
    }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  // Explicitly re-set the default implementation because reset removes it
  runSimulation.mockResolvedValue(makeDummySimResult());
  AS.getState.mockReturnValue({
    baseEffectiveParams: makeBaseEffectiveParams(),
    selectedFactors: [],
    isRunning: false,
  });
});

describe('runAnalysis', () => {
  it('base scenario params include useFixedSeed and seedNum', async () => {
    // Note: convertToLegacyParams hardcodes useFixedSeed: true.
    // Currently always true in the implementation, but tests must be extended if it becomes variable in the future.
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    await runAnalysis(vi.fn());
    const firstCallArgs = runSimulation.mock.calls[0][0];
    expect(firstCallArgs.useFixedSeed).toBe(true);
    expect(firstCallArgs.seedNum).toBe(123456);
  });

  it('calls progress callback with correct counts', async () => {
    const onProgress = vi.fn();
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    await runAnalysis(onProgress);
    // 1st call: onProgress({done:0, total:5}) (before runSimulation is called)
    // 2nd-5th calls: after each level's runSimulation completes
    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress.mock.calls[0][0]).toEqual({ done: 0, total: 5 });
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.done).toBe(5);
  });

  it('rejects on error', async () => {
    try {
      runSimulation.mockRejectedValue(new Error('test error'));
      AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
      await expect(runAnalysis(vi.fn())).rejects.toThrow('test error');
    } finally {
      // Always restore the default implementation even if the test fails midway
      runSimulation.mockResolvedValue(makeDummySimResult());
    }
  });

  it('returns correct structure', async () => {
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
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
    const epNull = makeBaseEffectiveParams({ cashBufferToggle: false, initialCashBuffer: null });
    expect(convertToLegacyParams(epNull).initialCashBuffer).toBe(0);
    const epUndef = makeBaseEffectiveParams({ cashBufferToggle: false });
    delete epUndef.initialCashBuffer;
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
  // Pass a complete effective parameter object as in the actual code to test destructive changes
  // Note: these tests depend on the actual scale and step of FACTORS.
  // If the factor definition changes, the expected values must be reviewed.
  it('converts scale 1e8 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'initial_risk_asset_jpy');
    const ep = makeBaseEffectiveParams({ initialRiskAsset: 100_000_000 });
    applyFactorChange(ep, factor, 1.2);
    expect(ep.initialRiskAsset).toBe(120_000_000);
  });

  it('converts scale 1 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'expected_return_pct');
    const ep = makeBaseEffectiveParams({ expectedReturn: 10.0 });
    applyFactorChange(ep, factor, 11.0);
    expect(ep.expectedReturn).toBe(11.0);
  });

  it('converts scale 1e4 factor correctly', () => {
    const factor = FACTORS.find(f => f.key === 'initial_cash_buffer_jpy');
    const ep = makeBaseEffectiveParams({ initialCashBuffer: 10_000_000 });
    applyFactorChange(ep, factor, 1500);
    expect(ep.initialCashBuffer).toBe(15_000_000);
  });
});

// ===== Tests for target_asset_maintain_rate =====
describe('extractMetrics - target_asset_maintain_rate', () => {
  beforeEach(() => {
    // Reset existing mock setup before re-configuring
    runSimulation.mockReset();
    runSimulation.mockResolvedValue(makeDummySimResult({ targetAssetMaintainRate: 88.5 }));
  });

  it('includes target_asset_maintain_rate in extracted metrics', async () => {
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    const result = await runAnalysis(vi.fn());
    
    // baseScenario metrics include target_asset_maintain_rate
    expect(result.baseScenario.metrics).toHaveProperty('target_asset_maintain_rate');
    expect(result.baseScenario.metrics.target_asset_maintain_rate).toBe(88.5);
    
    // Also included in factor scenarios
    const factorResults = result.perFactorResults.expected_return_pct;
    expect(factorResults[0].metrics).toHaveProperty('target_asset_maintain_rate');
  });
});

describe('runAnalysis guard errors and level params', () => {
  it('rejects with error.noBase when baseEffectiveParams is missing', async () => {
    AS.getState.mockReturnValue({
      baseEffectiveParams: null,
      selectedFactors: ['expected_return_pct'],
      isRunning: false,
    });
    await expect(runAnalysis(vi.fn())).rejects.toThrow('error.noBase');
  });

  it('rejects with error.noFactors when no factors are selected', async () => {
    AS.getSelectedFactors.mockReturnValue([]);
    await expect(runAnalysis(vi.fn())).rejects.toThrow('error.noFactors');
  });

  it('passes applyFactorChange params per level to runSimulation', async () => {
    const baseReturn = 10.0;
    AS.getState.mockReturnValue({
      baseEffectiveParams: makeBaseEffectiveParams({ expectedReturn: baseReturn }),
      selectedFactors: ['expected_return_pct'],
      isRunning: false,
    });
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    AS.getFactorBaseValue.mockReturnValue(baseReturn);
    await runAnalysis(vi.fn());
    const factor = FACTORS.find(f => f.key === 'expected_return_pct');
    const expectedByLevel = [-2, -1, 1, 2].map(level => baseReturn + factor.step * level);
    expect(runSimulation.mock.calls[0][0].expectedReturn).toBe(baseReturn);
    const levelReturns = runSimulation.mock.calls.slice(1).map(c => c[0].expectedReturn);
    expect(levelReturns).toEqual(expectedByLevel);
  });
});
