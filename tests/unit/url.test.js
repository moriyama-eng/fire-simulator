import { describe, it, expect, beforeEach } from 'vitest';
import { buildSimulationUrl, parseQueryParams } from '../../js/core/url.js';

beforeEach(() => {
    // Prevent __currentLang from leaking between tests
    delete globalThis.__currentLang;
});

const sampleParams = {
    initialRiskAsset: 100_000_000, initialCashBuffer: 10_000_000, monthlyExpense: 300_000,
    expectedReturn: 10.0, volatility: 18.0, inflationRate: 2.0, simYears: 30, simPaths: 10000,
    cashBufferToggle: true, drawdownTrigger: -20.0, drawdownReplenish: -5.0, replenishPace: 5.0,
    guardrailToggle: false, guardrailTrigger: -20.0, guardrailReduction: -20.0, guardrailRelease: -15.0,
    useArInflation: false, infVol: 2.0, infAr: 0.5, useTDistribution: true, simDfManual: false, simDfNum: 4.0,
    seedNum: 123456
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
    const sampleParamsWithTar = {
        ...sampleParams,
        targetAssetRatio: 1.2,
    };

    it('includes tar parameter when targetAssetRatio is provided', () => {
        const url = buildSimulationUrl(sampleParamsWithTar, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.get('tar')).toBe('1.2');
    });

    it('excludes tar parameter when targetAssetRatio is undefined', () => {
        const params = { ...sampleParams };
        delete params.targetAssetRatio;
        const url = buildSimulationUrl(params, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.has('tar')).toBe(false);
    });
});

// ===== URL round-trip tests (v2.7.1: verifies cash/expense encoding per language mode) =====
describe('buildSimulationUrl + parseQueryParams round-trip', () => {
    it('JA mode: encodes cash as 10,000-yen units (1000 = 10,000,000 JPY)', () => {
        // Internal JPY: 10,000,000 (1000 man-yen cash), 300,000 (30 man-yen expense)
        const url = buildSimulationUrl(sampleParams, {
            baseUrl: 'https://example.com/',
            lang: 'ja',
            percentileRaw: '50',
            seed: 123456,
        });
        const parsed = parseQueryParams(url.search);
        // In JA mode: cash URL param = internal_JPY / 10,000 = 10,000,000 / 10,000 = 1000
        expect(parsed['cash']).toBe('1000');
        // expense URL param = 300,000 / 10,000 = 30
        expect(parsed['expense']).toBe('30');
    });

    it('EN mode: encodes cash as K-dollar units (100 = 10,000,000 JPY at $1=100JPY)', () => {
        // Same internal JPY values, but in EN mode: cash = internal / 100,000 = 100 K$
        const url = buildSimulationUrl(sampleParams, {
            baseUrl: 'https://example.com/',
            lang: 'en',
            percentileRaw: '50',
            seed: 123456,
        });
        const parsed = parseQueryParams(url.search);
        // EN mode: cash URL param = 10,000,000 / 100,000 = 100
        expect(parsed['cash']).toBe('100');
        // expense URL param = 300,000 / 100,000 = 3
        expect(parsed['expense']).toBe('3');
        // lang param is set
        expect(parsed['lang']).toBe('en');
    });
});