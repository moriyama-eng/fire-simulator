# Analysis Methodology

This document explains how the Sensitivity Analysis tab computes and displays results.

Source files: `js/analysis-runner.js`, `js/analysis-ui.js`.

## Overview

The Analysis tab runs a one-factor-at-a-time (OAT) sensitivity analysis. For each selected factor, it runs up to 4 additional simulations (all other factors held constant), then displays how each metric changes across the factor range.

## Factor Levels and the 5-Level Scale

Each factor is varied across 5 levels: `[-2, -1, 0, +1, +2]` (defined in `js/analysis-runner.js`, line 78).

- **Level 0** is the baseline. It is **skipped** during the loop because the baseline simulation has already been run separately and its results are stored as `baseScenario`. Only levels `[-2, -1, +1, +2]` produce new simulations — a total of 4 simulations per factor.
- The value applied at each level is: `baseValue + factor.step × level` (in UI units).

From `js/analysis-runner.js`:
```javascript
for (const level of [-2, -1, 0, 1, 2]) {
    if (level === 0) continue; // Skip baseline (already executed)
    applyFactorChange(modifiedEp, factor, baseValue + factor.step * level);
    ...
}
```

## Unit Scaling (`applyFactorChange`)

Each factor definition includes a `scale` field that converts UI units to raw simulation units.
For example, `initial_risk_asset_jpy` uses `scale: 1e8` (1 億), so a UI value of `1.0` maps to `100,000,000` in the parameter.

```javascript
// js/analysis-runner.js
export function applyFactorChange(ep, factor, value) {
    const scaledValue = factor.scale && factor.scale !== 1
        ? Math.round(value * factor.scale)
        : value;
    ep[factor.paramKey] = scaledValue;
}
```

The 10 factors and their steps are listed in [Metrics Glossary](../reference/metrics-glossary.md).

## Linear Interpolation for the Target Table

The "Target Table" shows how much each factor must change to move a chosen metric (e.g., success rate) by a target improvement (e.g., +5 percentage points).

The calculation uses **linear interpolation** between the two adjacent scenario points that bracket the target value:

From `js/analysis-ui.js`:
```javascript
const fraction = (targetValue - lower.metricValue) / (upper.metricValue - lower.metricValue);
const requiredFactorValue = lower.factorValue + fraction * (upper.factorValue - lower.factorValue);
```

If the target is outside the range of the 5 scenario points (base + 4 variants), the row shows "Out of range."

## Trend Judgment (Compare Cards)

The per-factor comparison cards show the direction and magnitude of each factor's effect.
The displayed values are the raw metric readings at each of the 4 non-baseline levels;
no additional trend-fitting is applied — the sign of the change relative to the base is used directly to color the delta (green = improvement, red = degradation based on the metric direction).

## Progress Reporting

Total scenarios = 1 (base) + Σ(4 per selected factor). Progress is reported via `onProgress({ done, total })` after each simulation completes, allowing the UI to update a progress bar in real time.
