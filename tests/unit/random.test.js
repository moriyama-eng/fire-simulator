import { describe, it, expect } from 'vitest';
import { xoshiro128ss, createNormalGenerator } from '../../js/core/random.js';
describe('xoshiro128ss', () => {
    it('generates same sequence with same seed', () => {
        const rng1 = xoshiro128ss(123), rng2 = xoshiro128ss(123);
        for (let i=0;i<10;i++) expect(rng1()).toBe(rng2());
    });
});
describe('createNormalGenerator', () => {
    it('has independent caches', () => {
        const rng1 = xoshiro128ss(1), rng2 = xoshiro128ss(1);
        const g1 = createNormalGenerator(rng1), g2 = createNormalGenerator(rng2);
        for (let i=0;i<10;i++) expect(g1()).toBe(g2());
    });
});