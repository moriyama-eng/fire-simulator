// tests/helpers/analysis-fixtures.js

/**
 * 基本メトリクス（基準シナリオの結果）を生成。
 * final_p10_jpy は最終総資産10%タイル値（テストデータ用の任意の値）。
 */
export function makeBaseMetrics(overrides = {}) {
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
 * シナリオポイント（1水準の結果）を生成
 * @param {number} level - 水準値 (-2, -1, 0, 1, 2)
 * @param {object} metricsOverrides - 上書きするメトリクス
 */
export function makeScenarioPoint(level, metricsOverrides = {}) {
  return { level, metrics: makeBaseMetrics(metricsOverrides) };
}

/**
 * 分析結果オブジェクト全体を生成
 * @param {object} perFactorResults - { factorKey: ScenarioPoint[] }
 */
export function makeAnalysisResult(perFactorResults = {}) {
  return {
    baseScenario: { metrics: makeBaseMetrics() },
    perFactorResults
  };
}

/**
 * ダミーのシミュレーション結果（runSimulation の戻り値型）を生成。
 * totalPercentileData の最終月の値は finalMedian / final_p10_jpy と整合させる。
 * 注意: これは1回のシミュレーション実行の戻り値であり、複数水準の差分は含まない。
 *
 * 【⚠️ 重要 - 値の数学的無効性について】
 * 非50/10パーセンタイル（30, 70, 90）の最終値は、単純比例
 * `Math.round(finalMedian * (pct / 50))` で生成された便宜的なダミー値であり、
 * 統計的に正しい対数正規分布や対数t分布のパーセンタイルを全く表しません。
 * これらの値を用いた統計的検証は一切行わないでください。
 * 将来、これらのパーセンタイル値を直接検証するテストを追加する場合は、
 * 正確な分布に基づくフィクスチャに置き換える必要があります。
 *
 * 【参照の独立性】
 * totalPercentileData, cashPercentileData, ddPercentileData は
 * それぞれ別個の配列として生成される。誤ってテスト内で一方を変更しても
 * 他方には影響しない。
 *
 * @param {object} overrides
 * @param {number} [overrides.finalMedian=538074816] - 最終総資産中央値
 * @param {number} [overrides.finalP10=39342408] - 最終総資産10%タイル値（makeBaseMetrics の final_p10_jpy に対応）
 * @param {number} [overrides.simYears=30] - dataLen の計算に使用
 */
export function makeDummySimResult(overrides = {}) {
  const pcts = [10, 30, 50, 70, 90];
  const simYears = overrides.simYears ?? 30;
  const dataLen = simYears * 12 + 1;
  const finalMedian = overrides.finalMedian ?? 538074816;
  const finalP10 = overrides.finalP10 ?? 39342408;

  const buildPercentileData = () => {
    return pcts.map((pct) => {
      const arr = new Float32Array(dataLen).fill(100_000_000);
      if (pct === 10) arr[dataLen - 1] = finalP10;
      else if (pct === 50) arr[dataLen - 1] = finalMedian;
      else arr[dataLen - 1] = Math.round(finalMedian * (pct / 50));
      return arr;
    });
  };

  // total, cash, ddそれぞれで独立した配列を生成する
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
 * ベース有効パラメータのモック。
 * convertToLegacyParams や getFactorBaseValue で使用される完全なパラメータセット。
 * guardrailToggle は実際のデフォルトに合わせて false (OFF)。
 * simDfManual も自動モードを想定して false を設定する。
 * useArInflation は固定インフレを想定して false。
 * テスト内で状態を変更する場合を考慮し、毎回新しいオブジェクトを返す（スプレッド演算子で複製）。
 *
 * 【補足 - データフロー】
 * baseEffectiveParams → convertToLegacyParams → runSimulation の params
 * baseEffectiveParams → getFactorBaseValue → UI表示用のベース値
 * これらの変換チェーンがテストの主要な検証対象である。
 *
 * 【simDfNum と usedDf の関係】
 * simDfNum (4.0) : 手動設定時の自由度。simDfManual=false（自動モード）では使用されない。
 * usedDf (4.2)   : 実際に使用される自由度。自動モードでは calcAutoDf(volatility) で計算される。
 * テストフィクスチャでは両者を異なる値に設定し、実動作の区別を反映している。
 */
export function makeBaseEffectiveParams(overrides = {}) {
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
    simDfManual: false,        // 実際のデフォルトは自動モード (simDfToggle が ON)
    usedDf: 4.2,
    inflationMode: 'fixed',
    infVol: 2.0,
    infAr: 0.5,
    cashBufferToggle: true,
    drawdownTrigger: -20.0,
    drawdownReplenish: -5.0,
    replenishPace: 5.0,
    guardrailToggle: false,      // 実際のデフォルトは OFF
    guardrailTrigger: -20.0,
    guardrailRelease: -15.0,
    guardrailReduction: -20.0,
    useArInflation: false,       // 実際のデフォルトは固定インフレ（inflationModelToggle OFF）
    percentiles: null,
    targetAssetRatio: overrides.targetAssetRatio ?? 1.0,
    ...overrides
  };
}
