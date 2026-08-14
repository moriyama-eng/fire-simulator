# Overview

FIRE Monte Carlo Simulator is a browser-based tool that runs Monte Carlo simulations to explore retirement asset sustainability under user-defined financial assumptions.

Users provide inputs including initial assets, monthly spending, expected return, volatility, inflation rate, and related strategy settings. The simulator produces probabilistic retirement-asset outcomes across thousands of simulated paths.

The browser UI supports interactive exploration of results. The headless CLI provides reproducible single-run execution with JSON output.

### Psychological Load

This simulator is designed around the psychological burden of the drawdown phase — the anxiety of watching invested assets decline after retirement — rather than around maximizing returns. Features such as the cash buffer, spending guardrail, and tail-risk visualization (maximum drawdown / stagnation period) all exist to make this psychological risk tangible and manageable.

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

## Deliberate Scope

The following are intentional scope limitations, not planned future features:

- **Taxation** — Tax rules are highly jurisdiction- and individual-specific. Embedding them would blur the model's focus and make results harder to interpret independently of local tax context.
- **Variable foreign-exchange modeling** — Currency exchange modeling is outside the scope of this simulator. Monetary values are treated in a single base currency unit.
- **Social security / pension systems** — Pension and social security systems vary significantly across jurisdictions and individual situations and are intentionally excluded to preserve a self-contained, clearly bounded model.

## Disclaimer

This tool was created for personal learning and verification purposes, and does not guarantee future investment performance. The author cannot be held responsible for any damages arising from investment decisions or asset management based on simulation results. Make your final investment decisions at your own responsibility. This does not guarantee the optimal strategy for the type and period of invested assets or individual financial situations.
