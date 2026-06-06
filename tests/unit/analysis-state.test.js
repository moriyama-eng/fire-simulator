// tests/unit/analysis-state.test.js
// 【Vitest 1.6 互換性】vi.mocked() は使用禁止、mockFn のプロパティに直接アクセスすること

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FACTORS,
  getAvailableFactors,
  getState,
  setBaseContext,
  setSelectedFactors,
  setAnalysisResult,
  setRunning,
  setErrorMessage,
  getFactorBaseValue,
  getGeneratedValues,
  getScenarioCount,
  _resetStateForTest,
} from '../../js/analysis-state.js';
import { makeAnalysisResult, makeBaseEffectiveParams } from '../helpers/analysis-fixtures.js';

beforeEach(() => {
  _resetStateForTest();
});

describe('FACTORS definition', () => {
  it('has 10 factors', () => {
    expect(FACTORS.length).toBe(10);
  });

  it('each factor has required properties', () => {
    for (const f of FACTORS) {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('labelKey');
      expect(f).toHaveProperty('categoryKey');
      expect(f).toHaveProperty('catClass');
      expect(f).toHaveProperty('unitKey');
      expect(f).toHaveProperty('step');
      expect(f).toHaveProperty('decimals');
      expect(f).toHaveProperty('scale');
      expect(f).toHaveProperty('paramKey');
      if (f.requiresFeature) {
        expect(typeof f.requiresFeature).toBe('string');
      }
    }
  });
});

describe('getAvailableFactors', () => {
  it('returns all 10 factors when CB and GR are ON', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    expect(getAvailableFactors().length).toBe(10);
  });

  it('excludes cash buffer factors when CB is OFF', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: false }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).not.toContain('drawdown_trigger_pct');
    expect(keys).not.toContain('replenish_pace_x_expense');
  });

  it('excludes guardrail factors when GR is OFF', () => {
    setBaseContext({}, makeBaseEffectiveParams({ guardrailToggle: false }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).not.toContain('guardrail_trigger_pct');
    expect(keys).not.toContain('guardrail_reduction_pct');
  });

  it('includes guardrail factors when GR is ON', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).toContain('guardrail_trigger_pct');
    expect(keys).toContain('guardrail_reduction_pct');
  });

  it('returns empty array when base not set', () => {
    expect(getAvailableFactors()).toEqual([]);
  });
});

describe('setBaseContext', () => {
  it('sets base params correctly', () => {
    const ep = makeBaseEffectiveParams();
    setBaseContext({ source: 'test' }, ep);
    expect(getState().baseEffectiveParams).toEqual(ep);
    expect(getState().baseContext.source).toBe('test');
  });

  it('removes unavailable factors and clears results on condition change', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true }));
    setSelectedFactors(['drawdown_trigger_pct']);
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: false }));
    expect(getState().selectedFactors).toEqual([]);
    expect(getState().analysisResult).toBeNull();
  });

  it('keeps selected factors and results when same condition is set again', () => {
    const ep = makeBaseEffectiveParams();
    setBaseContext({}, ep);
    const mockResult = makeAnalysisResult();
    setSelectedFactors(['expected_return_pct']);
    setAnalysisResult(mockResult);
    setBaseContext({}, { ...ep });
    expect(getState().selectedFactors).toEqual(['expected_return_pct']);
    expect(getState().analysisResult).toEqual(mockResult);
  });
});

describe('setSelectedFactors', () => {
  it('sets selected factors and clears results', () => {
    setAnalysisResult(makeAnalysisResult());
    setSelectedFactors(['volatility_pct']);
    expect(getState().selectedFactors).toEqual(['volatility_pct']);
    expect(getState().analysisResult).toBeNull();
  });
});

describe('setRunning', () => {
  it('sets running flag', () => {
    setRunning(true);
    expect(getState().isRunning).toBe(true);
    setRunning(false);
    expect(getState().isRunning).toBe(false);
  });

  it('clears error message when running ends', () => {
    setErrorMessage('some error');
    setRunning(false);
    expect(getState().errorMessage).toBeNull();
  });
});

describe('setAnalysisResult', () => {
  it('sets analysis result and clears running flag', () => {
    const result = makeAnalysisResult();
    setAnalysisResult(result);
    expect(getState().analysisResult).toEqual(result);
    expect(getState().isRunning).toBe(false);
  });
});

describe('setErrorMessage', () => {
  it('sets error message and clears running flag', () => {
    setErrorMessage('test error');
    expect(getState().errorMessage).toBe('test error');
    expect(getState().isRunning).toBe(false);
  });
});

describe('getFactorBaseValue', () => {
  it('returns base value in UI units for scaled factor', () => {
    setBaseContext({}, makeBaseEffectiveParams({ initialRiskAsset: 200_000_000 }));
    expect(getFactorBaseValue('initial_risk_asset_jpy')).toBe(2.0);
  });

  it('returns scale-1 factor as-is', () => {
    setBaseContext({}, makeBaseEffectiveParams({ expectedReturn: 10.0 }));
    expect(getFactorBaseValue('expected_return_pct')).toBe(10.0);
  });

  it('returns null when base not set', () => {
    expect(getFactorBaseValue('expected_return_pct')).toBeNull();
  });

  it('returns null for undefined factor key', () => {
    setBaseContext({}, makeBaseEffectiveParams());
    expect(getFactorBaseValue('non_existent_key')).toBeNull();
  });

  it('returns null for valid key but unset param', () => {
    const ep = makeBaseEffectiveParams();
    delete ep.expectedReturn;
    setBaseContext({}, ep);
    expect(getFactorBaseValue('expected_return_pct')).toBeNull();
  });
});

describe('getGeneratedValues', () => {
  it('generates 5 levels from base value with step', () => {
    setBaseContext({}, makeBaseEffectiveParams({ expectedReturn: 10.0 }));
    expect(getGeneratedValues('expected_return_pct')).toEqual([8.0, 9.0, 10.0, 11.0, 12.0]);
  });
});

describe('getScenarioCount', () => {
  it('calculates total scenarios from selected factors', () => {
    setSelectedFactors(['expected_return_pct', 'volatility_pct']);
    expect(getScenarioCount()).toBe(9);
  });
});

describe('_resetStateForTest', () => {
  it('resets all state', () => {
    setBaseContext({}, makeBaseEffectiveParams());
    setSelectedFactors(['dummy']);
    setAnalysisResult(makeAnalysisResult());
    _resetStateForTest();
    const s = getState();
    expect(s.baseContext).toBeNull();
    expect(s.baseEffectiveParams).toBeNull();
    expect(s.selectedFactors).toEqual([]);
    expect(s.analysisResult).toBeNull();
    expect(s.isRunning).toBe(false);
    expect(s.errorMessage).toBeNull();
  });
});
