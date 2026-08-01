[English](./CHANGELOG.md) | [日本語](./CHANGELOG-ja.md)

# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [v2.4.2]

### Changed
- **Unified Null Label in Total Asset Graph Tooltip**: Unified the display for null / undefined values in the total asset graph to `label: —` (U+2014) across languages, extracting the pure function `formatAssetTooltipLabel`.
- **Language Switch Button Cleanup**: Removed the `(experimental)` label from the language switch button.
- **Separation of Update History to CHANGELOG**: Moved past update history from `README.md` / `README-ja.md` to independent `CHANGELOG.md` / `CHANGELOG-ja.md` files. Integrated monthly processing order specifications into `docs/decision-timing.md`.

## [v2.4.1]

### Changed
- **Extraction of common clamp helpers**: Extracted unit-independent pure clamp functions (`clampSimPaths`, `clampNonPositive`, `clampNonNegative`, `clampRange`, `clampMinDf`, `resolveGuardrailRelease`) into `js/core/params.js` for common reference in both UI and headless execution paths.
- **Cleanup of trace tags**: Removed internal trace tags (`M2`, `M4`, `M5`, `M6`, `M7`, `L1`) while maintaining the original meaning of comments.
- **Expansion of test suite**: Added Worker↔Headless bitwise equivalence verification tests (T8: 1/3/8 worker parallel setup) and unit tests for common clamp functions (T10).
- **Clarification of documentation & CLI specifications**: Clarified `outputFile` field behavior in CLI stdout output mode and added currency semantics comparison table.
- No changes to external UI specs, simulation algorithms, or calculation outputs (100% bit-for-bit match).

## [v2.4.0]

### Added
- **Headless execution function (`runSimulationHeadless`)**: Added single-process execution function without Web Workers. Results are bitwise identical to the Worker version.
- **CLI (`cli.js`)**: Added command-line interface supporting `run` and `list-factors` subcommands. Full results output to `.temp/fire-sim/`, scalar summaries to stdout.
- **Input units**: Accepts monetary values in base currency units (JPY or USD). No fixed-rate conversion ($1=100 JPY) is performed.
- No changes to external specifications (UI, simulation results, operation).

## [v2.3.2]

### Changed
- **Internationalization (i18n)**: Translated all documentation, code comments, and Markdown files into English.
- **Code comment cleanup**: Removed internal tags (`Bug #NN`, `FIX-NN`, `REQ-NN`, etc.) and organized comments in natural English.
- No changes to external specifications (UI, simulation results, operation).

## [v2.3.1]

### Changed
- **Refactoring of internal structure**: Split `app.js` into functional modules (state, charts, summary, ui-helpers, actions, init) to significantly improve readability and maintainability.
- **Chart.js error fix**: Resolved `Cannot read properties of null` error during language switching by adding guard logic (`if (!chart || !chart.data) return;`) to `applyDownsideFocus`.
- **Fixed import source for `buildCdfPoints`**: Fixed `buildCdfPoints` import source from `app.js` to `app/charts.js` to improve test maintainability.
- No changes to external specifications (UI, simulation results, operation).

## [v2.3.0]

### Added
- **Addition of new risk metrics (Initial Total Asset Deficit charts)**:
  - Added two new CCDF (Complementary Cumulative Distribution Function) graphs to the Simulation tab:
    - **Initial Total Asset Deficit Duration Probability**: Visualizes the probability distribution of how many consecutive months total assets remain below initial starting assets.
    - **Consecutive Risk Asset Sale Duration under Initial Asset Deficit**: Visualizes the probability distribution of consecutive months risk assets were drawn during an initial asset deficit.
  - Enables users to evaluate psychological load and behavioral risks near asset bottoms.
  - Increases total graphs to 6 for multi-angle risk analysis.
- **Expansion of internal data flow**:
  - Added `maxBelowInitPeriod` and `maxConsecutiveSellPeriod` to `runSinglePath` return values and implemented buffer transfers between Workers.
  - `aggregateResultsProduction` includes new metrics in return values, establishing foundation for chart rendering and ZIP output.
- **Expansion of test suite**:
  - Added 7 unit test cases in `tests/unit/simulation.test.js` for new metrics.
  - Added fixture (`reference-belowinit-results.json`) and generation script (`generate-belowinit-reference.js`) for reproducibility testing.
  - Added integration tests (`tests/integration/belowinit-charts.test.js`) verifying new chart rendering and language switching.
  - Confirmed existing reproducibility tests (`reference-results.json`) continue to pass.

## [v2.2.0]

### Added
- **Addition of Comparison tab**:
  - Configure and execute multiple independent scenarios side-by-side to compare main output metrics in tabular format.
    - **Note**: Default scenario names ('Scenario 1', 'Scenario X', 'Copy of X') are fixed English strings to prevent unintended mutation during language switching.
  - Support up to 10 scenarios with clone, delete, and reorder functionality.
  - "Overwrite with Simulation Tab values" button reflects current simulation conditions into scenarios.
  - Automatic currency unit conversion in English mode ($1 = 100 JPY fixed rate) with 'K', 'M' unit labels next to input fields.
  - Expanded test suite with unit and integration tests for Comparison tab.

