# CLI Usage Guide

## Overview

`cli.js` is the command-line interface for the FIRE Monte Carlo Simulator.
Node.js >= 18 is required.

## Installation (global)

```bash
npm install -g .
fire-sim --help
```

Or run directly:

```bash
node cli.js --help
```

## Subcommands

### `run` — Run simulation (default)

```bash
node cli.js run <params.json> [options]
```

Run a simulation using the specified parameter JSON file.
If no file is specified, parameters are read from stdin.

```bash
# File input
node cli.js run my-params.json

# Stdin input
cat my-params.json | node cli.js run
```

#### Options

| Option | Description |
|---|---|
| `--stdout` | Output full result to stdout. No file is written (overrides `--out`). |
| `--out <path>` | Specify output file path. Default: `.temp/fire-sim/run-<timestamp>-seed<seed>.json`. |
| `--no-file` | Skip file write. Only output scalar summary to stdout. |
| `--compact` | Output JSON without indentation (single line). |

#### Output

- **When `--stdout` is specified**: Outputs the complete result JSON to stdout. The `outputFile` field is **omitted** from this output, and no file is written.
- **When `--stdout` is NOT specified**: Outputs a scalar summary JSON to stdout. This summary object **always includes** the `outputFile` field (`null` when `--no-file` is specified, or a file path string otherwise).

**stdout (scalar summary)**:

```json
{
  "successRate": 92.5,
  "finalMedian": 485000000,
  "worst10MaxDd": -0.85,
  "worst5MaxDd": -1.0,
  "medianMaxUw": 108,
  "worst10MaxUw": 315,
  "targetAssetMaintainRate": 88.3,
  "usedSeed": 123456,
  "modelType": "log-normal",
  "usedDf": 4.2,
  "currency": "JPY",
  "outputFile": "/path/to/.temp/fire-sim/run-...-seed123456.json",
  "params": { "simPaths": 10000, "simYears": 30, ... },
  "dataLen": 361
}
```

**File (full result)**: In addition to the scalar summary, outputs a JSON file containing complete
time-series data: `totalPercentileData`, `cashPercentileData`, `ddPercentileData`, `maxDdPerPath`, etc.

> **Note**: `.temp/fire-sim/` is gitignored. If `--out` points outside `.temp/`,
> the file will NOT be gitignored (user responsibility).


### `list-factors` — Output factor definitions

```bash
node cli.js list-factors
node cli.js --list-factors
```

Outputs the factor definitions (`FACTORS`) used by the Analysis tab as JSON.
All properties are output as-is. i18n keys (e.g., `labelKey`) are not resolved —
raw key strings are output instead of translated display names.

## Parameter JSON Specification

### Input Units

**All monetary values must be specified in base currency units (JPY or USD).**
No conversion from "hundred-million yen" or "ten-thousand yen" UI units is performed.
No fixed-rate conversion ($1 = 100 JPY) is applied.

### Input Example (JPY)

```json
{
  "initialRiskAsset": 100000000,
  "initialCashBuffer": 10000000,
  "monthlyExpense": 300000,
  "expectedReturn": 10.0,
  "volatility": 18.0,
  "inflationRate": 2.0,
  "simYears": 30,
  "simPaths": 10000,
  "seedNum": 123456,
  "currency": "JPY",
  "cashBufferToggle": false,
  "guardrailToggle": false
}
```

### Input Example (USD)

```json
{
  "initialRiskAsset": 1000000,
  "monthlyExpense": 3000,
  "simYears": 30,
  "simPaths": 10000,
  "currency": "USD"
}
```

### Parameter Reference

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

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Input error (file not found, JSON parse failure, TTY stdin, invalid percentiles) |
| `2` | Runtime error (simulation failure, file write failure) |

## Examples

```bash
# Basic run
node cli.js run params.json

# Full result to stdout only
node cli.js run params.json --stdout

# Custom output path
node cli.js run params.json --out .temp/my-result.json

# Skip file write (summary only)
node cli.js run params.json --no-file

# Compact (single-line) JSON output
node cli.js run params.json --compact

# List factor definitions
node cli.js list-factors

# Show version
node cli.js --version

# Show help
node cli.js --help

# Via npm script
npm run simulate -- run params.json
```
