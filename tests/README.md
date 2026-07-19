# Test Documentation

## Terminology

- **CB (Cash Buffer)**: A risk-free asset drawn from during a market crash.
- **GR (Guardrail)**: A feature that automatically reduces spending when assets decline.
- **Factor**: A parameter targeted for sensitivity analysis (expected return, volatility, etc.). Currently 10 factors.
- **Level**: The stage of change for a factor. 5 stages: -2, -1, 0, +1, +2.
- **Base scenario**: The baseline simulation result with no changes to any factors (displayed as "Base Scenario" in the UI, referenced as `baseScenario` in code).

## 1. Test Overview

This project uses two layers of automated testing with Vitest + jsdom.

| Layer | Directory | Execution Environment | Main Verification Targets | Count |
|----|-------------|----------|-------------|------|
| Unit tests | `tests/unit/` | Vitest + jsdom | Pure functions, core logic, state management | 15 (approximately 110 test cases) |
| Integration tests | `tests/integration/` | Vitest + jsdom | DOM operations, UI state transitions, event delegation | 5 (approximately 46 test cases) |

### 1.1 Test Target Module Map

```
js/core/
├── aggregation.js       → tests/unit/aggregation.test.js
├── format.js            → tests/unit/format.test.js
├── params.js            → tests/unit/params.test.js
├── percentile.js        → tests/unit/percentile.test.js
├── random.js            → tests/unit/random.test.js
├── simulation.js        → tests/unit/simulation.test.js
├── state.js             → tests/integration/ui-state.test.js (※ Classified as an integration test because the button control logic depends on DOM IDs.)
├── url.js               → tests/unit/url.test.js, tests/integration/query-params.test.js

js/
├── simulation-engine.js → (Covered indirectly by integration tests)
├── analysis-state.js    → tests/unit/analysis-state.test.js
├── analysis-runner.js   → tests/unit/analysis-runner.test.js
├── analysis-output.js   → tests/unit/analysis-output.test.js
├── analysis-ui.js       → tests/integration/analysis-ui.test.js
├── comparison-state.js    → tests/unit/comparison-state.test.js
├── comparison-runner.js   → tests/unit/comparison-runner.test.js
├── comparison-ui.js       → tests/unit/comparison-ui.test.js
├── i18n.js             → tests/unit/i18n.test.js, tests/unit/i18n-snapshot.test.js
├── app.js               → (Covered indirectly by integration tests)
```

### 1.2 Coverage Targets

`vitest.config.js` specifies `js/core/**/*.js` as the coverage target.
The UI layer (`analysis-ui.js`, `app.js`) is excluded from coverage measurement due to its strong dependency on the DOM,
but its behavior is verified by integration tests.

The state management (`analysis-state.js`) and execution logic (`analysis-runner.js`) of the Analysis tab
have unit tests, so they are included in the coverage target (since v2.0.0).

The state management (`comparison-state.js`) and execution logic (`comparison-runner.js`) of the Comparison tab are similarly included in the coverage target (since v2.3.0).

## 2. How to Run Tests

### 2.1 Run All Tests

```bash
npm install   # First time only
npm test      # Run all tests with Vitest (with coverage)
```

### 2.2 Run Specific Tests Only

```bash
# Filter by file name pattern
npx vitest run -t "transposeFlat"

# Specific file only
npx vitest run tests/unit/format.test.js
```

### 2.3 Check Coverage Report

```bash
npx vitest run --coverage
# Open coverage/index.html in browser
```

### 2.4 Automatic Execution in CI

GitHub Actions (`.github/workflows/test.yml`) automatically runs on push to the `main` branch and pull requests. The execution environment is `ubuntu-latest` / `node 24`.

## 3. Test Design Philosophy

### 3.1 Specialization in Logic Verification (Principle of Independence from Actual Output)

Tests are specialized in verifying "that the calculation logic is correct,"
and their purpose is not to reproduce actual output. This is for the following reasons:

- If tests depend on actual simulation results, changes to the random number generation algorithm or
  parameter adjustments (including bug fixes) will frequently break the tests
