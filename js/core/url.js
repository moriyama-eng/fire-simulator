// ====================================================================
// js/core/url.js
// ====================================================================

import { formatPercentileInput } from './format.js';

export function buildSimulationUrl(params, options = {}) {
    const {
        autoRun = true,
        fixedSeed = true,
        baseUrl,
        seed = params.seedNum,
        percentileRaw = ''
    } = options;
    const url = new URL(baseUrl || `${location.origin}${location.pathname}`);
    url.searchParams.set('asset', (params.initialRiskAsset / 100_000_000).toString());
    url.searchParams.set('cash', (params.initialCashBuffer / 10_000).toString());
    url.searchParams.set('expense', (params.monthlyExpense / 10_000).toString());
    url.searchParams.set('ret', params.expectedReturn.toFixed(1));
    url.searchParams.set('vol', params.volatility.toFixed(1));
    url.searchParams.set('inf', params.inflationRate.toFixed(1));
    url.searchParams.set('years', params.simYears.toString());
    url.searchParams.set('paths', params.simPaths.toString());
    url.searchParams.set('pct', formatPercentileInput(percentileRaw).replace(/\s/g, ''));
    url.searchParams.set('cb', params.cashBufferToggle ? '1' : '0');
    url.searchParams.set('gr', params.guardrailToggle ? '1' : '0');
    url.searchParams.set('seed', seed.toString());
    url.searchParams.set('fixSeed', fixedSeed ? '1' : '0');
    url.searchParams.set('auto', autoRun ? '1' : '0');
    url.searchParams.set('model', params.useTDistribution ? 'log-t' : 'log-normal');
    url.searchParams.set('dfAuto', params.simDfManual ? '0' : '1');
    url.searchParams.set('dfNum', params.simDfNum.toFixed(1));
    url.searchParams.set('infModel', params.useArInflation ? '1' : '0');
    url.searchParams.set('infVol', params.infVol.toFixed(1));
    url.searchParams.set('infAr', params.infAr.toFixed(1));
    url.searchParams.set('ddTrig', params.drawdownTrigger.toFixed(1));
    url.searchParams.set('ddRepl', params.drawdownReplenish.toFixed(1));
    url.searchParams.set('replPace', params.replenishPace.toFixed(1));
    url.searchParams.set('grTrig', params.guardrailTrigger.toFixed(1));
    url.searchParams.set('grRel', params.guardrailRelease.toFixed(1));
    url.searchParams.set('grRed', params.guardrailReduction.toFixed(1));
    return url;
}

export function parseQueryParams(searchString) {
    const p = new URLSearchParams(searchString);
    const keys = [
        'asset','cash','expense','ret','vol','inf','years','paths','pct',
        'cb','gr','seed','fixSeed','auto','model','dfAuto','dfNum',
        'infModel','infVol','infAr','ddTrig','ddRepl','replPace','grTrig','grRel','grRed'
    ];
    const result = {};
    for (const k of keys) if (p.has(k)) result[k] = p.get(k);
    return result;
}

export function applyParsedParams(parsed) {
    const setNum = (id, key) => {
        if (parsed[key] === undefined) return;
        const el = document.getElementById(id); if (!el) return;
        el.value = parsed[key];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    const setBool = (id, key, invert) => {
        if (parsed[key] === undefined) return;
        const el = document.getElementById(id); if (!el) return;
        el.checked = invert ? (parsed[key] !== '1') : (parsed[key] === '1');
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    setNum('initialRiskAssetNum','asset'); setNum('initialCashBufferNum','cash'); setNum('monthlyExpenseNum','expense');
    setNum('expectedReturnNum','ret'); setNum('volatilityNum','vol'); setNum('inflationRateNum','inf');
    setNum('simYearsNum','years'); setNum('simPathsNum','paths'); setNum('seedNum','seed');

    if (parsed['pct'] !== undefined) document.getElementById('percentileInput').value = parsed['pct'];
    if (parsed['model'] !== undefined) {
        const s = document.getElementById('returnModelSelect'); s.value = parsed['model'];
        s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (parsed['dfAuto'] !== undefined) {
        const t = document.getElementById('simDfToggle');
        t.checked = (parsed['dfAuto'] === '1');
        t.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setNum('simDfNum','dfNum');
    setBool('seedToggle','fixSeed', true);
    setBool('cashBufferToggle','cb');
    setBool('guardrailToggle','gr');

    if (parsed['infModel'] !== undefined) {
        const t = document.getElementById('inflationModelToggle');
        t.checked = (parsed['infModel'] === '1');
        t.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setNum('infVolNum','infVol'); setNum('infArNum','infAr');
    setNum('drawdownTriggerNum','ddTrig'); setNum('drawdownReplenishNum','ddRepl'); setNum('replenishPaceNum','replPace');
    setNum('guardrailTriggerNum','grTrig'); setNum('guardrailReleaseNum','grRel'); setNum('guardrailReductionNum','grRed');
}

export function applyQueryParams(runMainFn) {
    const parsed = parseQueryParams(window.location.search);
    if (Object.keys(parsed).length === 0) return;
    applyParsedParams(parsed);
    if (parsed['auto'] === '1') setTimeout(() => runMainFn(), 150);
}