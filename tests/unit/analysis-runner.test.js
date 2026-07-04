// tests/unit/analysis-runner.test.js
// 【Vitest 1.6 互換性】vi.mocked() は使用禁止、mockFn のプロパティに直接アクセスすること
// 【最重要】vi.mock ファクトリ内では import バインディングを参照してはならない
//   FACTORS は importOriginal() から、getState はローカルスパイ経由で使用する

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runSimulation } from '../../js/simulation-engine.js';
import * as AS from '../../js/analysis-state.js';
import { runAnalysis, applyFactorChange, convertToLegacyParams } from '../../js/analysis-runner.js';
// applyFactorChange のテストで使用するため、実際の FACTORS は引き続き import する
import { FACTORS, getSuccessRateTargetDelta } from '../../js/analysis-state.js';
import { makeDummySimResult, makeBaseEffectiveParams } from '../helpers/analysis-fixtures.js';

vi.mock('../../js/simulation-engine.js');
vi.mock('../../js/analysis-state.js', async (importOriginal) => {
  const actual = await importOriginal();
  // ファクトリ内で使用する FACTORS は importOriginal() から取得する（import バインディングは未定義のため）
  const { FACTORS: originalFactors } = actual;
  // getState 用のスパイをローカル変数として定義
  const getStateMock = vi.fn();
  return {
    ...actual,
    getState: getStateMock,
    getSelectedFactors: vi.fn(() => []),
    // getFactorBaseValue のモック: getStateMock を経由して baseEffectiveParams を取得する。
    // テスト実行時に毎回 getStateMock() が評価されるため、動的な状態に対応できる。
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
  // リセットによりデフォルト実装が失われるため、明示的に再設定
  runSimulation.mockResolvedValue(makeDummySimResult());
  AS.getState.mockReturnValue({
    baseEffectiveParams: makeBaseEffectiveParams(),
    selectedFactors: [],
    isRunning: false,
  });
});

describe('runAnalysis', () => {
  it('calls runSimulation 5 times when 1 factor selected', async () => {
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    await runAnalysis(vi.fn());
    expect(runSimulation).toHaveBeenCalledTimes(5);
  });

  it('base scenario params include useFixedSeed and seedNum', async () => {
    // 注: convertToLegacyParams は useFixedSeed: true をハードコードしている。
    // 現在の実装では常に true だが、将来可変になる場合はテストの拡張が必要。
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
    // 1回目: onProgress({done:0, total:5})（runSimulation 呼び出し前）
    // 2〜5回目: 各水準の runSimulation 完了後
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
      // テストが途中で失敗しても、必ずデフォルト実装に戻す
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

  it('clamps simPaths to 5000 minimum', () => {
    const ep = makeBaseEffectiveParams({ simPaths: 500 });
    expect(convertToLegacyParams(ep).simPaths).toBe(5000);
  });

  it('clamps simPaths to 50000 maximum', () => {
    const ep = makeBaseEffectiveParams({ simPaths: 100000 });
    expect(convertToLegacyParams(ep).simPaths).toBe(50000);
  });

  it('passes simPaths 5000 as-is', () => {
    const ep = makeBaseEffectiveParams({ simPaths: 5000 });
    expect(convertToLegacyParams(ep).simPaths).toBe(5000);
  });

  it('passes simPaths 50000 as-is', () => {
    const ep = makeBaseEffectiveParams({ simPaths: 50000 });
    expect(convertToLegacyParams(ep).simPaths).toBe(50000);
  });
});

describe('applyFactorChange', () => {
  // 実際のコードに合わせ、完全な有効パラメータオブジェクトを渡して破壊的変更をテストする
  // 注意: これらのテストは FACTORS の実際の scale と step に依存している。
  // 因子定義が変更された場合は期待値を見直す必要がある。
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

describe('getSuccessRateTargetDelta', () => {
  it.each([
    [96.0, 0],
    [95.0, 0],
    [93.2, 1.0],
    [90.0, 1.0],
    [87.5, 2.0],
    [85.0, 2.0],
    [70.0, 5.0],
    [0, 5.0],
  ])('gets correct delta for success rate %s%%', (rate, expectedDelta) => {
    expect(getSuccessRateTargetDelta(rate)).toBe(expectedDelta);
  });
});

// ===== target_asset_maintain_rate のテスト =====
describe('extractMetrics - target_asset_maintain_rate', () => {
  beforeEach(() => {
    // 既存のモック設定をリセットしてから設定する
    runSimulation.mockReset();
    runSimulation.mockResolvedValue(makeDummySimResult({ targetAssetMaintainRate: 88.5 }));
  });

  it('includes target_asset_maintain_rate in extracted metrics', async () => {
    AS.getSelectedFactors.mockReturnValue(['expected_return_pct']);
    const result = await runAnalysis(vi.fn());
    
    // baseScenario の metrics に target_asset_maintain_rate が含まれる
    expect(result.baseScenario.metrics).toHaveProperty('target_asset_maintain_rate');
    expect(result.baseScenario.metrics.target_asset_maintain_rate).toBe(88.5);
    
    // 因子シナリオにも含まれる
    const factorResults = result.perFactorResults.expected_return_pct;
    expect(factorResults[0].metrics).toHaveProperty('target_asset_maintain_rate');
  });
});