- A design that verifies **the correctness of the logic** such as interpolation calculations and factor scale conversions,
  rather than the values themselves, is adopted

### 3.2 Test Fixture Design Guidelines

The numerical values used in tests are **arbitrary values for logic verification**.
They differ from actual simulation results (output from running with default parameters).

| Metric | Test Value (Example) | Actual Default Execution Result (Reference) |
|------|---------------|--------------------------------|
| Success rate | 93.23% | 93.10% |
| Final total assets median | 538,074,816 JPY | 535,045,024 JPY |
| final_p10_jpy | 39,342,408 JPY | 98,098,648 JPY |
| worst10_max_dd | -0.8055 | -0.8076 |

**Guidelines**:
- `makeBaseMetrics()` and `makeDummySimResult()` contain **approximate values not based on realistic distributions**,
  so they must not be used for the purpose of verifying statistical validity
- When it is necessary to change test values, carefully verify that it does not affect the logic being tested

> **⚠️ Important**: Non-50/10 percentile values (30, 70, 90) of `makeDummySimResult()` are convenience dummy values
> generated by simple proportion `Math.round(finalMedian * (pct / 50))`, and do not represent statistically
> correct distributions. Do not perform any statistical verification using these values.

### 3.3 Mock Strategy

- **`runSimulation` (simulation-engine.js)**: Mocked in all tests.
  Does not start an actual Web Worker; uses the return value of `makeDummySimResult()` as a substitute.
- **`generateAndDownloadZip` (analysis-output.js)**: Mocked in ZIP output tests.
  Prevents side effects on the file system.
- **`vi.resetAllMocks()`**: Executed in `beforeEach` of each test to completely remove
  the residual counter of `mockRejectedValueOnce`.

### 3.4 Handling Asynchronous Tests

Since Vitest 1.6 does not have `vi.waitFor`,
use the `waitFor` function in `tests/helpers/async-utils.js` instead.
```javascript
await waitFor(() => {
  expect(element.classList.contains('hidden')).toBe(false);
}, { timeout: 5000 });
```
Since CI environments may be slower than local environments, extend the `timeout` as necessary.

## 4. Types of Tests and Conventions

### 4.1 Unit Tests (`tests/unit/`)

- Targets: Pure functions and state management modules under `js/core/`
- Characteristics: Does not depend on DOM, fast (< 1 second)
- Naming: `{module-name}.test.js`
- Examples: Correctness of parameter conversion, reproducibility of random seeds, percentile calculation

### 4.2 Integration Tests (`tests/integration/`)

- Targets: DOM operations, UI state transitions, event delegation
- Characteristics: Executed in a `jsdom` environment with fixture HTML injected into `document.body.innerHTML`
- Naming: `{feature-name}.test.js`
- Examples: Toggle behavior of the factor selection UI, state transitions of the analysis execution flow, enabled/disabled control of the ZIP output button

### 4.3 Reproducibility Tests (`tests/unit/simulation.test.js`)

- Special unit test: Compares the current implementation's output with the fixed-seed execution results from v1.8.3 saved in `tests/fixtures/reference-results.json`
- **Purpose**: To ensure that results have not changed during refactoring of the core calculation logic
- **How to generate reference data**: Execute `tests/fixtures/generate-reference.js` in browser DevTools
- **Note**: Reference data was generated with `paths=1000`. Since `getParamsFromInputs` clamps `simPaths` to 5000, `params.simPaths = 1000` is set directly in the test code to maintain consistency with this reference data.

### 4.4 Comparison Tab Tests (`tests/unit/comparison-*.test.js`, `tests/integration/comparison-ui.test.js`)

- **State management** (`comparison-state.js`): Scenario addition, deletion, duplication, movement; clearing results when common settings change; movement processing when the array is empty, etc.
- **Execution logic** (`comparison-runner.js`): Parameter conversion (including fixed rate 100 yen = 1 dollar), sequential execution, error handling, preventing interference of progress callbacks.
- **UI helpers** (`comparison-ui.js`): Currency conversion (JPY ↔ USD), dynamic conversion of step/min/max in English mode, inverse conversion consistency, prevention of conversion of non-currency parameters.
- **Integration tests**: Scenario addition/deletion, run button, reordering, conditional display (row hiding when CB/GR OFF), deletion confirmation cancel, prevention of NaN when changing select boxes.

