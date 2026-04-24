// ====================================================================
// js/core/random.js
// ====================================================================

export function splitmix32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x9e3779b9) | 0;
        let t = s ^ (s >>> 16);
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ (t >>> 15);
        t = Math.imul(t, 0x735a2d97);
        return (t = (t ^ (t >>> 15)) >>> 0);
    };
}

export function xoshiro128ss(seed) {
    const sm = splitmix32(seed);
    let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
    const rotl = (x, k) => (x << k) | (x >>> (32 - k));
    return function () {
        const result = (Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0) / 4294967296.0;
        const t = s1 << 9;
        s2 ^= s0;
        s3 ^= s1;
        s1 ^= s2;
        s0 ^= s3;
        s2 ^= t;
        s3 = rotl(s3, 11);
        return result;
    };
}

export function createNormalGenerator(uniformRng) {
    let hasCached = false;
    let cached = 0.0;
    return function () {
        if (hasCached) {
            hasCached = false;
            return cached;
        }
        let u = 0, v = 0;
        while (u === 0) u = uniformRng();
        while (v === 0) v = uniformRng();
        const r = Math.sqrt(-2.0 * Math.log(u));
        const theta = 2.0 * Math.PI * v;
        cached = r * Math.sin(theta);
        hasCached = true;
        return r * Math.cos(theta);
    };
}

export function createGammaGenerator(uniformRng, normalGen) {
    return function gammaRand(alpha) {
        if (alpha <= 0.0) return 0.0;
        let a = alpha;
        if (alpha < 1.0) a = alpha + 1.0;
        const d = a - 1.0 / 3.0;
        const c = 1.0 / Math.sqrt(9.0 * d);
        let v, x;
        while (true) {
            x = normalGen();
            v = 1.0 + c * x;
            while (v <= 0.0) { x = normalGen(); v = 1.0 + c * x; }
            v = v * v * v;
            const u = uniformRng();
            const x2 = x * x;
            if (u < 1.0 - 0.0331 * x2 * x2) break;
            if (Math.log(u) < 0.5 * x2 + d * (1.0 - v + Math.log(v))) break;
        }
        let res = d * v;
        if (alpha < 1.0) {
            let u2 = uniformRng();
            while (u2 === 0) u2 = uniformRng();
            res *= Math.pow(u2, 1.0 / alpha);
        }
        return res;
    };
}

export function createTGenerator(normalGen, gammaRand) {
    return function randomT(df) {
        const Z = normalGen();
        const chi2 = 2.0 * gammaRand(df / 2.0);
        return Z / Math.sqrt(chi2 / df);
    };
}