[English](./README.md) | [日本語](./README-ja.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/moriyama-eng/fire-simulator)

# FIRE Monte Carlo Simulator (v2.3.2)

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

## Main Update History

### Updates (v2.3.2)
- **Internationalization (i18n)**: Translated all documentation, code comments, and Markdown files to English.
- **Code Comment Cleanup**: Removed obsolete internal trace tags (such as `Bug #NN`, `FIX-NN`, `REQ-NN`) and unified comments in natural English.
- No changes to the external specification (UI, simulation results, or behavior).

### Updates (v2.3.1)
- **Internal structure refactoring**: Split `app.js` into functionally separate modules (state, charts, summary, ui-helpers, actions, init), greatly improving readability and maintainability.
- **Chart.js error fix**: Resolved a `Cannot read properties of null` error that occurred during language switching by adding a guard (`if (!chart || !chart.data) return;`) to the `applyDownsideFocus` function.
- **Fixed test import path for `buildCdfPoints`**: Changed the import source of `buildCdfPoints` from `app.js` to `app/charts.js`, improving test maintainability.
- No changes to the external specification (UI, simulation results, or behavior).

### Updates (v2.3.0)

- **Addition of new risk indicators (graphs related to falling below initial total assets)**
  - The following two CCDF (Complementary Cumulative Distribution Function) graphs were newly added to the Simulation tab:
    - **Probability of occurrence of continued period below initial total assets**: Visualizes the probability distribution of how many months the total assets remain below the initial total assets at the start of the simulation at their longest.
    - **Probability of occurrence of consecutive risk asset sell period when below initial total assets**: Visualizes the probability distribution of how many months risk assets were consecutively used as the source of withdrawals during the period when assets were below the initial total assets.
  - These indicators allow users to evaluate the psychological burden and behavioral risks (delayed recovery from lows and continued risk asset selling risk) during the period when assets are at their lowest in greater detail.
  - In addition to the existing four graphs (total assets progression, cash buffer progression, maximum drawdown, longest stagnation period), risks can be analyzed from multiple angles with a total of six graphs.

- **Expansion of internal data flow**
  - Added `maxBelowInitPeriod` and `maxConsecutiveSellPeriod` to the return value of `runSinglePath`, and implemented buffer transfer between Workers.
  - `aggregateResultsProduction` now includes the new indicators in its return values, laying the groundwork for graph drawing and ZIP output.

- **Expansion of the test suite**
  - Added 7 unit test cases for the new indicators in `tests/unit/simulation.test.js` to verify the accuracy of the logic.
  - Added a fixture for reproducibility testing of new indicators (`reference-belowinit-results.json`) and a generation script (`generate-belowinit-reference.js`).
  - Added an integration test (`tests/integration/belowinit-charts.test.js`) to verify new graph drawing and language switching.
  - Confirmed that existing reproducibility tests (`reference-results.json`) continue to pass as before.

### Updates (v2.2.0)

- **Addition of the Comparison tab**
  - Multiple independent scenarios can be configured side by side, run all at once, and the main output indicators can be compared in a table.
    - **Note**: Default scenario names ('Scenario 1', 'Scenario X', 'Copy of X') are "data" that the user edits and determines themselves, so they are excluded from automatic translation when switching languages (fixed English-based notation). This prevents user data from being inadvertently altered when switching languages.
  - Up to 10 scenarios can be added, and scenarios can be duplicated, deleted, and reordered.
  - The "Overwrite with simulation tab values" button can reflect the current simulation conditions to each scenario.
  - In English mode, currency units are automatically converted (100 yen = $1 fixed rate), and unit labels such as "K" and "M" are displayed next to input fields.
  - The test suite has been expanded to include unit tests and integration tests for the Comparison tab.

### Updates (v2.1.0)

- **Addition of target asset maintenance probability**
  - Added a feature that calculates and displays the probability of maintaining assets equal to or greater than a specified percentage of the initial total assets (risk assets + cash buffer) at the end of the simulation.
  - Added an "End target asset (%)" input item to the asset settings. When set to 100%, this corresponds to the principal maintenance probability.
  - Displayed as a new indicator on the summary card, and also included in the CSV and JSON of ZIP output.
  - ※ This is an evaluation based on nominal values without inflation adjustment (note included in the tooltip).
