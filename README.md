[English](./README.md) | [日本語](./README-ja.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/moriyama-eng/fire-simulator)

# FIRE Monte Carlo Simulator

A browser-based Monte Carlo simulator for exploring retirement asset sustainability under uncertain market returns, inflation, spending, and portfolio conditions.

---

## Overview

FIRE Monte Carlo Simulator is a browser-based tool that runs Monte Carlo simulations to explore retirement asset sustainability under user-defined financial assumptions.

Users provide inputs including initial assets, monthly spending, expected return, volatility, inflation rate, and related strategy settings. The simulator produces probabilistic retirement-asset outcomes across thousands of simulated paths.

The browser UI supports interactive exploration of results. The headless CLI provides reproducible single-run execution with JSON output. Detailed mathematics and operational rules are delegated to the existing documentation linked in the [Documentation](#documentation) section.

### Psychological Load

This simulator is designed around the psychological burden of the drawdown phase — the anxiety of watching invested assets decline after retirement — rather than around maximizing returns. Features such as the cash buffer, spending guardrail, and tail-risk visualization (maximum drawdown / stagnation period) all exist to make this psychological risk tangible and manageable.

---

## Screenshot

![FIRE Monte Carlo Simulator — Simulation tab with completed results](./docs/assets/readme/fire-simulator-overview.png)

---

## Simulation Model

The simulator uses **one simulation model** composed of the following seven concepts:

- **Log-normal return model** — Models standard asset return variability using a log-normal distribution. See [`docs/explanation/mathematical-model.md`](./docs/explanation/mathematical-model.md).
- **Ito drift adjustment** — Reconciles arithmetic expected return with geometric return reduced by volatility drag (volatility drag correction per Ito's Lemma). See [`docs/explanation/mathematical-model.md`](./docs/explanation/mathematical-model.md).
- **Log-t / Student-t return model** — Provides a heavier-tailed return distribution to capture fat-tail market risks that the log-normal model underestimates. See [`docs/explanation/mathematical-model.md`](./docs/explanation/mathematical-model.md).
- **AR-1 inflation model** — Models inflation dynamics using a first-order autoregressive (AR-1) process, capturing mean-reversion observed in historical inflation data. See [`docs/explanation/mathematical-model.md`](./docs/explanation/mathematical-model.md).
- **Cash-buffer dynamics** — Governs asset drawdown rules using a cash buffer: when total assets fall below a drawdown trigger threshold, spending is drawn from the cash buffer rather than directly from risk assets. See [`docs/explanation/decision-timing.md`](./docs/explanation/decision-timing.md).
- **Spending guardrail mechanics** — Adjusts monthly spending in response to drawdown events: spending is reduced when total assets fall below the guardrail trigger and restored when recovery conditions are met. See [`docs/explanation/decision-timing.md`](./docs/explanation/decision-timing.md).
- **Drawdown / stagnation measurement** — Measures and visualizes maximum drawdown from all-time highs and stagnation / recovery periods across simulated paths.

---

## Ways to Use It

**One simulation model, multiple ways to use it.**

### Browser UI

Available at [GitHub Pages](https://moriyama-eng.github.io/fire-simulator/) — no installation required.

- **Simulation** — Run the core Monte Carlo simulation interactively and explore probabilistic retirement-asset outcomes.
- **Analysis** — Analyze simulation results in depth within the browser UI.
- **Comparison** — Compare multiple scenarios side by side within the browser UI.

Analysis and Comparison are features within the Browser UI, not separate simulation engines.

### Headless CLI

The CLI provides headless access to the same simulation model without opening a browser. Two subcommands are available:

- **`run`** — Single-run simulation executor. Accepts a JSON parameter file and outputs full simulation results as JSON (including percentile time-series). Multi-run orchestration, parameter sweeps, graph generation, and format conversion are the caller's responsibility.
- **`list-factors`** — Outputs the factor definitions used by the Analysis UI. Useful for understanding or scripting against the factor schema without launching the browser.

For complete CLI documentation and examples, see the [CLI](#cli) section below.

<a name="currency-semantics"></a>
### Currency Semantics

| Execution Mode | Currency Conversion | Monetary Input/Output Units | Internal Calculation Unit |
|---|---|---|---|
| **Browser UI (English Mode)** | Display-only fixed rate ($1 = ¥100) | $1, ¥10K, ¥100M UI units | JPY |
| **CLI / Headless Mode** | None (label-only `currency` metadata) | Base currency units (JPY or USD as-is) | Base currency units |

---

## Features

1. **Monte Carlo retirement sustainability simulation** — Probabilistically evaluates retirement asset sustainability by simulating thousands of market return and spending paths to estimate the distribution of long-term asset outcomes.
2. **Log-normal and log-t return models** — Supports two return distribution models: a log-normal model for standard return variability and a log-t (Student-t) model for heavier-tailed distributions that better capture fat-tail market risks.
3. **Cash-buffer management** — Controls asset drawdown using a cash buffer strategy: when total assets fall below a threshold, spending is drawn from the buffer rather than directly liquidating risk assets.
4. **Spending guardrails** — Automatically reduces spending when drawdown exceeds the guardrail trigger threshold and restores spending when recovery conditions are met.
5. **Ito drift adjustment** — Reconciles arithmetic expected return with the geometric return reduced by volatility drag, using Ito's Lemma to ensure mathematically consistent drift inside the simulation.
6. **Drawdown and stagnation analysis** — Measures and visualizes maximum drawdown from all-time highs and stagnation / recovery periods using cumulative probability distribution charts (CDF/CCDF).
7. **Tail-risk and AR-1 inflation modeling** — Captures fat-tail return risk via the log-t distribution and models inflation dynamics using a first-order autoregressive (AR-1) process referencing statistical inflation characteristics.
8. **Headless CLI execution (single-run executor with JSON output)** — The CLI `run` subcommand executes a single simulation run in headless mode and outputs full results as JSON, enabling automation and downstream analysis without a browser.

---

## Privacy

### Local Processing

All simulation calculations are performed in the browser. No simulation inputs or results are sent to a server as part of normal simulation execution.

### External Resources

The application loads the following external libraries at runtime:

- [Chart.js](https://www.chartjs.org/) — chart rendering
- [SortableJS](https://sortablejs.github.io/Sortable/) — drag-and-drop UI
- [html2canvas](https://html2canvas.hertzen.com/) — in-browser screenshot export

Loading these external libraries is distinct from any transmission of simulation input data or results.

### Explicit Sharing

The Share URL feature encodes simulation settings — including parameter values, seed, percentiles, language, and other reproduction-related URL parameters — directly into the URL as query parameters. Recipients who open the URL can reproduce the same simulation conditions in their own browser. No result data is uploaded to or stored on a server.

### Automatic Transmission

Simulation inputs and results are not automatically uploaded to a server during normal simulation execution.

---

## Deliberate Scope

The following are intentional scope limitations, not planned future features:

- **Taxation** — Tax rules are highly jurisdiction- and individual-specific. Embedding them would blur the model's focus and make results harder to interpret independently of local tax context.
- **Variable foreign-exchange modeling** — Currency exchange modeling is outside the scope of this simulator. Monetary values are treated in a single base currency unit.
- **Social security / pension systems** — Pension and social security systems vary significantly across jurisdictions and individual situations and are intentionally excluded to preserve a self-contained, clearly bounded model.

---

## Documentation

| Document | Description |
|---|---|
| [Overview](./docs/guide/overview.md) | Product overview: psychological load, privacy, deliberate scope, and disclaimer |
| [Getting Started](./docs/guide/getting-started.md) | Local development setup and running the simulator |
| [CLI Usage Guide](./docs/guide/cli-usage.md) | CLI subcommands, parameters, and examples |
| [Headless API Reference](./docs/reference/headless-api.md) | Headless API schema and output format |
| [Parameter Reference](./docs/reference/parameter-reference.md) | Full parameter definitions and valid ranges |
| [Mathematical Model](./docs/explanation/mathematical-model.md) | Return models, Ito drift, AR-1 inflation mathematics |
| [Decision Timing](./docs/explanation/decision-timing.md) | Monthly processing order, cash buffer, and guardrail mechanics |
| [Testing](./tests/README.md) | Testing documentation entry point |
| [Changelog (EN)](./CHANGELOG.md) | Full English update history |
| [Changelog (JA)](./CHANGELOG-ja.md) | Full Japanese update history |

---

## Version / Update History

**Current release: v2.8.4**

For the full update history, see [CHANGELOG.md](./CHANGELOG.md).

---

## CLI

The CLI provides headless simulation execution using the same simulation model as the Browser UI.

```bash
# Single-run simulation — outputs results to a JSON file
node cli.js run params.json

# Output results to stdout instead of a file
node cli.js run params.json --stdout

# Specify a custom output path
node cli.js run params.json --out .agent/scratch/my-result.json


# List factor definitions used by the Analysis UI
node cli.js list-factors
```

### Subcommands

**`run`** — Executes a single simulation run using the provided parameter JSON file. Outputs full simulation results (including percentile time-series) as JSON. Multi-run orchestration, parameter sweeps, graph generation, scenario comparison, and CSV conversion are the caller's responsibility.

**`list-factors`** — Outputs the factor definitions used by the Analysis UI. No simulation is run; this is an information output command for scripting or inspection.

For complete documentation, parameter schema, and advanced options, see:
- [CLI Usage Guide](./docs/guide/cli-usage.md)
- [Headless API Reference](./docs/reference/headless-api.md)

---

## Disclaimer

This tool was created for personal learning and verification purposes, and does not guarantee future investment performance. The author cannot be held responsible for any damages arising from investment decisions or asset management based on simulation results. Make your final investment decisions at your own responsibility. This does not guarantee the optimal strategy for the type and period of invested assets or individual financial situations.

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
