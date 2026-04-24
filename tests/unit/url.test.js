import { describe, it, expect } from 'vitest';
import { buildSimulationUrl } from '../../js/core/url.js';

const sampleParams = {
    initialRiskAsset: 100_000_000, initialCashBuffer: 10_000_000, monthlyExpense: 300_000,
    expectedReturn: 10.0, volatility: 18.0, inflationRate: 2.0, simYears: 30, simPaths: 10000,
    cashBufferToggle: true, drawdownTrigger: -20.0, drawdownReplenish: -5.0, replenishPace: 5.0,
    guardrailToggle: false, guardrailTrigger: -20.0, guardrailReduction: -20.0, guardrailRelease: -15.0,
    useArInflation: false, infVol: 2.0, infAr: 0.5, useTDistribution: true, simDfManual: false, simDfNum: 4.0,
    seedNum: 123456
};

describe('buildSimulationUrl', () => {
    it('全キーを含む URL を生成する', () => {
        const url = buildSimulationUrl(sampleParams, { baseUrl: 'https://example.com/', percentileRaw: '10, 50, 90', seed: 123456 });
        expect(url.searchParams.get('asset')).toBe('1');
        expect(url.searchParams.get('pct')).toBe('10,50,90');
        expect(url.searchParams.get('model')).toBe('log-t');
    });
});