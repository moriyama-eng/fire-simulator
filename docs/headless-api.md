# Headless API / CLI

Browser-free execution of the Monte Carlo simulation. Intended for terminal use and
for automated parameter-search loops (e.g. by AI agents).

## Modules

- `js/headless.js`
  - `runSimulationHeadless(params, percentiles?)` — runs all paths synchronously
    (no Web Worker, no `navigator`, no DOM) and returns the same result object shape as
    `runSimulation` in `js/simulation-engine.js`. Default percentiles: `[10, 25, 50, 75, 90]`.
  - `normalizeLegacyParams(raw)` — fills missing keys and applies the same clamps as
    `getParamsFromInputs`.
  - `LEGACY_DEFAULTS` — defaults expressed in the legacy (yen) unit system.
- `js/core/factors.js` — `FACTORS`, the sensitivity-analysis factor definitions
  (also re-exported by `js/analysis-state.js`).

## Units: legacy (yen) format

`runSimulationHeadless` expects the **legacy / canonical yen-unit** parameter format —
the same shape produced by `getParamsFromInputs` (`js/core/params.js`) and
`convertToLegacyParams` (`js/analysis-runner.js`).

This is **not** the UI display unit system used by `DEFAULTS` in `js/core/params.js`
(where `initialRiskAsset: 1.0` means 1 oku yen). Conversions:

| Parameter | UI display unit | Legacy value |
| --- | --- | --- |
| `initialRiskAsset` | oku yen (`1.0`) | `× 100_000_000` → `100000000` |
| `initialCashBuffer` | man yen (`1000`) | `× 10_000` → `10000000` |
| `monthlyExpense` | man yen (`30`) | `× 10_000` → `300000` |

All other parameters (percentages, years, counts, seeds) are unchanged.

## Parameter JSON schema

All keys are optional; missing keys fall back to `LEGACY_DEFAULTS`.

| Key | Type | Default (legacy) | Clamp |
| --- | --- | --- | --- |
| `initialRiskAsset` | number (yen) | `100000000` | — |
| `initialCashBuffer` | number (yen) | `10000000` | forced to `0` when `cashBufferToggle` is `false` |
| `monthlyExpense` | number (yen) | `300000` | — |
| `expectedReturn` | number (%) | `10.0` | — |
| `volatility` | number (%) | `18.0` | — |
| `inflationRate` | number (%) | `2.0` | — |
| `simYears` | number | `30` | — |
| `simPaths` | number | `10000` | `max(5000, min(50000, round(x)))` |
| `cashBufferToggle` | boolean | `true` | — |
| `drawdownTrigger` | number (%) | `-20.0` | `min(0, x)` |
| `drawdownReplenish` | number (%) | `-5.0` | `min(0, x)` |
| `replenishPace` | number (× expense) | `5.0` | `max(0, x)` |
| `guardrailToggle` | boolean | `false` | — |
| `guardrailTrigger` | number (%) | `-20.0` | `min(0, x)` |
| `guardrailReduction` | number (%) | `-20.0` | `min(0, x)` |
| `guardrailRelease` | number (%) | `-15.0` | `min(0, x)` |
| `useArInflation` | boolean | `false` | — |
| `infVol` | number (%) | `2.0` | — |
| `infAr` | number | `0.5` | — |
| `useTDistribution` | boolean | `true` | — |
| `simDfManual` | boolean | `false` | when `false`, df is derived from volatility (`calcAutoDf`) |
| `simDfNum` | number | `4.0` | `max(2.5, x)` |
| `useFixedSeed` | boolean | `true` | — |
| `seedNum` | number | `123456` | — |
| `targetAssetRatio` | number (%) | `100.0` | `0..500` |

Note: `normalizeLegacyParams` enforces the `simPaths` lower bound of 5000. To run fewer
paths (e.g. for fixture comparison), override after normalization:
`{ ...normalizeLegacyParams(raw), simPaths: 1000 }`.

## CLI

```bash
node cli.js run params.json                  # or: npm run simulate -- run params.json
cat params.json | node cli.js run
node cli.js run params.json --percentiles 10,30,50,70,90
node cli.js --list-factors                   # FACTORS definitions as JSON
node cli.js --defaults                       # LEGACY_DEFAULTS as JSON
node cli.js --help
```

After `npm link` / global install, the `fire-sim` bin is available:
`fire-sim run params.json`.

Example `params.json`:

```json
{
  "initialRiskAsset": 100000000,
  "initialCashBuffer": 10000000,
  "monthlyExpense": 300000,
  "expectedReturn": 10.0,
  "volatility": 18.0,
  "simYears": 30,
  "simPaths": 5000,
  "cashBufferToggle": true,
  "seedNum": 123456
}
```

## Result JSON schema

The CLI prints `{ "params": <normalized params>, "result": <result> }`. All
`Float32Array` values are converted to plain arrays with `Array.from()` before output.

| Field | Type | Description |
| --- | --- | --- |
| `percentiles` | number[] | Percentiles used for aggregation |
| `totalPercentileData` | number[][] | `[percentileIndex][month]` total assets (yen), length `dataLen` |
| `cashPercentileData` | number[][] | Cash buffer balance per percentile/month (yen) |
| `ddPercentileData` | number[][] | Drawdown per percentile/month (ratio, ≤ 0) |
| `successRate` | number | Non-bankrupt paths (%) |
| `finalMedian` | number | Median final total assets (yen) |
| `worst10MaxDd` / `worst5MaxDd` | number | 10th / 5th percentile of per-path max drawdown |
| `medianMaxUw` / `worst10MaxUw` | number | Median / 90th percentile of max underwater months |
| `maxDdPerPath` | number[] | Max drawdown per path (length `simPaths`) |
| `maxUwPerPath` | number[] | Max underwater months per path |
| `belowInitPeriods` | number[] | Longest consecutive months below initial total assets, per path |
| `consecutiveSellPeriods` | number[] | Longest consecutive risk-asset selling months, per path |
| `params` | `{ simPaths, totalMonths }` | Run size metadata |
| `dataLen` | number | `simYears * 12 + 1` |
| `targetAssetMaintainRate` | number | Paths whose final assets ≥ target threshold (%) |
| `targetAssetRatio` | number | Echo of the input ratio (%) |
| `usedSeed` | number | Seed actually used |
| `modelType` | `"log-t"` \| `"log-normal"` | Return model |
| `usedDf` | number | Degrees of freedom actually used |
