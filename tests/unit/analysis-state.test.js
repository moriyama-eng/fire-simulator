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

describe('FACTORS 定義', () => {
  it('FACTORS は10個の因子を持つ', () => {
    expect(FACTORS.length).toBe(10);
  });

  it('各因子は必須プロパティを持つ', () => {
    for (const f of FACTORS) {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('label');
      expect(f).toHaveProperty('category');
      expect(f).toHaveProperty('catClass');
      expect(f).toHaveProperty('unit');
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
  it('CB と GR が両方 ON の場合、全10因子を返す', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    expect(getAvailableFactors().length).toBe(10);
  });

  it('CB が OFF の場合、現金バッファ因子を除外する', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: false }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).not.toContain('drawdown_trigger_pct');
    expect(keys).not.toContain('replenish_pace_x_expense');
  });

  it('GR が OFF の場合、ガードレール因子を除外する', () => {
    setBaseContext({}, makeBaseEffectiveParams({ guardrailToggle: false }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).not.toContain('guardrail_trigger_pct');
    expect(keys).not.toContain('guardrail_reduction_pct');
  });

  it('GR が ON の場合、ガードレール因子が含まれることを確認する', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true, guardrailToggle: true }));
    const keys = getAvailableFactors().map(f => f.key);
    expect(keys).toContain('guardrail_trigger_pct');
    expect(keys).toContain('guardrail_reduction_pct');
  });

  it('ベース条件未設定時は空配列を返す', () => {
    expect(getAvailableFactors()).toEqual([]);
  });
});

describe('setBaseContext', () => {
  it('ベースパラメータを正しく設定する', () => {
    const ep = makeBaseEffectiveParams();
    setBaseContext({ source: 'test' }, ep);
    expect(getState().baseEffectiveParams).toEqual(ep);
    expect(getState().baseContext.source).toBe('test');
  });

  it('条件変更時、利用不可になった因子を選択から外し、分析結果をクリアする', () => {
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: true }));
    setSelectedFactors(['drawdown_trigger_pct']);
    setBaseContext({}, makeBaseEffectiveParams({ cashBufferToggle: false }));
    expect(getState().selectedFactors).toEqual([]);
    expect(getState().analysisResult).toBeNull();
  });

  it('同一条件で再設定した場合、選択因子と分析結果を保持する', () => {
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
  it('選択因子を設定し、分析結果をクリアする', () => {
    setAnalysisResult(makeAnalysisResult());
    setSelectedFactors(['volatility_pct']);
    expect(getState().selectedFactors).toEqual(['volatility_pct']);
    expect(getState().analysisResult).toBeNull();
  });
});

describe('setRunning', () => {
  it('実行中フラグを設定する', () => {
    setRunning(true);
    expect(getState().isRunning).toBe(true);
    setRunning(false);
    expect(getState().isRunning).toBe(false);
  });

  it('実行終了時にエラーメッセージをクリアする', () => {
    setErrorMessage('some error');
    setRunning(false);
    expect(getState().errorMessage).toBeNull();
  });
});

describe('setAnalysisResult', () => {
  it('分析結果を設定し、実行中フラグを解除する', () => {
    const result = makeAnalysisResult();
    setAnalysisResult(result);
    expect(getState().analysisResult).toEqual(result);
    expect(getState().isRunning).toBe(false);
  });
});

describe('setErrorMessage', () => {
  it('エラーメッセージを設定し、実行中フラグを解除する', () => {
    setErrorMessage('test error');
    expect(getState().errorMessage).toBe('test error');
    expect(getState().isRunning).toBe(false);
  });
});

describe('getFactorBaseValue', () => {
  it('スケールを持つ因子のベース値をUI表示単位で返す', () => {
    setBaseContext({}, makeBaseEffectiveParams({ initialRiskAsset: 200_000_000 }));
    expect(getFactorBaseValue('initial_risk_asset_jpy')).toBe(2.0);
  });

  it('スケールが1の因子はそのまま返す', () => {
    setBaseContext({}, makeBaseEffectiveParams({ expectedReturn: 10.0 }));
    expect(getFactorBaseValue('expected_return_pct')).toBe(10.0);
  });

  it('ベース条件未設定時は null を返す', () => {
    expect(getFactorBaseValue('expected_return_pct')).toBeNull();
  });

  it('未定義の因子キーに対して null を返す', () => {
    setBaseContext({}, makeBaseEffectiveParams());
    expect(getFactorBaseValue('non_existent_key')).toBeNull();
  });

  it('有効な因子キーだがパラメータ未設定の場合は null を返す', () => {
    const ep = makeBaseEffectiveParams();
    delete ep.expectedReturn;
    setBaseContext({}, ep);
    expect(getFactorBaseValue('expected_return_pct')).toBeNull();
  });
});

describe('getGeneratedValues', () => {
  it('基準値からステップ幅で5水準を生成する', () => {
    setBaseContext({}, makeBaseEffectiveParams({ expectedReturn: 10.0 }));
    expect(getGeneratedValues('expected_return_pct')).toEqual([8.0, 9.0, 10.0, 11.0, 12.0]);
  });
});

describe('getScenarioCount', () => {
  it('選択因子数から総シナリオ数を計算する', () => {
    setSelectedFactors(['expected_return_pct', 'volatility_pct']);
    expect(getScenarioCount()).toBe(9);
  });
});

describe('_resetStateForTest', () => {
  it('すべての状態を初期化する', () => {
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
