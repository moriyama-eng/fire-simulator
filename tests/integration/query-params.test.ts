// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { applyParsedParams, applyQueryParams, parseQueryParams, buildSimulationUrl } from '../../src/core/url.js';
import { getParamsFromInputs } from '../../src/core/params.js';
import { setLanguage } from '../../src/i18n.js';

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
describe('query-params', () => {
    beforeEach(() => {
        // Reset SSOT to prevent language state from leaking between tests
        delete (globalThis as unknown as { __currentLang?: unknown }).__currentLang;
        document.body.innerHTML = dom;
    });
    it('restores all parameters correctly', () => {
        applyParsedParams({
            asset: '2', cash: '500', expense: '40', ret: '7.0', vol: '20.0', inf: '3.0',
            years: '20', paths: '5000', pct: '10,50,90', cb: '1', gr: '0', seed: '999',
            fixSeed: '1', model: 'log-normal', dfAuto: '0', dfNum: '6.0',
            infModel: '1', infVol: '3.0', infAr: '0.7', ddTrig: '-25.0', ddRepl: '-10.0',
            replPace: '3.0', grTrig: '-30.0', grRel: '-20.0', grRed: '-15.0'
        });
        expect((document.getElementById('initialRiskAssetNum') as HTMLInputElement)?.value).toBe('2');
        expect((document.getElementById('expectedReturnNum') as HTMLInputElement)?.value).toBe('7.0');
        expect((document.getElementById('percentileInput') as HTMLInputElement)?.value).toBe('10,50,90');
    });

    // ===== Restore test for tar parameter =====
    it('restores targetAssetRatio from tar parameter', () => {
        applyParsedParams({
            asset: '2', cash: '500', expense: '40', ret: '7.0', vol: '20.0', inf: '3.0',
            years: '20', paths: '5000', pct: '10,50,90', cb: '1', gr: '0', seed: '999',
            fixSeed: '1', model: 'log-normal', dfAuto: '0', dfNum: '6.0',
            infModel: '1', infVol: '3.0', infAr: '0.7', ddTrig: '-25.0', ddRepl: '-10.0',
            replPace: '3.0', grTrig: '-30.0', grRel: '-20.0', grRed: '-15.0',
            tar: '150'
        });
        expect((document.getElementById('targetAssetRatioNum') as HTMLInputElement)?.value).toBe('150');
    });
});

// ===== critical regression: stored=ja x ?lang=en&cash=100&expense=3 (v2.7.1) =====
describe('EN input values convert correctly to internal JPY', () => {
    beforeEach(() => {
        delete (globalThis as unknown as { __currentLang?: unknown }).__currentLang;
    });

    it('stored=ja + setLanguage(en): cash=100 K$ -> 10,000,000 JPY; expense=3 K$ -> 300,000 JPY', () => {
        setLanguage('en');

        const inputs = {
            initialRiskAssetNum: '1',
            initialCashBufferNum: '100',
            monthlyExpenseNum: '3',
            expectedReturnNum: '10.0',
            volatilityNum: '18.0',
            inflationRateNum: '2.0',
            simYearsNum: '30',
            simPathsNum: '10000',
            cashBufferToggle: true,
            drawdownTriggerNum: '-20.0',
            drawdownReplenishNum: '-5.0',
            replenishPaceNum: '5.0',
            guardrailToggle: false,
            guardrailTriggerNum: '-20.0',
            guardrailReleaseNum: '-15.0',
            guardrailReductionNum: '-20.0',
            inflationModelToggle: false,
            infVolNum: '2.0',
            infArNum: '0.5',
            returnModelSelect: 'log-t',
            simDfToggle: true,
            simDfNum: '4.0',
            seedToggle: false,
            seedNum: '123456',
        };

        const params = getParamsFromInputs(inputs);

        expect(params.initialCashBuffer).toBe(10_000_000);
        expect(params.monthlyExpense).toBe(300_000);
    });
});

