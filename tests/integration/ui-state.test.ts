// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { markInputChanged as coreMarkInputChanged, markResultClean } from '../../src/core/state.js';
import {
    getIsResultDirty as appGetIsResultDirty,
    setLastSimResult,
    setLastExecutedParams,
    getLastExecutedParams
} from '../../src/app/state.js';
import { markInputChanged as appMarkInputChanged, runMain } from '../../src/app/actions.js';
import { setLanguage, t } from '../../src/i18n.js';
import type { SimulationParams } from '../../src/types/params.js';
import type { AggregatedMetrics } from '../../src/types/simulation.js';

const { runSimulationMock } = vi.hoisted(() => ({
    runSimulationMock: vi.fn().mockResolvedValue({})
}));

vi.mock('../../src/simulation-engine.js', () => ({
    runSimulation: runSimulationMock,
    setProgressCallback: vi.fn()
}));

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
const fullIndexHtml = readFileSync('index.html', 'utf-8');

describe('dirty state', () => {
    beforeEach(() => {
        document.body.innerHTML = dom;
        markResultClean();
        setLastSimResult(null);
        setLastExecutedParams(null);
        setLanguage('ja');
    });

    it('disables buttons when input changes', () => {
        coreMarkInputChanged();
        const btn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(btn?.disabled).toBe(true);
    });

    it('re-enables buttons after re-execution', () => {
        coreMarkInputChanged();
        markResultClean();
        const btn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(btn?.disabled).toBe(false);
    });

    it('syncs dirty state between core/state.ts and app/state.ts and renders dirty warning badge', () => {
        let container = document.getElementById('summaryCardContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'summaryCardContainer';
            document.body.appendChild(container);
        }
        setLastSimResult({
            successRate: 92.5,
            finalMedian: 100_000_000,
            targetAssetMaintainRate: 80.0,
            usedSeed: 123456,
            modelType: 'log-normal',
            usedDf: 4.0
        } as unknown as AggregatedMetrics);

        appMarkInputChanged();
        expect(appGetIsResultDirty()).toBe(true);
        expect(container.innerHTML).toContain('data-i18n="summary.dirtyWarning"');
    });

    it('restores cash buffer to 100 (100K USD) when toggled OFF -> ON in English mode', async () => {
        document.body.innerHTML = `
            <input type="checkbox" id="cashBufferToggle" />
            <input type="text" id="initialCashBufferNum" value="0" />
            <div id="cbParamsPanel"></div>
            <div id="summaryCardContainer"></div>
        `;
        setLanguage('en');
        vi.resetModules();
        if (typeof globalThis.IntersectionObserver === 'undefined') {
            (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
                observe() {}
                disconnect() {}
            };
        }
        await import('../../src/app/init.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        const cbToggle = document.getElementById('cashBufferToggle') as HTMLInputElement;
        const cbInput = document.getElementById('initialCashBufferNum') as HTMLInputElement;
        cbToggle.checked = true;
        cbToggle.dispatchEvent(new Event('change'));
        expect(cbInput.value).toBe('100');
    });

    it('preserves child SVG icons in capture template headings when translating [data-i18n] nodes', () => {
        document.body.innerHTML = fullIndexHtml;
        setLanguage('en');
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
        });
        const condSpan = document.querySelector('[data-i18n="capture.conditionTitle"]');
        const chartSpan = document.querySelector('[data-i18n="capture.chartTitle"]');
        expect(condSpan?.tagName).toBe('SPAN');
        expect(condSpan?.parentElement?.querySelector('svg')).not.toBeNull();
        expect(chartSpan?.tagName).toBe('SPAN');
        expect(chartSpan?.parentElement?.querySelector('svg')).not.toBeNull();
    });

    it('preserves previous lastExecutedParams when a subsequent runMain() fails', async () => {
        const prevParams = { initialRiskAsset: 100_000_000, simYears: 30 } as unknown as SimulationParams;
        setLastSimResult({ successRate: 90 } as unknown as AggregatedMetrics);
        setLastExecutedParams(prevParams);
        runSimulationMock.mockRejectedValueOnce(new Error('worker boom'));
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await runMain();
        expect(getLastExecutedParams()).toBe(prevParams);
    });
});