### 4.5 About E2E Tests (Reasons for Not Adopting)

This project **intentionally does not adopt** End-to-End tests using Puppeteer/Playwright.

**Reasons for not adopting**:
1. **Testing pyramid principle**: Sufficient coverage is obtained from unit tests (calculation logic) and
   integration tests (UI state transitions)
2. **Characteristics as a SPA**: All logic is completed client-side,
   and the additional verification value from real browser automation is limited
3. **Maintenance cost**: Tests are broken every time the DOM structure or selectors change,
   and the cost of fixing them exceeds the reliability improvement obtained
4. **CI execution time**: Downloading and running browser binaries takes time and
   slows down the feedback speed on each push

**Alternative approaches**:
- Ensure the correctness of logic and UI with unit tests + integration tests
- Use the "Smoke Test Manual" (below) for manual verification before release

**Conditions for future reintroduction**:
- When integration with a backend API occurs
- When a feature dependent on browser-specific APIs such as Service Workers is added
- When the number of monthly active users exceeds 1,000 and the limitations of manual testing are felt

For manual test procedures before release, refer to [docs/release-checklist.md](../docs/release-checklist.md).

## 5. Guide to Adding Tests

### 5.1 Which Layer Should Tests Be Written In?

| What to Verify | Layer to Write In | Reason |
|---------------|-----------|------|
| Correctness of a calculation formula | Unit test | Pure functions do not require DOM |
| Parameter conversion | Unit test | Verify combinations of inputs and outputs |
| Button enabled/disabled | Integration test | DOM state confirmation is required |
| UI changes after a click | Integration test | Event delegation confirmation |
| State transitions of asynchronous processing | Integration test | Verify with waitFor + mock |
| Actual browser display | Manual smoke test | Cost-to-benefit ratio is low |

### 5.2 How to Create Fixtures

```javascript
import { makeBaseMetrics, makeScenarioPoint, makeDummySimResult } from '../helpers/analysis-fixtures.js';

// Basic metrics (default values)
const metrics = makeBaseMetrics();

// Overwrite specific values
const customMetrics = makeBaseMetrics({ success_rate_pct: 85.0 });

// Scenario point (pair of level and result)
const point = makeScenarioPoint(-2, { final_p10_jpy: 20000000 });

// Dummy simulation result
const simResult = makeDummySimResult({ finalMedian: 500_000_000 });
```

### 5.3 DOM Test Patterns

```javascript
import { readFileSync } from 'fs';

// Read fixture HTML
const fixtureHtml = readFileSync('tests/fixtures/analysis-dom-snippet.html', 'utf-8');

beforeEach(() => {
  document.body.innerHTML = fixtureHtml;
  // Mock setup
  vi.resetAllMocks();
  runSimulation.mockResolvedValue(makeDummySimResult());
});

it('toggles state on click', () => {
  renderAnalysisTab();
  document.querySelector('[data-action="toggle-factor"]').click();
  renderAnalysisTab();
  expect(document.querySelectorAll('.factor-select-card.selected').length).toBe(1);
});
```

### 5.4 Known Constraints and Precautions

- **`vi.mocked()` is prohibited**: Since it is unstable in Vitest 1.6,
  access mock function properties (`.mock.calls`, etc.) directly
- **Cleanup in `afterEach`**: Since `vi.resetAllMocks()` is executed in `beforeEach`,
  cleanup of mock state within test functions is unnecessary (completely reset at the start of the next test)
- **Countermeasure for undefined `window.alert`**: In the test environment, `window.alert` may not exist,
  so existence confirmation and temporary definition are required before creating a spy
- **Asynchronous assertions**: Use the `waitFor` helper and set the timeout appropriately
  (considering that CI environments may be slower than local environments)