// ===== Currency round-trip: EN->JA->EN (v2.7.1) =====
describe('Currency round-trip: EN->JA->EN (100->1000->100 / 3->30->3)', () => {
    beforeEach(() => {
        delete (globalThis as unknown as { __currentLang?: unknown }).__currentLang;
    });

    it('EN input 100 K$ = JA input 1000 man-yen (both = 10,000,000 JPY)', () => {
        setLanguage('en');
        const enInputs = {
            initialRiskAssetNum: '1',
            initialCashBufferNum: '100',
            monthlyExpenseNum: '3',
            expectedReturnNum: '10.0', volatilityNum: '18.0', inflationRateNum: '2.0',
            simYearsNum: '30', simPathsNum: '10000', cashBufferToggle: true,
            drawdownTriggerNum: '-20.0', drawdownReplenishNum: '-5.0', replenishPaceNum: '5.0',
            guardrailToggle: false, guardrailTriggerNum: '-20.0', guardrailReleaseNum: '-15.0',
            guardrailReductionNum: '-20.0', inflationModelToggle: false, infVolNum: '2.0',
            infArNum: '0.5', returnModelSelect: 'log-t', simDfToggle: true, simDfNum: '4.0',
            seedToggle: false, seedNum: '123456',
        };
        const enParams = getParamsFromInputs(enInputs);

        setLanguage('ja');
        const jaInputs = { ...enInputs, initialCashBufferNum: '1000', monthlyExpenseNum: '30' };
        const jaParams = getParamsFromInputs(jaInputs);

        expect(enParams.initialCashBuffer).toBe(10_000_000);
        expect(jaParams.initialCashBuffer).toBe(10_000_000);
        expect(enParams.monthlyExpense).toBe(300_000);
        expect(jaParams.monthlyExpense).toBe(300_000);
    });
});

