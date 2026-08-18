[English](./CHANGELOG.md) | [日本語](./CHANGELOG-ja.md)

# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [v2.8.4]

### Changed
- **Public release-checklist wording**: Replaced implementation-flow identifiers in the canonical `docs/internal/release-checklist.template.md` with public process names. The procedure is unchanged: overwrite the working ticket from the template at release preparation and record only items actually run (leftover unchecked rows are allowed there); the release gate runs remaining checks and is the last tracked-file update, then commit; the pull request does not edit tracked files and requires draft commits to be squashed to one; the GitHub release draft is created only after the pull request is merged. Historical changelog entries are unchanged.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).

## [v2.8.3]

### Fixed
- **Analysis tab factor deselection**: Removed unreachable dead code for 0-factor branch in result cards (`#cardTarget`, `#cardCompare`) and cleaned up unused `analysis.noFactors` i18n key. Confirmed and tested that deselecting all factors properly hides both result cards and disables the "Run Analysis" button.
- **CLI smoke test checklist specification**: Updated `docs/internal/release-checklist.template.md` to match the canonical JSON scalar summary specification (`successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`).

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).

## [v2.8.2]

### Added
- **GitHub Pages Overview document** (`docs/guide/overview.md`): README excerpt for visitors who land on `docs.html` without opening the GitHub README. Covers Overview, Psychological Load, Privacy (Local Processing / External Resources / Explicit Sharing / Automatic Transmission), Deliberate Scope (Taxation / Variable foreign-exchange modeling / Social security / pension systems), and Disclaimer. `README.md` remains the single source of truth (one-way sync). Developer-only README sections (Features, CLI, License, Documentation, and others) are intentionally excluded.

### Changed
- **docs.html default document**: Opening `docs.html` with no `?doc=` now loads `guide/overview` instead of `guide/getting-started`. Explicit `?doc=guide/getting-started` is unchanged. The 404 recovery link points to Overview.
- **Documentation manifest**: `overview` is the first Guide entry so the Pages nav matches the new landing document.
- **README Documentation gateway**: Added Overview as a destination in `README.md` and `README-ja.md` (10 destinations; English/Japanese parity maintained).
- **Release checklist process**: Each release-prep cycle now overwrites `docs/internal/release-checklist.md` from `docs/internal/release-checklist.template.md`. Marks are `[x]` (one-line result required), `[N/A]` (structural reason only), and `[ ]` (leave the literal `<result or reason>` suffix). Carrying `[x]` or prior results from the previous version is forbidden. Clearing remaining `[ ]` is P7 (last tracked-file updates, then commit). P8 creates the pull request without further repo edits: squash draft commits into one commit whose message equals the PR title (`Release vX.Y.Z: A, B, and C`, copied from the latest merged Release PR); CHANGELOG supplies the body substance and that previous PR supplies the body form (`Summary of Changes` / `Key Features & Updates` / `Verification Status`). The GitHub release draft is P9 after merge.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).

## [v2.8.1]

### Changed
- **README 3.0**: Redesigned `README.md` and `README-ja.md` as a documentation gateway. New 13-section structure: Hero, Overview (with Psychological Load subsection), Screenshot, Simulation Model (7 concepts explicitly as one model), Ways to Use It (Browser UI / Analysis / Comparison / Headless CLI hierarchy with `run` + `list-factors`), Features (8 fixed taxonomy with semantic purposes), Privacy (4 sections: Local Processing, External Resources, Explicit Sharing, Automatic Transmission), Deliberate Scope (Taxation, Variable foreign-exchange modeling, Social security / pension systems), Documentation (9 exact destinations), Version / Update History, CLI, Disclaimer, License. English/Japanese parity maintained throughout.

### Added
- **Screenshot asset** (`docs/assets/readme/fire-simulator-overview.png`): Product-oriented screenshot at 1400×869, Simulation tab, fixed seed 123456, HEADLESS_DEFAULTS parameter values, log-normal return model, percentiles [10, 30, 50, 70, 90], showing FIRE Success Rate, Final Assets (Median), Target Asset Maintenance Rate, and Total Assets (Percentiles) chart.



> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).
> README-only release: no application code, simulation engine, worker, headless implementation, CLI, CSS, tests, or existing documentation body changes.

## [v2.8.0]

### Changed
- **Tailwind Static Build Setup**: Removed Tailwind Play CDN (`cdn.tailwindcss.com`) and switched to pre-compiled `css/tailwind.css` built via Tailwind CLI strictly pinned to `3.4.17`. JavaScript remains 100% zero-build (ES Modules).
- **Self-Hosted Inter Fonts**: Subsetting 6 weights (300, 400, 500, 600, 700, 800) from Inter v4.1 via `pyftsubset` into `css/fonts/Inter-*.woff2` with SIL OFL license (`css/fonts/OFL.txt`). Completely removed Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) from both `index.html` and `docs.html`.
- **HTML Lang Synchronization**: `setLanguage(lang)` in `js/i18n.js` now updates `document.documentElement.lang` synchronously.

### Fixed
- **FOUC Prevention Gate**: Implemented an inline paint-gate style (`html.app-loading body { visibility: hidden; }`) and boot script in `index.html`, preventing initial render flicker for non-default languages. Gate is removed immediately after query parameter application in `js/app/init.js` with a 3000ms safety timeout.

### Refactored
- **Pure URL Options Functions**: Extracted URL options creation into `js/app/actions-url-options.js` (`getCopyUrlOptions`, `getShareUrlOptions`, `getCompareUrlOptions`), removing duplicate inline object literals in `js/app/actions.js`.

### Changed (CI)
- **CI Workflow & CSS Freshness Verification**: Updated `.github/workflows/test.yml` to `actions/checkout@v5` and `actions/setup-node@v5` (Node 24 native). Added `npm run build:css` and `git diff --exit-code -- css/tailwind.css` freshness verification step prior to running unit/integration tests.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).

## [v2.7.1]

### Fixed
- **URL Reproduction Bug (Double Currency Conversion)**: Fixed a bug where "Copy Result URL" / "Open same conditions" caused the copied tab to show different cash/expense values and results from the original. The root cause was `setLanguage` being called inside `applyQueryParams`, which dispatched `languageChanged` and triggered `convertCurrencyInputs` before `applyParsedParams` could set the URL values — causing a double-conversion.

### Changed
- **Boot-time Language Resolution**: Initial display language is now resolved synchronously at page load, before any ESM module initializes. `navigator.language` is respected for first-time visitors with no `localStorage` entry. Existing users with a stored language preference are unaffected.
- **Language SSOT Unified**: `globalThis.__currentLang` is now the single source of truth for language state. `params.js` no longer reads `localStorage` directly — it calls `getLanguage()` from `i18n.js`, eliminating the SSOT bypass and uncaught exception risk.

### Added
- **Header Docs Link with SVG Icon**: Enhanced the Docs link in the header with a dedicated document SVG icon and distinct styling, separating it from language-switch buttons.
- **`js/lang-detect.js`**: New module exporting `resolveInitialLang()` as a pure, testable function mirroring the boot-time language resolution logic.

### Changed (cleanup)
- **Chart.js Duplicate Load Removed**: Removed the unversioned `chart.js` CDN `<script>` tag (the pinned `@4.4.1` version is retained).
- **Summary Card CLS Mitigated**: Added an outer wrapper `div` with `min-height: 220px` around `#summaryCardContainer` to reduce Cumulative Layout Shift before simulation results are displayed.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).
> Language resolution, URL reproduction bug fix, docs navigation, and version sync update; no calculation logic or CLI output schema changes.

## [v2.7.0]

### Added
- **Documentation Restructuring**: Organized docs into 4 clear categories: `guide/` (Getting Started, CLI Usage Guide), `reference/` (Parameter Reference, Metrics Glossary, Headless API Reference), `explanation/` (Mathematical Model, Reproducibility, Analysis Methodology, Simulation Decision Timing), and `internal/` (Release Checklist).
- **Standalone Documentation Viewer (`docs.html`)**: Built a CDN-driven, zero-build single-page markdown viewer with sidebar navigation, table of contents (TOC) auto-generation, KaTeX math rendering, and security isolation for internal docs.
- **Header Link to Documentation**: Added a prominent "Docs" link to the header bar of `index.html` with visual separator.

