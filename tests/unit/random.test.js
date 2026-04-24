import { describe, it, expect } from 'vitest';
import { xoshiro128ss, createNormalGenerator } from '../../js/core/random.js';
describe('xoshiro128ss', () => {
    it('同一シードで同一シーケンスを生成する', () => {
        const rng1 = xoshiro128ss(123), rng2 = xoshiro128ss(123);
        for (let i=0;i<10;i++) expect(rng1()).toBe(rng2());
    });
});
describe('createNormalGenerator', () => {
    it('独立したキャッシュを持つ', () => {
        const rng1 = xoshiro128ss(1), rng2 = xoshiro128ss(1);
        const g1 = createNormalGenerator(rng1), g2 = createNormalGenerator(rng2);
        for (let i=0;i<10;i++) expect(g1()).toBe(g2());
    });
});