[English](./README.md) | [日本語](./README-ja.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/moriyama-eng/fire-simulator)

# FIRE Monte Carlo Simulator (v2.4.2)

This tool is a personal asset accumulation and drawdown simulator that can be easily run in a browser without any installation. It was created with the goal of visualizing the risk of running out of invested assets and long-term asset trends using a probabilistic approach (Monte Carlo simulation).

## Features

- **Fat-tail risk-aware fluctuation model (log-t distribution)**  
  You can select the log-t distribution model, which accounts for "fat-tail risks" that can occur in real financial markets — such as a "Lehman shock-level crash" — that tend to be underestimated by conventional normal distribution models.
- **Risk simulation based on statistical price fluctuation models**  
  Using a log-normal distribution model or a log-t distribution model as the price fluctuation model, the tool simulates the progression of market prices based on the configured expected return and volatility.
- **Introduction of a cash buffer feature**  
  It is possible to simulate a "cash buffer strategy" that automatically draws from a cash buffer when the total assets fall by a certain percentage from their all-time high. This is useful for verifying specific operational guidelines for improving crash resilience.
- **Introduction of drawdown spending reduction (spending guardrail feature)**  
  It is possible to simulate a "spending guardrail strategy" that automatically reduces spending from the following month when total assets fall by a certain percentage from their all-time high. This is useful for verifying specific operational guidelines for improving crash resilience.
- **Rigorous drift adjustment based on Ito's Lemma (Ito Calculus)**  
  The input parameter "expected return" is redefined as the arithmetic mean. The phenomenon where the geometric mean return decreases due to volatility (volatility drag) is now mathematically correctly handled inside the simulation.
- **Visualization of tail risks (maximum drawdown / stagnation period)**  
  In addition to simple asset progression, the worst-case drawdown and time to recovery can be intuitively grasped using cumulative probability distribution graphs (CDF/CCDF).
- **Inflation fluctuation model (AR-1 model)**  
  In addition to a simple fixed inflation rate, an AR-1 (autoregressive) model referencing the characteristics of statistical data (such as US CPI) can be selected.
- **Headless / Command-line interface (CLI)**  
  Run simulations directly from the terminal without a browser. Ideal for automation, batch processing, and parameter sweeps. Outputs full JSON results (including percentile time-series) for further analysis. See the [CLI Usage Guide](./docs/cli-usage.md) for details and examples.

## Currency Semantics

| Execution Mode | Currency Conversion | Monetary Input/Output Units | Internal Calculation Unit |
|---|---|---|---|
| **Browser UI (English Mode)** | Display-only fixed rate ($1 = ¥100) | $1, ¥10K, ¥100M UI units | JPY |
| **CLI / Headless Mode** | None (label-only `currency` metadata) | Base currency units (JPY or USD as-is) | Base currency units |

## Update History

### Latest Highlights (v2.4.2)
- Unified null value display to `label: —` in Total Asset chart tooltips and extracted pure formatting helper.
- Removed `(experimental)` label from language switcher button and separated update history to CHANGELOG.

For detailed past change logs, see [CHANGELOG.md](./CHANGELOG.md). For details on monthly processing order, see [docs/decision-timing.md](./docs/decision-timing.md).

## Development Background

I am a mechanical designer by profession and not a financial expert, but I developed this simulator because I needed a tool that could intuitively perform complex calculations in a browser to more realistically assess the risks of my own asset formation. I hope it will be a reference for those who are also aiming for FIRE.

## Usage

> [!TIP]
> **[Run the simulator now (GitHub Pages)](https://moriyama-eng.github.io/fire-simulator/)**
> No installation or environment setup required; you can use it as is.

When running by cloning the repository in a local environment, it is highly likely that it will not work by directly opening `index.html` in a browser due to the use of Web Workers (due to security restrictions). If you are using VS Code, install the **Live Server extension**, right-click `index.html`, select "Open with Live Server", and verify operation in the browser that opens.

### Command-line Interface (CLI)

Run simulations in headless mode without opening a browser.

```bash
# Basic usage
node cli.js run params.json

# Full result to stdout (no file)
node cli.js run params.json --stdout

# Custom output directory
node cli.js run params.json --out .temp/my-result.json
```

For complete CLI documentation, parameter schema, and advanced options, see the **[CLI Usage Guide](./docs/cli-usage.md)** and **[Headless API Reference](./docs/headless-api.md)**.

### Testing

This project uses two layers of automated testing with Vitest:

- **Unit tests** (`tests/unit/` — 15 files): Verifies the correctness of pure functions and core logic
- **Integration tests** (`tests/integration/` — 5 files): Verifies DOM operations and UI state transitions

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific tests only
npx vitest run tests/unit/format.test.js
```

For the test design philosophy and how to add tests, refer to [`tests/README.md`](./tests/README.md).

In CI, GitHub Actions automatically runs tests on push to the `main` branch and pull requests, preventing regressions.

## Disclaimer

This tool was created for personal learning and verification purposes, and does not guarantee future investment performance. The author cannot be held responsible for any damages arising from investment decisions or asset management based on simulation results. Make your final investment decisions at your own responsibility. This does not guarantee the optimal strategy for the type and period of invested assets or individual financial situations.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
