# Headless API Reference

## Overview

`js/headless.js` provides a headless execution module that runs simulations in a single process without Web Workers.
It is designed primarily for use in Node.js environments and is called by the CLI (`cli.js`).

Computation results are bit-for-bit identical to the Worker-based version (`js/simulation-engine.js` + `js/worker.js`).

## Memory Warning

The module holds three Float32Array buffers (`totals`, `cashes`, `dds`) of size `simPaths × dataLen` each.
At 50,000 paths × 361 months (30 years), peak memory usage is approximately **350 MB**.
This is within the Node.js default heap limit (~1.5 GB), but be cautious with large-scale runs.

## Functions

### `runSimulationHeadless(params, percentiles, options)`

```js
import { runSimulationHeadless } from './js/headless.js';
```

#### Arguments

| Argument | Type | Default | Description |
|---|---|---|---|
| `params` | `Object` | (required) | Normalized simulation parameters. Must be produced by `normalizeHeadlessParams()`. |
| `percentiles` | `number[]` | `[10,30,50,70,90]` | Percentiles to compute (integers 1–99, max 5 entries). |
| `options` | `Object` | `{}` | Optional settings. |
| `options.onProgress` | Function | none | Progress callback `(percent: number) => void`. Called every 100 paths, and once more with `100` after the loop completes. |

#### Return Value

The return value of `aggregateResultsProduction()` with the following meta fields appended:

| Field | Type | Description |
|---|---|---|
| `successRate` | `number` | Success rate (%) |
| `finalMedian` | `number` | Median total assets at final month |
| `worst10MaxDd` | `number` | Worst 10th-percentile maximum drawdown |
| `worst5MaxDd` | `number` | Worst 5th-percentile maximum drawdown |
| `medianMaxUw` | `number` | Median longest stagnation period (months) |
| `worst10MaxUw` | `number` | Worst 10th-percentile longest stagnation period |
| `totalPercentileData` | `Float32Array[]` | Total assets percentile time series (pre-conversion) |
| `cashPercentileData` | `Float32Array[]` | Cash buffer percentile time series |
| `ddPercentileData` | `Float32Array[]` | Drawdown percentile time series |
| `maxDdPerPath` | `Float32Array` | Maximum drawdown per path |
| `maxUwPerPath` | `Float32Array` | Longest stagnation period per path |
| `targetAssetMaintainRate` | `number` | Target asset maintenance rate (%) |
| `usedSeed` | `number` | Seed value used |
| `modelType` | `'log-normal' \| 'log-t'` | Fluctuation model used |
| `usedDf` | `number` | Degrees of freedom used |
| `currency` | `'JPY' \| 'USD'` | Currency label (no conversion applied) |
| `dataLen` | `number` | Time series length (`simYears * 12 + 1`) |

> **Important**: `Float32Array` fields cannot be serialized by `JSON.stringify` directly.
> Apply `toPlain()` (implemented in `cli.js`) before JSON output.

## Parameter Normalization

### `normalizeHeadlessParams(raw)`

```js
import { normalizeHeadlessParams } from './js/core/headless-params.js';
```

Accepts a raw input object (flat JSON in base currency units), fills missing fields with
`HEADLESS_DEFAULTS`, and applies the same clamps and corrections used by `getParamsFromInputs`
and `comparison-runner`. Returns a fully normalized params object.

**Clamp aggregation layer**: `runSimulationHeadless` does NOT clamp. Always call this function first.

### `HEADLESS_DEFAULTS`

| Key | Default | Unit |
|---|---|---|
| `initialRiskAsset` | `100_000_000` | Base currency unit (JPY or USD) |
| `initialCashBuffer` | `10_000_000` | Base currency unit |
| `monthlyExpense` | `300_000` | Base currency unit |
| `expectedReturn` | `10.0` | % |
| `volatility` | `18.0` | % |
| `inflationRate` | `2.0` | % |
| `simYears` | `30` | years |
| `simPaths` | `10000` | paths |
| `seedNum` | `123456` | integer |
| `currency` | `'JPY'` | label string |
| `cashBufferToggle` | `false` | boolean |
| `guardrailToggle` | `false` | boolean |
| other booleans | `false` | — |

## Currency Notes

- `currency` is a label (metadata) only. It does not affect any monetary calculations.
- No fixed-rate conversion ($1 = 100 JPY) is applied.
- When running in USD mode, pass monetary values in dollar units as-is.

## Usage Example

```js
import { normalizeHeadlessParams } from './js/core/headless-params.js';
import { runSimulationHeadless } from './js/headless.js';

const params = normalizeHeadlessParams({
    initialRiskAsset: 100_000_000,  // 100M JPY
    monthlyExpense: 300_000,        // 300K JPY/month
    simPaths: 10000,
    seedNum: 123456,
});

const result = runSimulationHeadless(params, [10, 30, 50, 70, 90]);
console.log('Success rate:', result.successRate, '%');
console.log('Final median:', result.finalMedian, 'JPY');
```