// ===== auto=1 full-flow integration test & double-conversion regression guard (Fix 1 & Fix 5; v2.7.1) =====
describe('applyQueryParams full flow with auto=1, languageChanged spy & double-conversion regression guard (Fix 1 & Fix 5)', () => {
    const origLocation = window.location;

    beforeEach(() => {
        delete (globalThis as unknown as { __currentLang?: unknown }).__currentLang;
        try { localStorage.setItem('lang', 'ja'); } catch {}
        document.body.innerHTML = dom;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        try { localStorage.removeItem('lang'); } catch {}
        delete (globalThis as unknown as { __currentLang?: unknown }).__currentLang;
        (window as unknown as { location: unknown }).location = origLocation;
    });

    it('processes ?lang=en&cash=100&expense=3&auto=1 through applyQueryParams without triggering languageChanged event (0 calls)', () => {
        try { localStorage.setItem('lang', 'ja'); } catch {}
        (globalThis as unknown as { __currentLang?: string }).__currentLang = 'ja';

        delete (window as unknown as { location?: unknown }).location;
        (window as unknown as { location: unknown }).location = new URL('http://localhost/?lang=en&cash=100&expense=3&auto=1');

        (globalThis as unknown as { __currentLang?: string }).__currentLang = 'en';
        try { localStorage.setItem('lang', 'en'); } catch {}

        const langChangedSpy = vi.fn();
        document.addEventListener('languageChanged', langChangedSpy);

        const runMainStub = vi.fn();

        applyQueryParams(runMainStub);

        expect(langChangedSpy).toHaveBeenCalledTimes(0);

        expect((document.getElementById('initialCashBufferNum') as HTMLInputElement)?.value).toBe('100');
        expect((document.getElementById('monthlyExpenseNum') as HTMLInputElement)?.value).toBe('3');

        const domInputs = {
            initialRiskAssetNum: (document.getElementById('initialRiskAssetNum') as HTMLInputElement).value,
            initialCashBufferNum: (document.getElementById('initialCashBufferNum') as HTMLInputElement).value,
            monthlyExpenseNum: (document.getElementById('monthlyExpenseNum') as HTMLInputElement).value,
            expectedReturnNum: (document.getElementById('expectedReturnNum') as HTMLInputElement).value,
            volatilityNum: (document.getElementById('volatilityNum') as HTMLInputElement).value,
            inflationRateNum: (document.getElementById('inflationRateNum') as HTMLInputElement).value,
            simYearsNum: (document.getElementById('simYearsNum') as HTMLInputElement).value,
            simPathsNum: (document.getElementById('simPathsNum') as HTMLInputElement).value,
            cashBufferToggle: (document.getElementById('cashBufferToggle') as HTMLInputElement).checked,
            drawdownTriggerNum: (document.getElementById('drawdownTriggerNum') as HTMLInputElement).value,
            drawdownReplenishNum: (document.getElementById('drawdownReplenishNum') as HTMLInputElement).value,
            replenishPaceNum: (document.getElementById('replenishPaceNum') as HTMLInputElement).value,
            guardrailToggle: (document.getElementById('guardrailToggle') as HTMLInputElement).checked,
            guardrailTriggerNum: (document.getElementById('guardrailTriggerNum') as HTMLInputElement).value,
            guardrailReleaseNum: (document.getElementById('guardrailReleaseNum') as HTMLInputElement).value,
            guardrailReductionNum: (document.getElementById('guardrailReductionNum') as HTMLInputElement).value,
            inflationModelToggle: (document.getElementById('inflationModelToggle') as HTMLInputElement).checked,
            infVolNum: (document.getElementById('infVolNum') as HTMLInputElement).value,
            infArNum: (document.getElementById('infArNum') as HTMLInputElement).value,
            returnModelSelect: (document.getElementById('returnModelSelect') as HTMLSelectElement).value,
            simDfToggle: (document.getElementById('simDfToggle') as HTMLInputElement).checked,
            simDfNum: (document.getElementById('simDfNum') as HTMLInputElement).value,
            seedToggle: (document.getElementById('seedToggle') as HTMLInputElement).checked,
            seedNum: (document.getElementById('seedNum') as HTMLInputElement).value,
        };

        const resolvedParamsEN = getParamsFromInputs(domInputs);
        expect(resolvedParamsEN.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsEN.monthlyExpense).toBe(300_000);

        (globalThis as unknown as { __currentLang?: string }).__currentLang = 'ja';
        const domInputsJA = { ...domInputs, initialCashBufferNum: '1000', monthlyExpenseNum: '30' };
        const resolvedParamsJA = getParamsFromInputs(domInputsJA);
        expect(resolvedParamsJA.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsJA.monthlyExpense).toBe(300_000);

        (globalThis as unknown as { __currentLang?: string }).__currentLang = 'en';
        const resolvedParamsENRoundtrip = getParamsFromInputs(domInputs);
        expect(resolvedParamsENRoundtrip.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsENRoundtrip.monthlyExpense).toBe(300_000);

        expect(runMainStub).not.toHaveBeenCalled();
        vi.advanceTimersByTime(150);
        expect(runMainStub).toHaveBeenCalledTimes(1);

        document.removeEventListener('languageChanged', langChangedSpy);
    });

    it('processes ?lang=ja&cash=1000&expense=30 through applyQueryParams without languageChanged', () => {
        try { localStorage.setItem('lang', 'ja'); } catch {}
        (globalThis as unknown as { __currentLang?: string }).__currentLang = 'ja';
        setLanguage('ja');

        delete (window as unknown as { location?: unknown }).location;
        (window as unknown as { location: unknown }).location = new URL('http://localhost/?lang=ja&cash=1000&expense=30');

        const langChangedSpy = vi.fn();
        document.addEventListener('languageChanged', langChangedSpy);

        applyQueryParams(vi.fn());

        expect(langChangedSpy).toHaveBeenCalledTimes(0);
        expect((document.getElementById('initialCashBufferNum') as HTMLInputElement)?.value).toBe('1000');
        expect((document.getElementById('monthlyExpenseNum') as HTMLInputElement)?.value).toBe('30');

        const jaParams = getParamsFromInputs({
            initialRiskAssetNum: (document.getElementById('initialRiskAssetNum') as HTMLInputElement).value,
            initialCashBufferNum: (document.getElementById('initialCashBufferNum') as HTMLInputElement).value,
            monthlyExpenseNum: (document.getElementById('monthlyExpenseNum') as HTMLInputElement).value,
            expectedReturnNum: (document.getElementById('expectedReturnNum') as HTMLInputElement).value,
            volatilityNum: (document.getElementById('volatilityNum') as HTMLInputElement).value,
            inflationRateNum: (document.getElementById('inflationRateNum') as HTMLInputElement).value,
            simYearsNum: (document.getElementById('simYearsNum') as HTMLInputElement).value,
            simPathsNum: (document.getElementById('simPathsNum') as HTMLInputElement).value,
            cashBufferToggle: (document.getElementById('cashBufferToggle') as HTMLInputElement).checked,
            drawdownTriggerNum: (document.getElementById('drawdownTriggerNum') as HTMLInputElement).value,
            drawdownReplenishNum: (document.getElementById('drawdownReplenishNum') as HTMLInputElement).value,
            replenishPaceNum: (document.getElementById('replenishPaceNum') as HTMLInputElement).value,
            guardrailToggle: (document.getElementById('guardrailToggle') as HTMLInputElement).checked,
            guardrailTriggerNum: (document.getElementById('guardrailTriggerNum') as HTMLInputElement).value,
            guardrailReleaseNum: (document.getElementById('guardrailReleaseNum') as HTMLInputElement).value,
            guardrailReductionNum: (document.getElementById('guardrailReductionNum') as HTMLInputElement).value,
            inflationModelToggle: (document.getElementById('inflationModelToggle') as HTMLInputElement).checked,
            infVolNum: (document.getElementById('infVolNum') as HTMLInputElement).value,
            infArNum: (document.getElementById('infArNum') as HTMLInputElement).value,
            returnModelSelect: (document.getElementById('returnModelSelect') as HTMLSelectElement).value,
            simDfToggle: (document.getElementById('simDfToggle') as HTMLInputElement).checked,
            simDfNum: (document.getElementById('simDfNum') as HTMLInputElement).value,
            seedToggle: (document.getElementById('seedToggle') as HTMLInputElement).checked,
            seedNum: (document.getElementById('seedNum') as HTMLInputElement).value,
        });
        expect(jaParams.initialCashBuffer).toBe(10_000_000);
        expect(jaParams.monthlyExpense).toBe(300_000);

        document.removeEventListener('languageChanged', langChangedSpy);
    });
});

