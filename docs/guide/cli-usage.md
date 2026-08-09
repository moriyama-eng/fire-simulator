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

All three output modes (stdout / file / summary) include the following provenance fields:

- **`params`**: Complete normalized input snapshot, whitelist-picked from `HEADLESS_DEFAULTS` keys. Values are post-clamp (normalized). See [Round-Trip Reproducibility](#round-trip-reproducibility) below.
- **`meta`**: Tool provenance metadata — `toolVersion` (semver string) and `generatedAt` (ISO 8601 UTC, `YYYY-MM-DDTHH:mm:ss.sssZ`).

The summary mode additionally includes:

- **`percentiles`** (top-level): The normalized percentiles array used in the run (e.g., `[10, 30, 50, 70, 90]`).

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
  "percentiles": [10, 30, 50, 70, 90],
  "params": {
    "initialRiskAsset": 100000000,
    "initialCashBuffer": 10000000,
    "monthlyExpense": 300000,
    "expectedReturn": 10.0,
    "volatility": 18.0,
    "inflationRate": 2.0,
    "simYears": 30,
    "simPaths": 10000,
    "drawdownTrigger": -20.0,
    "drawdownReplenish": -5.0,
    "replenishPace": 5.0,
    "guardrailTrigger": -20.0,
    "guardrailReduction": -20.0,
    "guardrailRelease": -15.0,
    "infVol": 2.0,
    "infAr": 0.5,
    "simDfNum": 4.0,
    "seedNum": 123456,
    "targetAssetRatio": 100.0,
    "cashBufferToggle": false,
    "guardrailToggle": false,
    "useArInflation": false,
    "useTDistribution": false,
    "simDfManual": false,
    "currency": "JPY"
  },
  "meta": {
    "toolVersion": "2.6.0",
    "generatedAt": "2026-08-02T14:00:00.000Z"
  },
  "dataLen": 361
}
```

**File (full result)**: In addition to the scalar summary, outputs a JSON file containing complete
time-series data: `totalPercentileData`, `cashPercentileData`, `ddPercentileData`, `maxDdPerPath`, etc.
The file also includes `params` and `meta` with the same provenance fields described above.

> **Note**: `.temp/fire-sim/` is gitignored. If `--out` points outside `.temp/`,
> the file will NOT be gitignored (user responsibility).

#### Currency field semantics

Two `currency` fields appear in the output and have distinct meanings:

| Field | Source | Meaning |
|---|---|---|
| Top-level `currency` | `simResult.currency` (calculation result) | Currency actually used during the simulation run |
| `params.currency` | `normalizeHeadlessParams()` output | Input parameter snapshot (post-normalization) |

Both fields are preserved in output. They should always agree, but keeping them separate avoids conflating input snapshots with computation results.

---

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

For a complete description of all 26 parameters, see [Parameter Reference](../reference/parameter-reference.md).

## Round-Trip Reproducibility

The CLI output is designed so that the exact same simulation run can be reproduced from the output JSON alone. This enables downstream AI agents or scripts to replay any past run without external state.

### How to reproduce a run

1. Take the output JSON from any run mode (summary, file, or `--stdout`).
2. Spread the top-level `params` object to the top level of a new input JSON.
3. Attach the top-level `percentiles` array (from summary or `--stdout` mode) to the new input.
4. Feed the reconstructed JSON into `cli.js run`.

```bash
# First run
node cli.js run original.json --no-file > summary.json

# Reconstruct input for reproduction (example using jq)
jq '(.params) + {percentiles: .percentiles}' summary.json > reproduce.json

# Reproduce — yields identical usedSeed and all scalar metrics
node cli.js run reproduce.json --no-file
```

> **Note**: The input parser does NOT automatically unwrap nested `params` objects.
> The caller is responsible for spreading `params` to the top level when reconstructing input.

### Why clamp-idempotency guarantees reproducibility

The `params` snapshot in the output contains post-clamp (normalized) values. Running
`normalizeHeadlessParams()` on already-clamped values is idempotent — applying clamps
twice yields the same result as applying them once. This means reproduction via
round-trip is guaranteed to produce bit-identical results.

## CLI Responsibility Boundary (Design Policy)

This section documents deliberate design decisions that define what the CLI is
**not** responsible for. These are final decisions; do not re-propose them.

### Intentionally excluded features

The following features are explicitly out of scope for `cli.js`. They are either
the caller's (AI agent's) responsibility or excluded to avoid double-maintenance cost.

| Feature | Reason for exclusion |
|---|---|
| `analyze` subcommand | Caller (AI agent) responsibility — post-processing of output JSON |
| `compare` subcommand | Caller responsibility — diff of two output JSONs |
| `sweep` subcommand | Caller responsibility — loop over parameter ranges |
| CSV / graph output | Caller responsibility — format conversion from JSON |
| Full per-path time-series output | Memory / file size concern; raw path data is not aggregated |
| `--schema` (machine-readable input schema) | Double-maintenance cost; `HEADLESS_DEFAULTS` in source is the canonical schema |
| Input auto-unwrap (`params` nesting) | Caller responsibility — reconstructing flat input from output JSON |

### Rationale

The CLI's role is a **single-run executor**: accept flat JSON params → normalize → simulate → emit JSON results.
All orchestration, analysis, comparison, and format conversion belong to the caller.
This boundary keeps the CLI small, testable, and free of framework dependencies.

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
