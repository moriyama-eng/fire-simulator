// js/analysis-output.js
// 分析タブ ZIP出力モジュール
// 責務: CSV生成、JSON生成、ZIPアーカイブ作成
// 依存: js/analysis-state.js (JSZipはグローバル)

import * as AS from './analysis-state.js';

export async function generateAndDownloadZip() {
  const result = AS.getAnalysisResult();
  if (!result) throw new Error('error.noResult');
  if (typeof JSZip === 'undefined') throw new Error('error.noJSZip');
  const zip = new JSZip();

  const analysisRunId = new Date().toISOString();
  const baseMetrics = result.baseScenario.metrics;

  // --- ヘルパー関数群（CSVエスケープ・行構築）を内部で定義 ---
  const csvVal = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return `"${v.replace(/"/g, '""')}"`;
    return String(v);
  };

  // サマリー行の構築
  const summaryRows = [];
  summaryRows.push({
    analysis_run_id: analysisRunId, scenario_id: 'base', is_base: true,
    factor_key: '', factor_label: 'Base scenario', level_code: '',
    value_after_change: '', value_unit: '',
    success_rate_pct: baseMetrics.success_rate_pct,
    final_median_jpy: baseMetrics.final_median_jpy,
    final_p10_jpy: baseMetrics.final_p10_jpy,
    median_max_dd: '', worst10_max_dd: baseMetrics.worst10_max_dd,
    median_underwater_months: '', worst10_underwater_months: '',
    seed: '', sim_paths: '', sim_years: '', model_type: '', df_mode: '',
    used_df: '', inflation_mode: '', cash_buffer_enabled: '', guardrail_enabled: '',
    target_asset_maintain_rate: baseMetrics.target_asset_maintain_rate
  });

  const comparisonRows = [];
  const metadataEntries = [];

  // 基準シナリオのメタデータ
  metadataEntries.push({
    scenarioId: 'base',
    scenario: {
      id: 'base', isBase: true,
      factorKey: '', levelCode: '', valueAfterChange: '',
      effectiveParams: {}
    },
    simResult: {
      successRate: baseMetrics.success_rate_pct,
      finalMedian: baseMetrics.final_median_jpy,
      finalP10Jpy: baseMetrics.final_p10_jpy,
      totalPercentileData: [],
      dataLen: 0,
      worst10MaxDd: baseMetrics.worst10_max_dd,
      targetAssetMaintainRate: baseMetrics.target_asset_maintain_rate
    },
    analysisPercentiles: []
  });

  // 因子ごとの結果を処理
  if (result.perFactorResults) {
    for (const [factorKey, scenarios] of Object.entries(result.perFactorResults)) {
      const factor = AS.FACTORS.find(f => f.key === factorKey);
      const factorLabel = factorKey;
      const unit = '';

      for (const scenario of scenarios) {
        const m = scenario.metrics;
        const levelCode = String(scenario.level);
        const scenarioId = `${factorKey}_level_${levelCode}`;

        // サマリー行
        summaryRows.push({
          analysis_run_id: analysisRunId,
          scenario_id: scenarioId,
          is_base: false,
          factor_key: factorKey,
          factor_label: factorLabel,
          level_code: levelCode,
          value_after_change: '',
          value_unit: unit,
          success_rate_pct: m.success_rate_pct,
          final_median_jpy: m.final_median_jpy,
          final_p10_jpy: m.final_p10_jpy,
          median_max_dd: '',
          worst10_max_dd: m.worst10_max_dd,
          median_underwater_months: '',
          worst10_underwater_months: '',
          seed: '', sim_paths: '', sim_years: '', model_type: '', df_mode: '',
          used_df: '', inflation_mode: '', cash_buffer_enabled: '', guardrail_enabled: '',
          target_asset_maintain_rate: m.target_asset_maintain_rate
        });

        // 比較行
        comparisonRows.push({
          analysis_run_id: analysisRunId,
          base_scenario_id: 'base',
          scenario_id: scenarioId,
          factor_key: factorKey,
          factor_label: factorLabel,
          level_code: levelCode,
          value_after_change: '',
          value_unit: unit,
          delta_success_rate_pt: m.success_rate_pct - baseMetrics.success_rate_pct,
          delta_final_median_jpy: m.final_median_jpy - baseMetrics.final_median_jpy,
          delta_final_p10_jpy: m.final_p10_jpy - baseMetrics.final_p10_jpy,
          delta_median_max_dd_pt: '',
          delta_worst10_max_dd_pt: '',
          delta_median_underwater_months: '',
          delta_worst10_underwater_months: ''
        });

        // メタデータエントリ
        metadataEntries.push({
          scenarioId: scenarioId,
          scenario: {
            id: scenarioId, isBase: false,
            factorKey: factorKey,
            levelCode: levelCode,
            valueAfterChange: '',
            effectiveParams: {}
          },
          simResult: {
            successRate: m.success_rate_pct,
            finalMedian: m.final_median_jpy,
            finalP10Jpy: m.final_p10_jpy,
            totalPercentileData: [],
            dataLen: 0,
            worst10MaxDd: m.worst10_max_dd,
            targetAssetMaintainRate: m.target_asset_maintain_rate
          }, analysisPercentiles: [] // 空でOK
        });
      }
    }
  }

  // --- CSV生成 ---
  const summaryHeader = ['analysis_run_id', 'scenario_id', 'is_base', 'factor_key', 'factor_label', 'level_code', 'value_after_change', 'value_unit', 'success_rate_pct', 'final_median_jpy', 'final_p10_jpy', 'median_max_dd', 'worst10_max_dd', 'median_underwater_months', 'worst10_underwater_months', 'seed', 'sim_paths', 'sim_years', 'model_type', 'df_mode', 'used_df', 'inflation_mode', 'cash_buffer_enabled', 'guardrail_enabled', 'target_asset_maintain_rate'];
  const summaryCsv = summaryHeader.join(',') + '\n' +
    summaryRows.map(row => summaryHeader.map(key => csvVal(row[key])).join(',')).join('\n');

  const comparisonHeader = ['analysis_run_id', 'base_scenario_id', 'scenario_id', 'factor_key', 'factor_label', 'level_code', 'value_after_change', 'value_unit', 'delta_success_rate_pt', 'delta_final_median_jpy', 'delta_final_p10_jpy', 'delta_median_max_dd_pt', 'delta_worst10_max_dd_pt', 'delta_median_underwater_months', 'delta_worst10_underwater_months'];
  const comparisonCsv = comparisonHeader.join(',') + '\n' +
    comparisonRows.map(row => comparisonHeader.map(key => csvVal(row[key])).join(',')).join('\n');

  // --- マニフェスト作成 ---
  const manifest = {
    analysis_run_id: analysisRunId,
    base_scenario: baseMetrics,
    factors: result.perFactorResults ? Object.keys(result.perFactorResults) : [],
    outputs: {
      manifest: 'manifest.json',
      summary: 'summary.csv',
      comparison_summary: 'comparison_summary.csv',
      metadata: metadataEntries.map(e => `metadata/${e.scenarioId}.json`),
      series: []
    }
  };

  // --- ZIP 構成 ---
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('summary.csv', summaryCsv);
  zip.file('comparison_summary.csv', comparisonCsv);

  const mdFolder = zip.folder('metadata');
  for (const entry of metadataEntries) {
    const jsonContent = JSON.stringify({
      schema_version: '1.0.0',
      tool_version: '2.0.0',
      analysis_run_id: analysisRunId,
      scenario_id: entry.scenario.id,
      is_base: entry.scenario.isBase,
      scenario_definition: {
        factor_key: entry.scenario.factorKey,
        level_code: entry.scenario.levelCode,
        value_after_change: entry.scenario.valueAfterChange
      },
      effective_params: entry.scenario.effectiveParams,
      result_summary: {
        success_rate_pct: entry.simResult.successRate,
        final_median_jpy: entry.simResult.finalMedian,
        final_p10_jpy: entry.simResult.finalP10Jpy, 
        worst10_max_dd: entry.simResult.worst10MaxDd,
        target_asset_maintain_rate: entry.simResult.targetAssetMaintainRate
      }
    }, null, 2);
    mdFolder.file(`${entry.scenarioId}.json`, jsonContent);
  }

  // --- ダウンロード ---
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  const filename = `analysis_${ts}.zip`;

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}