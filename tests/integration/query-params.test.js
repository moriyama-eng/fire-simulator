import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { applyParsedParams } from '../../js/core/url.js';

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
describe('query-params', () => {
    beforeEach(() => { document.body.innerHTML = dom; });
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

    // ===== tar パラメータ復元テスト =====
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