- **Addition of English mode (experimental)**
  - Part of the interface can now be switched to English (language button in the upper right: `English (experimental)`).
  - Currency display is converted to USD ($1 = 100 yen fixed rate). Since internal calculations are performed in Japanese yen, a convenient fixed rate is adopted.
  - **Note**: English mode is an experimental implementation. There may be layout issues or untranslated sections.

### Updates (v2.0.0)

- **Addition of the Analysis tab**
  - Added an "Analysis" tab to the top of the main screen, enabling One-way Sensitivity Analysis (OAT) based on a base scenario.
  - 10 types of factors (risk assets, spending, return, volatility, cash buffer-related, etc.) can be selected for sensitivity analysis at 5 levels.
  - Results for each scenario (FIRE success rate, final total assets 10th percentile, maximum DD 10th percentile) are visualized in a list table and per-factor comparison cards.
  - Analysis results can be downloaded in ZIP format, containing summary.csv, comparison_summary.csv, metadata/*.json, and manifest.json.
  - The existing features of the main screen are unchanged.
- **Expansion of the test suite and documentation**
  - Added unit and integration tests for 4 modules (analysis-state, analysis-runner, analysis-output, analysis-ui) for the Analysis tab
  - Organized an automated test suite of about 20 files and approximately 110 test cases
  - Documented the test design philosophy, fixture design guidelines, and addition guide in `tests/README.md`
  - Discontinued unmaintainable E2E tests (Puppeteer/Playwright) and consolidated into integration tests

  - **Factor**: Target parameter for sensitivity analysis (return, volatility, etc.)
  - **Level**: Stage of factor change (-2, -1, 0, +1, +2 in 5 stages)
  - **Base scenario**: Baseline analysis result with no changes to any factors

### Updates (v1.10.0)

- **Significantly improved memory efficiency of the aggregation process**
  - Changed `aggregateResultsProduction` to a sequential transposition method, reducing peak memory usage during 50,000 paths.
  - By calculating and releasing the three types of buffers — total assets / cash / drawdown — one type at a time rather than transposing them all at once, the browser's memory load is reduced.
  - Since the calculation algorithm has not changed, simulation results are completely consistent with v1.9.0.

### Updates (v1.9.0)

- **Code structure refactoring**
  Pure logic (calculations, parameter management, URL construction, etc.) was separated into `js/core/` to improve testability and maintainability.
- **Introduction of automated testing**
  Built unit tests and integration tests using Vitest + jsdom, enabling automatic verification of the reproducibility of calculation logic and UI state transitions.
- **Consolidation of URL construction logic**
  The URL generation process, which was duplicated across sharing, comparison, and copy functions, was centralized in the `buildSimulationUrl` function.
- **Clarification of state management**
  The dirty state after input changes and button control were separated into `state.js` to prevent unintended result sharing.
- **Documentation of monthly determination criteria**
  Documented in `docs/decision-timing.md` that all determinations are based on the post-spending total assets.
- **Introduction of CI pipeline**
  Added a GitHub Actions workflow that automatically runs tests on push.

### Updates (v1.8.3)

- **Change of internal calculation unit (10,000 yen → yen)**
  All internal monetary calculations have been unified from "10,000 yen" to "yen". There is no change to the display unit on the UI (100 million yen, 10,000 yen).
- **Maintenance of bankruptcy determination accuracy**
  In conjunction with the unit change, the threshold (EPSILON) for bankruptcy determination was adjusted to 1 yen. The behavior of simulation results remains unchanged from before.
- **Improvement of behavior when operating the display control toggle**
  Fixed a bug where the simulation condition change warning (⚠️ Condition changed) was erroneously displayed when operating the "Show only 50% or below" toggle on the "Total Assets Progression" and "Cash Buffer Progression" graphs.

### Updates (v1.8.2)

- **Fix of default value for initial risk assets**
  Unified the default value with the UI display unit (10,000 yen) to prevent abnormal values from occurring during fallback.
- **Prohibition of result sharing after input changes (stale state management)**
  After running a simulation, if input values are changed, the share, save, and compare buttons are disabled, and a warning is displayed on the summary card. Re-running will re-enable them. This prevents accidentally sharing results that differ from the current inputs.
- **Complete unification of monthly processing order (all determinations unified to post-spending basis)**
  Guardrail activation/deactivation determination, cash buffer usage determination, all-time high update, replenishment mode start/end, and maximum drawdown recording are all unified to be based on the "post-spending total assets (end-of-month assets)". The results of all determinations are reflected in the next month's actions (spending amount and source).
- **Full stop response in case of Worker errors**
  Improved so that if an error occurs in any Worker during parallel calculation, all Workers are safely stopped and the UI returns to normal.
- **Unification of simulation count upper limit**
  Unified the upper limit between the UI and internal logic to 50,000 times.
- **Improvement of stepper button usability**
  Supported single-click increment/decrement, and improved accessibility during keyboard operation (long-press continuous increment/decrement is maintained).

### Monthly processing order (v1.8.2 and later)

In this simulator, the processing for each month is executed in the following order:
1. Apply market return
2. Update inflation rate
3. **Execute spending (withdrawal)** (determine the source and amount of spending based on the results of determinations up to the previous month)
4. Confirm the post-spending total assets (end-of-month assets)
5. **Execute all determinations based on post-spending total assets, including guardrail activation/deactivation, cash buffer usage, all-time high update, replenishment mode, and maximum DD** (results are reflected in the next month's actions)

### Updates (v1.8.1)

- **Improvement of UI feedback**
  After executing the "Save image" function, a success message is temporarily displayed on the button, improving the operational feel. Also fixed the layout so that setting tooltips do not go out of the screen on narrow screens such as smartphones.
- **Improvement of stability**
  Strengthened fallback processing so that if an error rarely occurs during simulation execution, an alert notification is immediately issued instead of the process stopping.
- **Improvement of code quality**
  Defined numerical micro-thresholds (magic numbers) used in internal simulation calculations as constants, improving maintainability.

### Updates (v1.8.0)

- **Automatic formatting of percentile input**
  When executing a simulation, the content of the percentile input field is automatically formatted. Non-numeric characters and out-of-range values (such as 0 and 100) are removed, and deduplication and ascending sort are applied. A maximum of 5 can be configured, and the 6th and beyond are automatically deleted.

- **Revamp of percentile line color gradient**
  Changed to a method of dynamically determining the color of percentile lines based on the number of lines drawn and their rank. The gradient from red → orange → yellow → yellow-green → green, where the minimum percentile is red and the maximum percentile is green, is automatically optimized according to the number of lines drawn from 1 to 5.

- **Downside focus feature**
  Added a "Show only 50% or below" toggle to the upper right of each of the "Total Assets Progression" and "Cash Buffer Progression" graphs. When ON, only the pessimistic to median scenarios of the 50th percentile or below are displayed, making it easy to analyze focused on downside risk. Switching is instant without recalculating the graph. Default is OFF (show all).

- **URL query parameter support**
  Input values can now be automatically configured by opening a page with query parameters appended to the URL. Appending the `auto=1` parameter will automatically execute immediately after the page loads.

- **Addition of "Open another tab with the same conditions" button**
  This button is displayed after running the simulation. It opens a URL in a new tab with the current input conditions and the random seed value at the time of execution fixed. By changing some conditions on the other tab and re-running, a strict comparison simulation using the same random sequence is possible.

- **Addition of "Copy analysis result URL link" button**
  This button is displayed after running the simulation. It copies a URL including the input conditions, seed value, and auto-run flag (`auto=1`) to the clipboard. Opening the copied URL in a browser will automatically run the simulation under the same conditions. It is the same link as the URL shared by "Post to X". Convenient for sharing conditions by pasting into chat or notes.

- **Query parameterization of X post URL**
  Changed the URL shared by the "Post to X" button to include all input conditions, seed value, and `auto=1` flag. When someone who sees the X post opens the same URL, the simulation is automatically run under the same conditions as the poster.

## Development Background

I am a mechanical designer by profession and not a financial expert, but I developed this simulator because I needed a tool that could intuitively perform complex calculations in a browser to more realistically assess the risks of my own asset formation. I hope it will be a reference for those who are also aiming for FIRE.

## Usage

> [!TIP]
> **[Run the simulator now (GitHub Pages)](https://moriyama-eng.github.io/fire-simulator/)**
> No installation or environment setup required; you can use it as is.

When running by cloning the repository in a local environment, it is highly likely that it will not work by directly opening `index.html` in a browser due to the use of Web Workers (due to security restrictions). If you are using VS Code, install the **Live Server extension**, right-click `index.html`, select "Open with Live Server", and verify operation in the browser that opens.

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