## [v2.1.0]

### Added
- **Target Asset Retention Probability**:
  - Calculates and displays the probability of retaining specified percentage of initial total assets at simulation end.
  - Added "End Target Assets (%)" input field under Asset Settings. 100% corresponds to principal retention probability.
  - Displayed as new metric in summary card and included in ZIP output CSV/JSON.
  - Nominal evaluation without inflation adjustment (noted in tooltip).
- **Addition of English mode (experimental)**:
  - Enabled switching part of interface to English via top-right language button (`English (experimental)`).
  - Currency display converted to USD ($1 = 100 JPY fixed rate). Internal calculations remain in JPY.
  - **Note**: English mode is experimental implementation; layout overflow or untranslated parts may exist.

## [v2.0.0]

### Added
- **Addition of Analysis tab**:
  - Added "Analysis" tab at top of main screen for One-way Sensitivity Analysis (OAT) based on baseline scenario.
  - Select 10 factor types with 5 sensitivity levels.
  - Visualize scenario results (FIRE success rate, final asset 10th percentile, max DD 10th percentile) in tables and factor comparison cards.
  - Export analysis results in ZIP format containing summary.csv, comparison_summary.csv, metadata/*.json, manifest.json.
  - Existing main screen features remain unchanged.
- **Expansion of test suite and documentation**:
  - Added unit and integration tests for 4 modules (analysis-state, analysis-runner, analysis-output, analysis-ui).
  - Built automated test suite of ~110 test cases across 20 files.
  - Documented test philosophy, fixture design guidelines, and contribution guide in `tests/README.md`.
  - Replaced unmaintainable E2E tests with integration tests.

## [v1.10.0]

### Changed
- **Significantly improved memory efficiency of aggregation process**:
  - Changed `aggregateResultsProduction` to sequential transposition method, reducing peak memory usage during 50,000 paths.
  - Transposed and freed buffers one type at a time (total assets / cash / drawdown) to lower browser memory load.
  - Simulation results are completely consistent with v1.9.0.

## [v1.9.0]

### Changed
- **Code structure refactoring**: Separated pure logic into `js/core/` to improve testability and maintainability.
- **Introduction of automated testing**: Built unit and integration tests using Vitest + jsdom for automatic verification of calculation logic reproducibility and UI state transitions.
- **Consolidation of URL construction logic**: Centralized URL generation process into `buildSimulationUrl` function.
- **Clarification of state management**: Separated dirty state after input changes and button control into `state.js`.
- **Documentation of monthly determination criteria**: Documented in `docs/decision-timing.md` that all determinations are based on post-spending total assets.
- **Introduction of CI pipeline**: Added GitHub Actions workflow running tests automatically on push.

## [v1.8.3]

### Changed
- **Change of internal calculation unit (10,000 yen → yen)**: Unified internal monetary calculations from 10,000 yen to yen. UI display units remain unchanged.
- **Maintenance of bankruptcy determination accuracy**: Adjusted bankruptcy threshold (EPSILON) to 1 yen.
- **Improvement of display control toggle behavior**: Fixed bug where condition change warning was erroneously displayed when operating "Show only 50% or below" toggle on graphs.

## [v1.8.2]

### Changed
- **Fix of default value for initial risk assets**: Unified default value with UI display unit (10,000 yen).
- **Prohibition of result sharing after input changes (stale state management)**: Disabled share, save, and compare buttons when input values change after simulation run.
- **Complete unification of monthly processing order**: Unified all determinations to post-spending total assets basis.
- **Full stop response in case of Worker errors**: Safely stop all Workers on error and restore UI.
- **Unification of simulation count upper limit**: Unified upper limit between UI and internal logic to 50,000.
- **Improvement of stepper button usability**: Supported single-click increment/decrement and improved keyboard accessibility.

## [v1.8.1]

### Changed
- **Improvement of UI feedback**: Displayed temporary success message on "Save image" button and fixed tooltip overflow on mobile screens.
- **Improvement of stability**: Strengthened fallback processing to alert immediately if an error occurs during execution.
- **Improvement of code quality**: Defined numerical micro-thresholds as constants for better maintainability.

## [v1.8.0]

### Added
- **Automatic formatting of percentile input**: Automatically clean, deduplicate, and sort percentile inputs up to 5 items.
- **Revamp of percentile line color gradient**: Dynamically determine percentile line colors using red-to-green gradient based on line count and rank.
- **Downside focus feature**: Added "Show only 50% or below" toggle to graphs for instant filtering of pessimistic-to-median scenarios.
- **URL query parameter support**: Support automatic parameter filling and execution via URL query parameters (`auto=1`).
- **Addition of "Open another tab with the same conditions" button**: Open URL in new tab with fixed input conditions and random seed for strict comparison.
