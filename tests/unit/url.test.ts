// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSimulationUrl, parseQueryParams, applyParsedParams, applyQueryParams } from '../../src/core/url.js';
import { getParamsFromInputs } from '../../src/core/params.js';
import type { SimulationParams } from '../../src/types/params.js';

beforeEach(() => {
    // Prevent __currentLang from leaking between tests
    delete (globalThis as unknown as Record<string, unknown>).__currentLang;
});

const sampleParams: SimulationParams = {
    initialRiskAsset: 100_000_000, initialCashBuffer: 10_000_000, monthlyExpense: 300_000,
    expectedReturn: 10.0, volatility: 18.0, inflationRate: 2.0, simYears: 30, simPaths: 10000,
    cashBufferToggle: true, drawdownTrigger: -20.0, drawdownReplenish: -5.0, replenishPace: 5.0,
    guardrailToggle: false, guardrailTrigger: -20.0, guardrailReduction: -20.0, guardrailRelease: -15.0,
    useArInflation: false, infVol: 2.0, infAr: 0.5, useTDistribution: true, simDfManual: false, simDfNum: 4.0,
    seedNum: 123456, targetAssetRatio: 100.0
};

describe('buildSimulationUrl', () => {
    it('generates URL containing all keys', () => {
        const url = buildSimulationUrl(sampleParams, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.get('asset')).toBe('1');
        expect(url.searchParams.get('pct')).toBe('10,50,90');
        expect(url.searchParams.get('model')).toBe('log-t');
    });
});

// ===== Test for targetAssetRatio (tar) parameter =====
describe('buildSimulationUrl - targetAssetRatio (tar)', () => {
    const sampleParamsWithTar: SimulationParams = {
        ...sampleParams,
        targetAssetRatio: 1.2,
    };

    it('includes tar parameter when targetAssetRatio is provided', () => {
        const url = buildSimulationUrl(sampleParamsWithTar, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.get('tar')).toBe('1.2');
    });

    it('encodes tar=0.0 when targetAssetRatio is 0', () => {
        const url = buildSimulationUrl({ ...sampleParams, targetAssetRatio: 0 }, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.get('tar')).toBe('0.0');
    });

    it('excludes tar parameter when targetAssetRatio is undefined', () => {
        const params: Partial<SimulationParams> = { ...sampleParams };
        delete params.targetAssetRatio;
        const url = buildSimulationUrl(params as SimulationParams, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.has('tar')).toBe(false);
    });
});

// ===== URL round-trip tests (v2.7.1: verifies cash/expense encoding per language mode) =====
describe('buildSimulationUrl + parseQueryParams round-trip', () => {
    it('JA mode: encodes cash as 10,000-yen units (1000 = 10,000,000 JPY)', () => {
        const url = buildSimulationUrl(sampleParams, {
            baseUrl: 'https://example.com/',
            lang: 'ja',
            percentileRaw: '50',
            seed: 123456,
        });
        const parsed = parseQueryParams(url.search);
        expect(parsed['cash']).toBe('1000');
        expect(parsed['expense']).toBe('30');
    });

    it('EN mode: encodes cash as K-dollar units (100 = 10,000,000 JPY at $1=100JPY)', () => {
        const url = buildSimulationUrl(sampleParams, {
            baseUrl: 'https://example.com/',
            lang: 'en',
            percentileRaw: '50',
            seed: 123456,
        });
        const parsed = parseQueryParams(url.search);
        expect(parsed['cash']).toBe('100');
        expect(parsed['expense']).toBe('3');
        expect(parsed['lang']).toBe('en');
    });
});

describe('applyParsedParams and applyQueryParams', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="initialRiskAssetNum" />
            <input id="initialCashBufferNum" />
            <input id="monthlyExpenseNum" />
            <input id="expectedReturnNum" />
            <input id="volatilityNum" />
            <input id="inflationRateNum" />
            <input id="simYearsNum" />
            <input id="simPathsNum" />
            <input id="seedNum" />
            <input id="percentileInput" />
            <select id="returnModelSelect"><option value="log-normal">log-normal</option><option value="log-t">log-t</option></select>
            <input type="checkbox" id="simDfToggle" />
            <input id="simDfNum" />
            <input type="checkbox" id="seedToggle" />
            <input type="checkbox" id="cashBufferToggle" />
            <input type="checkbox" id="guardrailToggle" />
            <input type="checkbox" id="inflationModelToggle" />
            <input id="infVolNum" />
            <input id="infArNum" />
            <input id="drawdownTriggerNum" />
            <input id="drawdownReplenishNum" />
            <input id="replenishPaceNum" />
            <input id="guardrailTriggerNum" />
            <input id="guardrailReleaseNum" />
            <input id="guardrailReductionNum" />
            <input id="targetAssetRatioNum" />
        `;
    });

    it('applies parsed parameters to DOM elements', () => {
        const parsed: Record<string, string> = {
            asset: '1.5',
            cash: '2000',
            expense: '50',
            ret: '8.0',
            vol: '15.0',
            inf: '2.5',
            years: '25',
            paths: '10000',
            seed: '999',
            pct: '10, 50, 90',
            model: 'log-t',
            dfAuto: '1',
            dfNum: '5.0',
            fixSeed: '1',
            cb: '1',
            gr: '1',
            infModel: '1',
            infVol: '3.0',
            infAr: '0.6',
            ddTrig: '-25.0',
            ddRepl: '-10.0',
            replPace: '4.0',
            grTrig: '-25.0',
            grRel: '-12.0',
            grRed: '-25.0',
            tar: '150.0'
        };
        applyParsedParams(parsed);
        expect((document.getElementById('initialRiskAssetNum') as HTMLInputElement).value).toBe('1.5');
        expect((document.getElementById('returnModelSelect') as HTMLSelectElement).value).toBe('log-t');
        expect((document.getElementById('cashBufferToggle') as HTMLInputElement).checked).toBe(true);
        expect((document.getElementById('targetAssetRatioNum') as HTMLInputElement).value).toBe('150.0');
    });

    it('applies tar=0.0 to targetAssetRatioNum and resolves to targetAssetRatio=0 via getParamsFromInputs', () => {
        applyParsedParams({ tar: '0.0' });
        const el = document.getElementById('targetAssetRatioNum') as HTMLInputElement;
        expect(el.value).toBe('0.0');
        const params = getParamsFromInputs({ targetAssetRatioNum: el.value });
        expect(params.targetAssetRatio).toBe(0);
    });

    it('applyQueryParams runs without error when no query params exist', () => {
        const runMain = vi.fn();
        applyQueryParams(runMain);
        expect(runMain).not.toHaveBeenCalled();
    });

    it('applyQueryParams applies parameters and schedules runMainFn when auto=1', () => {
        vi.useFakeTimers();
        try {
            window.history.pushState({}, '', '?asset=1.5&auto=1');
            const runMain = vi.fn();
            applyQueryParams(runMain);
            expect((document.getElementById('initialRiskAssetNum') as HTMLInputElement).value).toBe('1.5');
            vi.advanceTimersByTime(160);
            expect(runMain).toHaveBeenCalledTimes(1);
            window.history.pushState({}, '', '/');
        } finally {
            vi.useRealTimers();
        }
    });

    it('applyParsedParams handles empty DOM elements gracefully', () => {
        document.body.innerHTML = '';
        expect(() => applyParsedParams({
            model: 'log-t',
            dfAuto: '1',
            infModel: '1',
            tar: '150.0',
            dfNum: '5.0',
            cb: '1'
        })).not.toThrow();
    });
});
