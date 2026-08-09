# Parameter Reference

Complete list of all 26 simulation input parameters accepted by the CLI and the headless API.
Source of truth: `HEADLESS_DEFAULTS` in `js/core/headless-params.js`.

For CLI usage and subcommand options, see [CLI Usage Guide](../guide/cli-usage.md).

## Parameter Table

| Key | Type | Default | Description |
|---|---|---|---|
| `initialRiskAsset` | number | 100000000 | Initial risk assets (base currency unit) |
| `initialCashBuffer` | number | 10000000 | Initial cash buffer (base currency unit) |
| `monthlyExpense` | number | 300000 | Initial monthly withdrawal (base currency unit) |
| `expectedReturn` | number | 10.0 | Expected return (%) |
| `volatility` | number | 18.0 | Volatility (%) |
| `inflationRate` | number | 2.0 | Expected inflation rate (%) |
| `simYears` | number | 30 | Simulation years |
| `simPaths` | number | 10000 | Number of simulation paths (5000–50000) |
| `seedNum` | number | 123456 | Random seed |
| `currency` | string | "JPY" | Currency label ("JPY" or "USD") |
| `cashBufferToggle` | boolean | false | Enable cash buffer |
| `guardrailToggle` | boolean | false | Enable spending guardrail |
| `drawdownTrigger` | number | -20.0 | Cash drawdown threshold (%, ≤ 0) |
| `drawdownReplenish` | number | -5.0 | Replenishment release threshold (%, ≤ 0) |
| `replenishPace` | number | 5.0 | Replenishment pace multiplier (≥ 0) |
| `guardrailTrigger` | number | -20.0 | Guardrail trigger threshold (%, ≤ 0) |
| `guardrailReduction` | number | -20.0 | Spending reduction rate (%, ≤ 0) |
| `guardrailRelease` | number | -15.0 | Guardrail release threshold (%, ≤ 0) |
| `useTDistribution` | boolean | false | Use log-t distribution model |
| `simDfManual` | boolean | false | Manual degrees of freedom (false = auto) |
| `simDfNum` | number | 4.0 | Degrees of freedom (≥ 2.5) |
| `useArInflation` | boolean | false | Use AR-1 inflation model |
| `infVol` | number | 2.0 | Inflation volatility (%) |
| `infAr` | number | 0.5 | AR-1 coefficient (0–1.0) |
| `targetAssetRatio` | number | 100.0 | Target asset maintenance ratio (%, 0–500) |
| `percentiles` | number[] | [10,30,50,70,90] | Percentiles to compute (max 5 entries) |

## Notes

- All monetary values (`initialRiskAsset`, `initialCashBuffer`, `monthlyExpense`) are in base currency units. No unit conversion is applied by the simulator; pass dollar values as-is in USD mode.
- `currency` is a metadata label only. It does not affect any monetary calculation. See [Headless API Reference](./headless-api.md) for details.
- `cashBufferToggle` and `guardrailToggle` must be `true` for their associated parameters (`drawdownTrigger`, etc.) to take effect. The normalizer cross-validates these: if `guardrailTrigger > guardrailRelease` after sign normalization, `guardrailRelease` is adjusted automatically.
- `simDfManual: false` (default) means `simDfNum` is ignored and degrees of freedom are derived automatically from `volatility`.
- `percentiles` accepts up to 5 values in the range (0, 100) exclusive.
