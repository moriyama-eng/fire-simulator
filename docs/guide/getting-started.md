# Getting Started

Welcome to the FIRE Monte Carlo Simulator. This guide covers everything you need to run your first simulation.

## What is this tool?

The FIRE Monte Carlo Simulator is a browser-based personal asset accumulation and drawdown simulator. It uses the Monte Carlo method — thousands of randomly generated market scenarios — to estimate the probability that your savings will last through retirement.

## Three Ways to Use It

| Interface | Best For |
|---|---|
| **Browser UI** | Interactive exploration; adjusting parameters, reading charts |
| **Analysis / Comparison tabs** | Side-by-side scenario study; sensitivity analysis across up to 10 factors |
| **CLI / Headless** | Automation; batch runs; AI-agent workflows |

## Browser UI Quickstart

### 1. Open the simulator

Visit **[https://moriyama-eng.github.io/fire-simulator/](https://moriyama-eng.github.io/fire-simulator/)** — no installation required.

If running locally from a clone, use a live server (e.g., VS Code Live Server extension) because Web Workers require an HTTP origin.

### 2. Set your parameters

| Section | Key Parameters |
|---|---|
| **Asset Settings** | Initial risk assets, initial cash buffer, monthly withdrawal |
| **Market Settings** | Expected return (arithmetic mean, %), volatility (%), inflation rate (%) |
| **Simulation Settings** | Years, number of paths (5,000–50,000), random seed, percentile lines |

Hover the **ℹ️** icon next to any field for a tooltip explanation.

### 3. Run the simulation

Click **Run Simulation**. Results appear in the summary card and charts below.

### 4. Read the results

- **Success rate**: Percentage of simulation paths that did not run out of money before the end of the period.
- **Final total assets (median / P10)**: Asset level at the end of the simulation period for the median and the 10th-percentile (pessimistic) path.
- **Maximum drawdown (worst 10%)**: The 10th-percentile worst peak-to-trough decline across all paths.
- **CDF / CCDF charts**: Cumulative probability distributions showing how likely various drawdown depths and stagnation durations are.

## Analysis Tab

The Analysis tab runs sensitivity analysis over up to 10 pre-defined factors (see [Metrics Glossary](../reference/metrics-glossary.md) for factor definitions). It shows how much each factor would need to change to reach a target improvement.

## Cash Buffer and Guardrail Features

- **Cash Buffer**: Keeps a cash reserve. When total assets fall below a drawdown threshold, withdrawals come from the cash buffer instead of selling risk assets.
- **Guardrail**: Automatically reduces monthly spending when total assets fall below a drawdown threshold.

Both features are off by default. Enable them in their respective settings sections.

## CLI Quickstart

```bash
node cli.js run params.json
```

For the full parameter list and options, see [CLI Usage Guide](./cli-usage.md) and [Parameter Reference](../reference/parameter-reference.md).

## Language Switching

Use the **日本語 / English** buttons in the top-right corner to switch the UI language. The simulation logic is identical in both languages.
