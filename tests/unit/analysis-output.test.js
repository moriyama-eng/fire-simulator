// tests/unit/analysis-output.test.js
// [Vitest 1.6 compatibility] vi.mocked() is prohibited; access mockFn properties directly
// [IMPORTANT] Blob incompatibility workaround: return value of mockGenerateAsync must be {} (empty object)
// [IMPORTANT] Saving and restoring global.JSZip is mandatory for test isolation within the same file

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAndDownloadZip } from '../../js/analysis-output.js';
import * as AS from '../../js/analysis-state.js';
import { makeAnalysisResult, makeScenarioPoint, makeBaseMetrics } from '../helpers/analysis-fixtures.js';

const mockZipFile = vi.fn();
const mockZipFolderFile = vi.fn();
const mockZipFolder = vi.fn(() => ({ file: mockZipFolderFile }));
// Since createObjectURL is mocked, no real Blob is needed. An empty object suffices.
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
  originalJSZip = global.JSZip; // Save current global value (mandatory for test isolation within the same file)
  originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = vi.fn().mockReturnValue('blob:test');

  vi.clearAllMocks();
  global.JSZip = MockJSZip;

  const baseMetrics = makeBaseMetrics();
  const perFactorResults = {
    expected_return_pct: [
      makeScenarioPoint(-2, { success_rate_pct: 85.13 }),
      makeScenarioPoint(-1, { success_rate_pct: 90.01 }),
      makeScenarioPoint(1, { success_rate_pct: 95.70 }),
      makeScenarioPoint(2, { success_rate_pct: 97.43 }),
    ]
  };
  AS.getAnalysisResult.mockReturnValue(makeAnalysisResult(perFactorResults));
});

afterEach(() => {
  global.JSZip = originalJSZip; // Always restore to the original value after each test
});

describe('generateAndDownloadZip - error cases', () => {
  it('throws error when analysis result is null', async () => {
    AS.getAnalysisResult.mockReturnValue(null);
    await expect(generateAndDownloadZip()).rejects.toThrow(/No analysis result|error\.noResult/i);
  });

  it('throws error when JSZip is not loaded', async () => {
    global.JSZip = undefined;
    await expect(generateAndDownloadZip()).rejects.toThrow(/JSZip is not loaded|error\.noJSZip/i);
  });
});

describe('generateAndDownloadZip - ZIP structure', () => {
  beforeEach(() => {
    mockZipFile.mockClear();
    mockZipFolderFile.mockClear();
  });

  it('adds manifest.json with correct metadata array', async () => {
    await generateAndDownloadZip();
    const manifestCall = mockZipFile.mock.calls.find(call => call[0] === 'manifest.json');
    expect(manifestCall).toBeTruthy();
    const manifest = JSON.parse(manifestCall[1]);
    expect(manifest).toHaveProperty('analysis_run_id');
    expect(manifest).toHaveProperty('base_scenario');
    expect(manifest.factors).toContain('expected_return_pct');

    // Number of files = number of selected factors x 4 + 1 = 5
    expect(manifest.outputs.metadata.length).toBe(5);
    expect(manifest.outputs.metadata).toContain('metadata/base.json');
    expect(manifest.outputs.metadata.every(item => typeof item === 'string')).toBe(true);
    expect(manifest.outputs.metadata.some(item => item.includes('expected_return_pct'))).toBe(true);
  });

  it('adds summary.csv with header and correct row count', async () => {
    await generateAndDownloadZip();
    const summaryCall = mockZipFile.mock.calls.find(call => call[0] === 'summary.csv');
    expect(summaryCall).toBeTruthy();
    const csv = summaryCall[1];
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    expect(lines[0]).toContain('analysis_run_id');
    expect(lines[0]).toContain('success_rate_pct');
    expect(lines[0]).toContain('final_median_jpy');
    expect(lines.length).toBe(6); // header + base + 4 levels
  });

  it('adds comparison_summary.csv with header and correct row count', async () => {
    await generateAndDownloadZip();
    const compCall = mockZipFile.mock.calls.find(call => call[0] === 'comparison_summary.csv');
    expect(compCall).toBeTruthy();
    const csv = compCall[1];
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    expect(lines[0]).toContain('delta_success_rate_pt');
    expect(lines.length).toBe(5); // header + 4 levels
  });

  it('creates metadata folder', async () => {
    await generateAndDownloadZip();
    expect(mockZipFolder).toHaveBeenCalledWith('metadata');
  });

  it('adds 5 JSON files (base + 4 levels) inside metadata folder', async () => {
    await generateAndDownloadZip();
    const jsonCalls = mockZipFolderFile.mock.calls.filter(call => call[0].endsWith('.json'));
    expect(jsonCalls.length).toBe(5);
  });

  it('includes worst10_max_dd as negative number in metadata JSON', async () => {
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

  it('has correct structure for metadata base.json', async () => {
    await generateAndDownloadZip();
    const baseCall = mockZipFolderFile.mock.calls.find(call => call[0] === 'base.json');
    expect(baseCall).toBeTruthy();
    const parsed = JSON.parse(baseCall[1]);
    expect(parsed.scenario_id).toBe('base');
    expect(parsed.is_base).toBe(true);
    expect(parsed.result_summary.success_rate_pct).toBe(93.23);
  });
});

describe('generateAndDownloadZip - download', () => {
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

  it('creates blob and download link', async () => {
    await generateAndDownloadZip();

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    const appendedElement = appendChildSpy.mock.calls[0][0];
    expect(appendedElement.tagName).toBe('A');
    expect(appendedElement.download).toMatch(/^analysis_\d{14}\.zip$/);
  });

  it('generates ZIP filename in analysis_YYYYMMDDHHmmss.zip format', async () => {
    await generateAndDownloadZip();

    const aElement = appendChildSpy.mock.calls[0][0];
    expect(aElement.download).toMatch(/^analysis_\d{14}\.zip$/);
    const timestamp = aElement.download.replace('analysis_', '').replace('.zip', '');
    expect(timestamp.length).toBe(14);
    expect(Number.isInteger(Number(timestamp))).toBe(true);
  });
});

// ===== CSV/JSON output test for target_asset_maintain_rate =====
describe('generateAndDownloadZip - target_asset_maintain_rate', () => {
  it('includes target_asset_maintain_rate in summary.csv header and data', async () => {
    await generateAndDownloadZip();
    const summaryCall = mockZipFile.mock.calls.find(call => call[0] === 'summary.csv');
    expect(summaryCall).toBeTruthy();
    const csv = summaryCall[1];
    const lines = csv.split('\n');
    const header = lines[0];
    expect(header).toContain('target_asset_maintain_rate');
    
    // Confirm that a comma-separated value exists in the data row
    const dataRow = lines[1]; // base scenario row
    const headerColumns = header.split(',');
    const idx = headerColumns.indexOf('target_asset_maintain_rate');
    expect(idx).toBeGreaterThan(-1);
    const dataColumns = dataRow.split(',');
    expect(dataColumns[idx]).not.toBe('');
  });

  it('includes target_asset_maintain_rate in metadata JSON', async () => {
    await generateAndDownloadZip();
    const baseJsonCall = mockZipFolderFile.mock.calls.find(call => call[0] === 'base.json');
    expect(baseJsonCall).toBeTruthy();
    const parsed = JSON.parse(baseJsonCall[1]);
    expect(parsed.result_summary).toHaveProperty('target_asset_maintain_rate');
    expect(typeof parsed.result_summary.target_asset_maintain_rate).toBe('number');
  });
});
