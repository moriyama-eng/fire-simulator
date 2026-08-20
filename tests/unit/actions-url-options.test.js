import { describe, it, expect } from 'vitest';
import { getCopyUrlOptions, getShareUrlOptions, getCompareUrlOptions } from '../../js/app/actions-url-options.js';

describe('actions-url-options', () => {
    const sampleDyn = {
        seed: 42,
        percentileRaw: '10, 50, 90',
        lang: 'en'
    };

    describe('getCopyUrlOptions', () => {
        it('returns options with autoRun: true and fixedSeed: true without baseUrl', () => {
            const options = getCopyUrlOptions(sampleDyn);
            expect(options).toEqual({
                autoRun: true,
                fixedSeed: true,
                seed: 42,
                percentileRaw: '10, 50, 90',
                lang: 'en'
            });
            expect(options.baseUrl).toBeUndefined();
        });

        it('handles default empty dynamic object', () => {
            const options = getCopyUrlOptions();
            expect(options.autoRun).toBe(true);
            expect(options.fixedSeed).toBe(true);
            expect(options.seed).toBeUndefined();
        });
    });

    describe('getShareUrlOptions', () => {
        it('returns options with autoRun: true, fixedSeed: true, and explicit baseUrl', () => {
            const options = getShareUrlOptions(sampleDyn);
            expect(options).toEqual({
                autoRun: true,
                fixedSeed: true,
                seed: 42,
                percentileRaw: '10, 50, 90',
                baseUrl: 'https://moriyama-eng.github.io/fire-simulator/',
                lang: 'en'
            });
        });
    });

    describe('getCompareUrlOptions', () => {
        it('returns options with autoRun: false and fixedSeed: true without baseUrl', () => {
            const options = getCompareUrlOptions(sampleDyn);
            expect(options).toEqual({
                autoRun: false,
                fixedSeed: true,
                seed: 42,
                percentileRaw: '10, 50, 90',
                lang: 'en'
            });
            expect(options.baseUrl).toBeUndefined();
        });
    });
});