describe('query-params lang/auto parse and html lang sync', () => {
    it('parses lang and auto query parameters correctly via parseQueryParams', () => {
        const query = '?lang=en&auto=1&asset=2&cash=500';
        const parsed = parseQueryParams(query);
        expect(parsed.lang).toBe('en');
        expect(parsed.auto).toBe('1');
        expect(parsed.asset).toBe('2');
        expect(parsed.cash).toBe('500');
    });

    it('synchronizes document.documentElement.lang on setLanguage', () => {
        setLanguage('ja');
        expect(document.documentElement.lang).toBe('ja');

        setLanguage('en');
        expect(document.documentElement.lang).toBe('en');
    });

    it('round-trips auto=0 query parameter correctly via buildSimulationUrl and parseQueryParams', () => {
        const sampleParams = {
            initialRiskAsset: 100_000_000, initialCashBuffer: 10_000_000, monthlyExpense: 300_000,
            expectedReturn: 10.0, volatility: 18.0, inflationRate: 2.0, simYears: 30, simPaths: 10000,
            cashBufferToggle: true, drawdownTrigger: -20.0, drawdownReplenish: -5.0, replenishPace: 5.0,
            guardrailToggle: false, guardrailTrigger: -20.0, guardrailReduction: -20.0, guardrailRelease: -15.0,
            useArInflation: false, infVol: 2.0, infAr: 0.5, useTDistribution: true, simDfManual: false, simDfNum: 4.0,
            seedNum: 123456, targetAssetRatio: 100
        };
        const url = buildSimulationUrl(sampleParams, { autoRun: false, baseUrl: 'https://example.com/', lang: 'ja' });
        const parsed = parseQueryParams(url.search);
        expect(parsed.auto).toBe('0');
        expect(parsed.lang).toBe('ja');
    });
});