### Changed
- **Unified Branding & Title Styling**: Standardized all documentation titles to "FIRE Monte Carlo Simulator Docs" and introduced a `.app-title` CSS class for clean single-color headers without gradient text clipping.
- **Mathematical Derivation Accuracy**: Corrected the Ito drift adjustment derivation in `docs/explanation/mathematical-model.md` to explicitly state the 12-month log-normal expectation horizon formula \(E[\exp(\mu_{\text{annual}} + \sigma_{\text{annual}} Z)] = 1 + \mu_{\text{arith}}\) and exact geometric growth rate.
- **Documentation-to-Code Audit**: Verified all 9 public documentation files against the core simulation engine and random number generator (`js/core/**`), fixing SoT references and Student-t algorithm naming.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).
> Documentation, UI title styling, and version sync update; no calculation logic or CLI output schema changes.

## [v2.6.1]

### Added
- **Design Philosophy documented in README**: Added a "Design Philosophy" section to `README.md` and `README-ja.md` documenting the simulator's core axis (psychological load during drawdown), intentional scope limits (taxation, currency exchange, social security), and three interfaces matched to depth of use (browser UI, Analysis / Comparison tabs, headless CLI).

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).
> Documentation-only update and version sync; no logic, CLI, or output schema changes.

## [v2.6.0]

### Added
- **Complete provenance params in CLI output**: The `params` field in all three `run` output modes (`--stdout`, file, and scalar summary) now contains the full set of normalized (post-clamp) input parameters, whitelist-picked from `HEADLESS_DEFAULTS` keys. Previously only four fields (`simPaths`, `simYears`, `seedNum`, `currency`) were included. Now all fields — including `expectedReturn`, `volatility`, `useTDistribution`, toggle flags, etc. — are present.
- **Top-level `percentiles` in scalar summary**: The normalized percentiles array used in the run is now included as a top-level field in scalar summary output. (It was already present in `--stdout` and file outputs via the spread of `simResult`.)
- **`meta` field in all output modes**: All three output modes now include a `meta` object with `toolVersion` (semver string) and `generatedAt` (ISO 8601 UTC timestamp, `YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Round-trip reproducibility**: Spreading the output `params` to the top level and attaching the top-level `percentiles` is sufficient to reproduce the exact same run. Clamp idempotency guarantees bit-identical results.
- **CLI Responsibility Boundary documented**: Added a "CLI Responsibility Boundary (Design Policy)" section to `docs/cli-usage.md`, explicitly recording deliberately excluded features (`analyze`/`compare`/`sweep` subcommands, CSV/graph output, full per-path time-series, `--schema`, input auto-unwrap) as final decisions to prevent re-proposals.

> **Simulation algorithm and calculation results are unchanged** (100% bit-for-bit match).
> The CLI output JSON schema change is an intentional backward-compatible extension:
> new fields are added; no existing fields are removed or renamed.

## [v2.5.0]

### Removed
- **ZIP Export (Beta) from Analysis Tab**: Removed the "Export ZIP (Beta)" button and all related functionality (`js/analysis-output.js`, ZIP event handler in `analysis-ui.js`, `exportZipBtn` DOM element).
  - **Reason**: Addition of the CLI tool provides a more robust data export path; removing the browser-based ZIP export simplifies the tool and eliminates the JSZip third-party dependency.
  - **User impact**: Analysis results remain fully accessible via the comparison cards in the Analysis tab. No simulation or analysis logic is affected.
  - **Technical change**: Removed JSZip CDN `<script>` tag from `index.html`; removed `analysis.exportZip`, `analysis.zipping`, `zipDone`, `error.noResult`, `error.noJSZip`, and `error.zipFailed` i18n keys.

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
