import { describe, it, expect } from 'vitest';
import { xoshiro128ss, createNormalGenerator, createGammaGenerator, createTGenerator } from '../../js/core/random.js';

describe('xoshiro128ss', () => {
    it('generates same sequence with same seed', () => {
        const rng1 = xoshiro128ss(123), rng2 = xoshiro128ss(123);
        for (let i = 0; i < 10; i++) expect(rng1()).toBe(rng2());
    });

    it('diverges when seeds differ', () => {
        const rng1 = xoshiro128ss(1), rng2 = xoshiro128ss(2);
        const a = Array.from({ length: 10 }, () => rng1());
        const b = Array.from({ length: 10 }, () => rng2());
        expect(a).not.toEqual(b);
    });
});

describe('createNormalGenerator', () => {
    it('has independent caches', () => {
        const rng1 = xoshiro128ss(1), rng2 = xoshiro128ss(1);
        const g1 = createNormalGenerator(rng1), g2 = createNormalGenerator(rng2);
        for (let i = 0; i < 10; i++) expect(g1()).toBe(g2());
    });
});

describe('createGammaGenerator', () => {
    it('generates the same sequence with the same seed', () => {
        function makeGamma(seed) {
            const rng = xoshiro128ss(seed);
            const normalGen = createNormalGenerator(rng);
            return createGammaGenerator(rng, normalGen);
        }
        const g1 = makeGamma(7), g2 = makeGamma(7);
        for (let i = 0; i < 8; i++) expect(g1(2.5)).toBe(g2(2.5));
    });

    it('returns 0 when alpha is not positive', () => {
        const rng = xoshiro128ss(1);
        const gammaRand = createGammaGenerator(rng, createNormalGenerator(rng));
        expect(gammaRand(0)).toBe(0);
        expect(gammaRand(-1)).toBe(0);
    });

    it('generates gamma variate when alpha < 1.0', () => {
        const rng = xoshiro128ss(12345, 67890, 54321, 9876);
        const normalGen = createNormalGenerator(rng);
        const gammaRand = createGammaGenerator(rng, normalGen);
        const val = gammaRand(0.5);
        expect(typeof val).toBe('number');
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThan(0);
    });
});

describe('createTGenerator', () => {
    it('generates the same sequence with the same seed', () => {
        function makeT(seed) {
            const rng = xoshiro128ss(seed);
            const normalGen = createNormalGenerator(rng);
            const gammaRand = createGammaGenerator(rng, normalGen);
            return createTGenerator(normalGen, gammaRand);
        }
        const t1 = makeT(11), t2 = makeT(11);
        for (let i = 0; i < 8; i++) expect(t1(4)).toBe(t2(4));
    });
});
