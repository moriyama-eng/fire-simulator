import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { applyParsedParams, applyQueryParams, parseQueryParams, buildSimulationUrl } from '../../js/core/url.js';
import { getParamsFromInputs } from '../../js/core/params.js';
import { setLanguage } from '../../js/i18n.js';

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
describe('query-params', () => {
    beforeEach(() => {
        // Reset SSOT to prevent language state from leaking between tests
        delete globalThis.__currentLang;
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
        expect(document.getElementById('initialRiskAssetNum').value).toBe('2');
        expect(document.getElementById('expectedReturnNum').value).toBe('7.0');
        expect(document.getElementById('percentileInput').value).toBe('10,50,90');
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
        expect(document.getElementById('targetAssetRatioNum').value).toBe('150');
    });
});

// ===== critical regression: stored=ja x ?lang=en&cash=100&expense=3 (v2.7.1) =====
// Validates that getParamsFromInputs correctly converts EN-mode URL values to internal JPY.
// This is the primary regression test for the URL reproduction bug fixed in v2.7.1.
describe('EN input values convert correctly to internal JPY', () => {
    beforeEach(() => {
        delete globalThis.__currentLang;
    });

    it('stored=ja + setLanguage(en): cash=100 K$ -> 10,000,000 JPY; expense=3 K$ -> 300,000 JPY', () => {
        // Simulate boot: boot-time resolves 'en' (e.g. from ?lang=en URL param)
        setLanguage('en'); // sets globalThis.__currentLang = 'en'

        // Simulate applyParsedParams setting DOM values (cash=100 K$, expense=3 K$ in EN mode)
        const inputs = {
            initialRiskAssetNum: '1',    // 1 = 100,000,000 JPY (1 oku-yen)
            initialCashBufferNum: '100', // 100 K$ = 10,000,000 JPY (100 * 100,000)
            monthlyExpenseNum: '3',      // 3 K$ = 300,000 JPY (3 * 100,000)
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

        // EN mode: input 100 K$ -> cashBufferVal * 10 * 10,000 = 100 * 10 * 10,000 = 10,000,000 JPY
        expect(params.initialCashBuffer).toBe(10_000_000);
        // EN mode: input 3 K$ -> monthlyExpenseVal * 10 * 10,000 = 3 * 10 * 10,000 = 300,000 JPY
        expect(params.monthlyExpense).toBe(300_000);
    });
});

// ===== Currency round-trip: EN->JA->EN (v2.7.1) =====
describe('Currency round-trip: EN->JA->EN (100->1000->100 / 3->30->3)', () => {
    beforeEach(() => {
        delete globalThis.__currentLang;
    });

    it('EN input 100 K$ = JA input 1000 man-yen (both = 10,000,000 JPY)', () => {
        // EN mode: 100 K$ input
        setLanguage('en');
        const enInputs = {
            initialRiskAssetNum: '1',
            initialCashBufferNum: '100', // 100 K$
            monthlyExpenseNum: '3',      // 3 K$
            expectedReturnNum: '10.0', volatilityNum: '18.0', inflationRateNum: '2.0',
            simYearsNum: '30', simPathsNum: '10000', cashBufferToggle: true,
            drawdownTriggerNum: '-20.0', drawdownReplenishNum: '-5.0', replenishPaceNum: '5.0',
            guardrailToggle: false, guardrailTriggerNum: '-20.0', guardrailReleaseNum: '-15.0',
            guardrailReductionNum: '-20.0', inflationModelToggle: false, infVolNum: '2.0',
            infArNum: '0.5', returnModelSelect: 'log-t', simDfToggle: true, simDfNum: '4.0',
            seedToggle: false, seedNum: '123456',
        };
        const enParams = getParamsFromInputs(enInputs);

        // JA mode: 1000 man-yen input
        setLanguage('ja');
        const jaInputs = { ...enInputs, initialCashBufferNum: '1000', monthlyExpenseNum: '30' };
        const jaParams = getParamsFromInputs(jaInputs);

        // Both must produce identical internal JPY values
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
        delete globalThis.__currentLang;
        try { localStorage.setItem('lang', 'ja'); } catch (e) {}
        document.body.innerHTML = dom;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        try { localStorage.removeItem('lang'); } catch (e) {}
        delete globalThis.__currentLang;
        window.location = origLocation;
    });

    it('processes ?lang=en&cash=100&expense=3&auto=1 through applyQueryParams without triggering languageChanged event (0 calls)', () => {
        // Setup initial pre-state: stored=ja
        try { localStorage.setItem('lang', 'ja'); } catch (e) {}
        globalThis.__currentLang = 'ja';

        // 1. Simulate URL navigation to ?lang=en&cash=100&expense=3&auto=1
        delete window.location;
        window.location = new URL('http://localhost/?lang=en&cash=100&expense=3&auto=1');

        // 2. Boot-time resolution runs (simulated): URL ?lang=en sets __currentLang='en' and localStorage='en'
        globalThis.__currentLang = 'en';
        try { localStorage.setItem('lang', 'en'); } catch (e) {}

        // 3. Register spy on languageChanged event to verify setLanguage is NOT called by applyQueryParams
        const langChangedSpy = vi.fn();
        document.addEventListener('languageChanged', langChangedSpy);

        const runMainStub = vi.fn();

        // 4. Call applyQueryParams (top-level URL application entry point)
        applyQueryParams(runMainStub);

        // Verification (b): Verify setLanguage was NOT called inside applyQueryParams (languageChanged fired 0 times)
        // If setLanguage were called (old bug in v2.7.0), languageChanged would fire 1 time, triggering convertCurrencyInputs and corrupting values.
        expect(langChangedSpy).toHaveBeenCalledTimes(0);

        // Verification (a): Verify DOM values set by applyParsedParams
        expect(document.getElementById('initialCashBufferNum').value).toBe('100');
        expect(document.getElementById('monthlyExpenseNum').value).toBe('3');

        // Verify internal JPY conversion from DOM values under EN mode SSOT
        const domInputs = {
            initialRiskAssetNum: document.getElementById('initialRiskAssetNum').value,
            initialCashBufferNum: document.getElementById('initialCashBufferNum').value,
            monthlyExpenseNum: document.getElementById('monthlyExpenseNum').value,
            expectedReturnNum: document.getElementById('expectedReturnNum').value,
            volatilityNum: document.getElementById('volatilityNum').value,
            inflationRateNum: document.getElementById('inflationRateNum').value,
            simYearsNum: document.getElementById('simYearsNum').value,
            simPathsNum: document.getElementById('simPathsNum').value,
            cashBufferToggle: document.getElementById('cashBufferToggle').checked,
            drawdownTriggerNum: document.getElementById('drawdownTriggerNum').value,
            drawdownReplenishNum: document.getElementById('drawdownReplenishNum').value,
            replenishPaceNum: document.getElementById('replenishPaceNum').value,
            guardrailToggle: document.getElementById('guardrailToggle').checked,
            guardrailTriggerNum: document.getElementById('guardrailTriggerNum').value,
            guardrailReleaseNum: document.getElementById('guardrailReleaseNum').value,
            guardrailReductionNum: document.getElementById('guardrailReductionNum').value,
            inflationModelToggle: document.getElementById('inflationModelToggle').checked,
            infVolNum: document.getElementById('infVolNum').value,
            infArNum: document.getElementById('infArNum').value,
            returnModelSelect: document.getElementById('returnModelSelect').value,
            simDfToggle: document.getElementById('simDfToggle').checked,
            simDfNum: document.getElementById('simDfNum').value,
            seedToggle: document.getElementById('seedToggle').checked,
            seedNum: document.getElementById('seedNum').value,
        };

        const resolvedParamsEN = getParamsFromInputs(domInputs);
        expect(resolvedParamsEN.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsEN.monthlyExpense).toBe(300_000);

        // Verify EN -> JA -> EN roundtrip consistency (100 -> 1000 -> 100 / 3 -> 30 -> 3)
        // Switch to JA mode: input values 1000 man-yen cash, 30 man-yen expense
        globalThis.__currentLang = 'ja';
        const domInputsJA = { ...domInputs, initialCashBufferNum: '1000', monthlyExpenseNum: '30' };
        const resolvedParamsJA = getParamsFromInputs(domInputsJA);
        expect(resolvedParamsJA.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsJA.monthlyExpense).toBe(300_000);

        // Switch back to EN mode: input values 100 K$ cash, 3 K$ expense
        globalThis.__currentLang = 'en';
        const resolvedParamsENRoundtrip = getParamsFromInputs(domInputs);
        expect(resolvedParamsENRoundtrip.initialCashBuffer).toBe(10_000_000);
        expect(resolvedParamsENRoundtrip.monthlyExpense).toBe(300_000);

        // Verify auto=1 triggers runMainFn after 150ms timeout
        expect(runMainStub).not.toHaveBeenCalled();
        vi.advanceTimersByTime(150);
        expect(runMainStub).toHaveBeenCalledTimes(1);

        document.removeEventListener('languageChanged', langChangedSpy);
    });

    it('processes ?lang=ja&cash=1000&expense=30 through applyQueryParams without languageChanged', () => {
        try { localStorage.setItem('lang', 'ja'); } catch (e) {}
        globalThis.__currentLang = 'ja';
        setLanguage('ja');

        delete window.location;
        window.location = new URL('http://localhost/?lang=ja&cash=1000&expense=30');

        const langChangedSpy = vi.fn();
        document.addEventListener('languageChanged', langChangedSpy);

        applyQueryParams(vi.fn());

        expect(langChangedSpy).toHaveBeenCalledTimes(0);
        expect(document.getElementById('initialCashBufferNum').value).toBe('1000');
        expect(document.getElementById('monthlyExpenseNum').value).toBe('30');

        const jaParams = getParamsFromInputs({
            initialRiskAssetNum: document.getElementById('initialRiskAssetNum').value,
            initialCashBufferNum: document.getElementById('initialCashBufferNum').value,
            monthlyExpenseNum: document.getElementById('monthlyExpenseNum').value,
            expectedReturnNum: document.getElementById('expectedReturnNum').value,
            volatilityNum: document.getElementById('volatilityNum').value,
            inflationRateNum: document.getElementById('inflationRateNum').value,
            simYearsNum: document.getElementById('simYearsNum').value,
            simPathsNum: document.getElementById('simPathsNum').value,
            cashBufferToggle: document.getElementById('cashBufferToggle').checked,
            drawdownTriggerNum: document.getElementById('drawdownTriggerNum').value,
            drawdownReplenishNum: document.getElementById('drawdownReplenishNum').value,
            replenishPaceNum: document.getElementById('replenishPaceNum').value,
            guardrailToggle: document.getElementById('guardrailToggle').checked,
            guardrailTriggerNum: document.getElementById('guardrailTriggerNum').value,
            guardrailReleaseNum: document.getElementById('guardrailReleaseNum').value,
            guardrailReductionNum: document.getElementById('guardrailReductionNum').value,
            inflationModelToggle: document.getElementById('inflationModelToggle').checked,
            infVolNum: document.getElementById('infVolNum').value,
            infArNum: document.getElementById('infArNum').value,
            returnModelSelect: document.getElementById('returnModelSelect').value,
            simDfToggle: document.getElementById('simDfToggle').checked,
            simDfNum: document.getElementById('simDfNum').value,
            seedToggle: document.getElementById('seedToggle').checked,
            seedNum: document.getElementById('seedNum').value,
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
            seedNum: 123456
        };
        const url = buildSimulationUrl(sampleParams, { autoRun: false, baseUrl: 'https://example.com/', lang: 'ja' });
        const parsed = parseQueryParams(url.search);
        expect(parsed.auto).toBe('0');
        expect(parsed.lang).toBe('ja');
    });
});