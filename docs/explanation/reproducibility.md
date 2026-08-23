# Reproducibility and Random Number Generation

The simulator guarantees **bit-for-bit reproducibility**: running the same parameters with the same seed always produces identical output, regardless of environment or invocation count.

## RNG Pipeline

The random number generation pipeline in `js/core/random.js` has four layers:

### 1. `splitmix32` — Seed Expansion

A 32-bit hash function used to expand a single integer seed into four independent 32-bit state words for xoshiro128**:

```javascript
// js/core/random.js
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
```

### 2. `xoshiro128**` — Uniform Random Numbers

The primary uniform RNG. Its four 32-bit state words are initialized by four calls to `splitmix32`. It passes BigCrush and has a period of \(2^{128} - 1\):

```javascript
export function xoshiro128ss(seed) {
    const sm = splitmix32(seed);
    let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
    ...
    return function () {
        const result = (Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0) / 4294967296.0;
        ...
    };
}
```

Output: uniformly distributed floats in `[0, 1)`.

### 3. Box-Muller Transform — Normal Distribution

Pairs of uniform samples are converted to standard-normal draws using the Box-Muller transform. The implementation caches one of the two outputs to halve RNG calls:

```javascript
export function createNormalGenerator(uniformRng) {
    let hasCached = false; let cached = 0.0;
    return function () {
        if (hasCached) { hasCached = false; return cached; }
        let u = 0, v = 0;
        while (u === 0) u = uniformRng();
        while (v === 0) v = uniformRng();
        const r = Math.sqrt(-2.0 * Math.log(u));
        const theta = 2.0 * Math.PI * v;
        cached = r * Math.sin(theta); hasCached = true;
        return r * Math.cos(theta);
    };
}
```

### 4. Marsaglia-Tsang / Student-t — Fat-Tail Draws

When `useTDistribution: true`, Student-t draws are generated using the **definition-based representation**: a standard normal `Z` divided by the square root of an independent chi-squared variate scaled by its degrees of freedom. The chi-squared variate is produced by `createGammaGenerator` (Marsaglia-Tsang Gamma algorithm), and the t-variate is:

```javascript
export function createTGenerator(normalGen, gammaRand) {
    return function randomT(df) {
        const Z = normalGen();
        const chi2 = 2.0 * gammaRand(df / 2.0);
        return Z / Math.sqrt(chi2 / df);
    };
}
```

This is then scaled in `simulation.js` to unit variance:
```javascript
Z = tRand / Math.sqrt(simDf / (simDf - 2));   // requires df > 2
```

## Why Bit-Identical Results Are Guaranteed

1. **Deterministic seed expansion**: `splitmix32` is a pure function; same seed → same xoshiro128** state.
2. **No floating-point non-determinism**: All arithmetic uses standard IEEE 754 double-precision operations. No `Math.random()` is used anywhere in the simulation.
3. **Fixed call order**: The RNG is called in a strict, deterministic sequence each month (one normal draw for AR-1 inflation if enabled, followed by one normal draw or one Student-t draw using normal + gamma generators for market return).
4. **Clamp idempotency**: `normalizeHeadlessParams()` is idempotent — applying it twice to already-clamped values produces the same result. This is what makes round-trip CLI reproducibility work.

## Reproducibility Test

`tests/unit/simulation.test.js` compares the simulator's current output against a golden reference (`tests/fixtures/reference-results.json`) generated at v1.8.3. Any change to the core RNG or simulation loop would break this test.

For the headless API, `tests/unit/headless.test.js` (T1, T2, T8) verifies:
- Bit-for-bit match against `tests/fixtures/headless-reference-results.json`.
- Two runs with identical params produce identical results.
- Worker-based and headless execution produce identical output.
