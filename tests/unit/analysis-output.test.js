// tests/unit/analysis-output.test.js
// 【Vitest 1.6 互換性】vi.mocked() は使用禁止、mockFn のプロパティに直接アクセスすること
// 【重要】Blob 非互換性対策: mockGenerateAsync の戻り値は {}（空オブジェクト）
// 【重要】global.JSZip の退避・復元は同一ファイル内のテスト間隔離のために必須

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAndDownloadZip } from '../../js/analysis-output.js';
import * as AS from '../../js/analysis-state.js';
import { makeAnalysisResult, makeScenarioPoint, makeBaseMetrics } from '../helpers/analysis-fixtures.js';

const mockZipFile = vi.fn();
const mockZipFolderFile = vi.fn();
const mockZipFolder = vi.fn(() => ({ file: mockZipFolderFile }));
// createObjectURL がモックされるため、Blob 実体は不要。空オブジェクトで十分。
const mockGenerateAsync = vi.fn().mockResolvedValue({});
const MockJSZip = vi.fn(() => ({
  file: mockZipFile,
  folder: mockZipFolder,
  generateAsync: mockGenerateAsync,
}));

vi.mock('../../js/analysis-state.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAnalysisResult: vi.fn(),
  };
});

let originalJSZip;
let originalCreateObjectURL;

beforeEach(() => {
  originalJSZip = global.JSZip; // 現在のグローバル値を退避（同一ファイル内のテスト間隔離のため必須）
  originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
  
  vi.clearAllMocks();
  global.JSZip = MockJSZip;

  const baseMetrics = makeBaseMetrics();
  const perFactorResults = {
    expected_return_pct: [
      makeScenarioPoint(-2, { success_rate_pct: 85.13 }),
      makeScenarioPoint(-1, { success_rate_pct: 90.01 }),
      makeScenarioPoint(1,  { success_rate_pct: 95.70 }),
      makeScenarioPoint(2,  { success_rate_pct: 97.43 }),
    ]
  };
  AS.getAnalysisResult.mockReturnValue(makeAnalysisResult(perFactorResults));
});

afterEach(() => {
  global.JSZip = originalJSZip; // テスト終了ごとに必ず元の値に復元
});

describe('generateAndDownloadZip - エラーケース', () => {
  it('分析結果が null ならエラーをスローする', async () => {
    AS.getAnalysisResult.mockReturnValue(null);
    await expect(generateAndDownloadZip()).rejects.toThrow('分析結果なし');
  });

  it('JSZip が読み込まれていない場合、エラーをスローする', async () => {
    global.JSZip = undefined;
    await expect(generateAndDownloadZip()).rejects.toThrow('JSZipが読み込まれていません');
  });
});

describe('generateAndDownloadZip - ZIP 構造', () => {
  beforeEach(() => {
    mockZipFile.mockClear();
    mockZipFolderFile.mockClear();
  });

  it('manifest.json が追加され、metadata 配列が正しい', async () => {
    await generateAndDownloadZip();
    const manifestCall = mockZipFile.mock.calls.find(call => call[0] === 'manifest.json');
    expect(manifestCall).toBeTruthy();
    const manifest = JSON.parse(manifestCall[1]);
    expect(manifest).toHaveProperty('analysis_run_id');
    expect(manifest).toHaveProperty('base_scenario');
    expect(manifest.factors).toContain('expected_return_pct');

    // ファイル数は選択因子数×4 + 1 = 5
    expect(manifest.outputs.metadata.length).toBe(5);
    expect(manifest.outputs.metadata).toContain('metadata/base.json');
    expect(manifest.outputs.metadata.every(item => typeof item === 'string')).toBe(true);
    expect(manifest.outputs.metadata.some(item => item.includes('expected_return_pct'))).toBe(true);
  });

  it('summary.csv が追加される（ヘッダとデータ行数）', async () => {
    await generateAndDownloadZip();
    const summaryCall = mockZipFile.mock.calls.find(call => call[0] === 'summary.csv');
    expect(summaryCall).toBeTruthy();
    const csv = summaryCall[1];
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    expect(lines[0]).toContain('analysis_run_id');
    expect(lines[0]).toContain('success_rate_pct');
    expect(lines[0]).toContain('final_median_jpy');
    expect(lines.length).toBe(6); // ヘッダ + base + 4水準
  });

  it('comparison_summary.csv が追加される（ヘッダとデータ行数）', async () => {
    await generateAndDownloadZip();
    const compCall = mockZipFile.mock.calls.find(call => call[0] === 'comparison_summary.csv');
    expect(compCall).toBeTruthy();
    const csv = compCall[1];
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    expect(lines[0]).toContain('delta_success_rate_pt');
    expect(lines.length).toBe(5); // ヘッダ + 4水準
  });

  it('metadata フォルダが作成される', async () => {
    await generateAndDownloadZip();
    expect(mockZipFolder).toHaveBeenCalledWith('metadata');
  });

  it('metadata フォルダ内に base + 4水準 = 5つの JSON ファイルが追加される', async () => {
    await generateAndDownloadZip();
    const jsonCalls = mockZipFolderFile.mock.calls.filter(call => call[0].endsWith('.json'));
    expect(jsonCalls.length).toBe(5);
  });

  it('metadata JSON に worst10_max_dd が負の数値として含まれる', async () => {
    await generateAndDownloadZip();
    const jsonCall = mockZipFolderFile.mock.calls.find(call =>
      call[0].endsWith('.json') && call[0] !== 'base.json'
    );
    expect(jsonCall).toBeTruthy();
    const parsed = JSON.parse(jsonCall[1]);
    expect(parsed.result_summary).toHaveProperty('worst10_max_dd');
    expect(typeof parsed.result_summary.worst10_max_dd).toBe('number');
    expect(parsed.result_summary.worst10_max_dd).toBeLessThan(0);
    expect(parsed.result_summary).toHaveProperty('final_p10_jpy');
  });

  it('metadata base.json が正しい構造を持つ', async () => {
    await generateAndDownloadZip();
    const baseCall = mockZipFolderFile.mock.calls.find(call => call[0] === 'base.json');
    expect(baseCall).toBeTruthy();
    const parsed = JSON.parse(baseCall[1]);
    expect(parsed.scenario_id).toBe('base');
    expect(parsed.is_base).toBe(true);
    expect(parsed.result_summary.success_rate_pct).toBe(93.23);
  });
});

describe('generateAndDownloadZip - ダウンロード', () => {
  let createObjectURLSpy, appendChildSpy, removeChildSpy;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('Blob を生成し、ダウンロードリンクを作成する', async () => {
    await generateAndDownloadZip();

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    const appendedElement = appendChildSpy.mock.calls[0][0];
    expect(appendedElement.tagName).toBe('A');
    expect(appendedElement.download).toMatch(/^analysis_\d{14}\.zip$/);
  });

  it('ZIP ファイル名が analysis_YYYYMMDDHHmmss.zip 形式である', async () => {
    await generateAndDownloadZip();

    const aElement = appendChildSpy.mock.calls[0][0];
    expect(aElement.download).toMatch(/^analysis_\d{14}\.zip$/);
    const timestamp = aElement.download.replace('analysis_', '').replace('.zip', '');
    expect(timestamp.length).toBe(14);
    expect(Number.isInteger(Number(timestamp))).toBe(true);
  });
});
