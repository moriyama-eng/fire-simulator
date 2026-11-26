# Pre-Release Smoke Test Manual (v3.0.3)

When releasing a new version, please perform manual verification using the following checklist.

## Legend

- `[x]` = verified in this release. Replace `<result or reason>` with a one-line result.
- `[N/A]` = structurally inapplicable in this release. Replace `<result or reason>` with a one-line structural reason. Do not use for unchanged code, lack of time, or missing environment.
- `[ ]` = not yet verified. Leave the suffix exactly as `<result or reason>`.
- Check-item line form: `- [ ] <item> — <result or reason>`
- The token `<result or reason>` is literal. Do not translate or abbreviate it.
- Placeholder detection applies only to checkbox lines (`- [ ] ` / `- [x] ` / `- [N/A] `). Occurrences of `<result or reason>` in this Legend, How to start release preparation, and Release Scope are not residual.
- For `npm test`, the result must be transcribed from the raw vitest log: `Test Files N passed` / `Tests M passed`. Do not reconstruct or estimate.

## How to start release preparation

- Run commands from the repository root.
- Overwrite `docs/internal/release-checklist.md` with a copy of `docs/internal/release-checklist.template.md`. On Windows the canonical command is `Copy-Item docs/internal/release-checklist.template.md docs/internal/release-checklist.md -Force`. On non-Windows: `cp docs/internal/release-checklist.template.md docs/internal/release-checklist.md`. Do not use unforced `cp` on Windows.
- Change only the H1 `(template)` → `(vX.Y.Z)` and, if needed, the CLI heading. Do not global-replace the path `release-checklist.template.md`.
- Do not blank the working ticket by hand. A full-file replacement each release preparation is expected and is not a regression.
- Then fill Release Scope and record only items you actually ran. Remaining `[ ]` rows are allowed at the end of release preparation.

## Release gate (last tracked-file updates)

- The release gate is a separate step: execute every remaining check-item `[ ]` until none remain. Record results on this working ticket. Do not open a pull request during the release gate.
- The release gate is the last phase that may edit git-tracked files (this ticket, CHANGELOG, or other repo files). Commit those updates before leaving the release gate.
- The release gate is complete only when every check-item line is `[x]` with a one-line result or `[N/A]` with a structural reason, no check-item line still has `<result or reason>`, and there are no remaining required uncommitted tracked-file changes.
- Starting the pull request before the release gate is complete is forbidden. If tracked files must change after the pull request has started, interrupt the pull request, finish those edits in a resumed release gate, recommit, then redo the pull request.

## Pull request (no tracked-file edits)

- The pull request step creates the GitHub pull request only. Do not edit tracked files in the pull request step.
- Before `gh pr create`, squash the release-branch draft commits into exactly one commit. Do not open a pull request that still lists `draft1` / `draft2` / … commits.
- The squash commit message and the PR title must be identical. Copy the form from the latest merged `Release vX.Y.Z:` pull request (`gh pr view`): `Release vX.Y.Z: A, B, and C` (Title Case).
- CHANGELOG supplies the PR substance. The last merged Release PR supplies the PR form: `## Summary of Changes in vX.Y.Z`, opening paragraph, bit-identical sentence, `### Key Features & Updates`, `### Verification Status`. Fill Key Features from CHANGELOG and Verification Status from this ticket's release-gate results.
- Do not paste CHANGELOG English/Japanese entries as the PR body.
- Release-note substance belongs in CHANGELOG (release preparation, or the release gate if verification requires a last edit). Creating the GitHub release draft (`gh release create`) is the GitHub release draft only, after the PR is merged. Do not run it during the release gate or the pull request.

## Release Scope

- Target version: 3.0.3
- Working branch name: release/v3.0.3
- What changed in this release:
  - Fixed post-bankruptcy monthly drawdown series (`dds.fill(-1.0, t)`) and added defensive rate lower-bound guards in `src/core/simulation.ts` and `src/core/headless-params.ts`, plus comprehensive `NaN`/`±Infinity`/non-numeric/boolean sanitization in `normalizeHeadlessParams`.
  - Fixed unsorted percentile handling and `finalMedian` fallback in `src/core/aggregation.ts`, and fixed default `run` subcommand, `--out` validation, and JSON array root rejection in `src/cli.ts`.
  - Consolidated `isResultDirty` into `src/core/state.ts`, eliminated tooltip DOM and `scroll` listener leaks (`src/app/ui-helpers.ts`, `src/comparison-ui.ts`), added `AbortController` + sequence cancellation to `src/docs-app.ts`, added per-call `progressCallback?: ProgressCallback | null` to `src/simulation-engine.ts`, and fixed English cash buffer restore, duplicate `#scenarioCount`, `asset.riskAsset.tooltip` EN translation, `s.error` HTML escaping, capture `<svg>` icon preservation, `lastExecutedParams` failure overwrite, zero-division `NaN` guards, and `window.open` `noopener,noreferrer`.
  - Fixed documentation accuracy (Stagnation Period definition, KaTeX inline escaping, SPA-safe Currency Semantics link, `getting-started.md` heading hierarchy, `cli-usage.md` exit codes, `testing-guide.md` CI/counts, checklist hygiene), unified `scripts/smoke-subpath-server.mjs` onto `verifyConfinedPath`, updated 4 scripts to `fileURLToPath`, narrowed `.github/workflows/deploy.yml` `build` permissions to `contents: read`, fixed `tests/unit/dev-middleware.test.ts` real-stream assertions, and added 21 regression tests.
- What did not change:
  - PRNG pipeline (`splitmix32`, `xoshiro128**`), path survival (`successRate`), final wealth (`finalMedian`), maximum drawdown (`maxDD`), stagnation duration (`maxUw`), and existing golden reference fixtures remain bit-for-bit identical.

### Document-Impact Table

| Path | Impact this release |
|---|---|
| package.json / package-lock.json | Version 3.0.3 |
| README.md / README-ja.md | Current-release marker only (v3.0.3) |
| CHANGELOG.md / CHANGELOG-ja.md | New latest v3.0.3 entry only |
| index.html | meta, CSS queries, footer, #capFooterUrl (v3.0.3), capture `<h2>` `<span>` wrappers |
| docs.html | meta (v3.0.3) |
| docs/internal/style-guide.md | Example CSS query strings (v3.0.3) |
| src/i18n.ts | getAppVersion() fallback version (3.0.3) & `asset.riskAsset.tooltip` EN fix |
| src/cli.ts | getPackageVersion() fallback version (3.0.3) & CLI arg/root validation fixes |
| src/... (modified) | Core simulation/aggregation/headless-params/engine, UI state/tooltips/actions/init/analysis/comparison/docs-app fixes |
| tests/... (modified) | Fixed `dev-middleware.test.ts` real-stream assertions and added 21 regression tests (45 files / 443 cases) |
| docs/internal/release-checklist.md | Overwritten from template; v3.0.3 H1, scope, and verification records |


## Release Identity / Metadata
- [x] Target release branch (release/v3.0.3) is checked out and separated from main — Verified via `git status -sb` (`## release/v3.0.3`)
- [x] Target version conforms to Semantic Versioning specification (MAJOR/MINOR/PATCH based on scope of changes) — Verified PATCH bump (`3.0.2` -> `3.0.3`) for backwards-compatible bug fixes, hardening, and doc parity
- [x] package.json version is the target release version — Verified `3.0.3`
- [x] package-lock.json top-level version is the target release version — Verified `3.0.3`
- [x] package-lock.json packages[""].version is the target release version — Verified `3.0.3`
- [x] src/i18n.ts getAppVersion() fallback is the target release version — Verified `3.0.3`
- [x] src/cli.ts getCliVersion() fallback is the target release version — Verified `3.0.3` (`getPackageVersion()`)
- [x] README.md current release marker is the target release version — Verified `v3.0.3`
- [x] README-ja.md current release marker is the target release version — Verified `v3.0.3`
- [x] CHANGELOG.md latest entry is the target release heading — Verified `[v3.0.3] - 2026-11-27`
- [x] CHANGELOG-ja.md latest entry is the target release heading — Verified `[v3.0.3] - 2026-11-27`

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — Verified via `tests/unit/readme-parity.test.ts` (10/10 PASS)
- [x] Simulation Model contains exactly 7 concepts — Verified via `tests/unit/readme-parity.test.ts`
- [x] Features contains exactly 8 fixed items — Verified via `tests/unit/readme-parity.test.ts`
- [x] Privacy contains exactly 4 semantic sections — Verified via `tests/unit/readme-parity.test.ts`
- [x] Deliberate Scope contains exactly 3 intentional limitations — Verified via `tests/unit/readme-parity.test.ts`
- [x] Documentation Gateway contains all required destinations — Verified via `tests/unit/readme-parity.test.ts`
- [x] #currency-semantics anchor resolves — Verified via `tests/unit/doc-links-integrity.test.ts`
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — Verified on disk and in HTML preview
- [x] Current release marker in both README files is the target release version — Verified `v3.0.3` in both READMEs
- [x] Disclaimer unchanged — Verified via `git diff`
- [x] License unchanged — Verified via `git diff`

## Documentation Integrity
- [x] All README documentation links resolve — Verified via `tests/unit/doc-links-integrity.test.ts`
- [x] No forbidden obsolete documentation path is used by current README links — Verified via `tests/unit/stale-paths.test.ts`
- [x] testing-guide.md matches actual test structure — Verified via `tests/unit/testing-guide-parity.test.ts` (3/3 PASS)
- [x] cli-usage.md examples match current CLI implementation — Verified via `tests/integration/cli.test.ts` (21/21 PASS) and CLI smoke check
- [x] No stale current-version marker remains — Verified 0 missed occurrences of `3.0.2` across all 11 surfaces
- [x] CHANGELOG EN/JA latest entries describe the target release — Verified `[v3.0.3] - 2026-11-27` in both files
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — Verified consistent
- [x] Confirm no internal agent/orchestration markers (e.g. internal workflow tokens, scratch paths, local-only directives) leaked into git-tracked public documentation or source diffs — Verified 0 leaks in tracked files

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — Verified exit code 0 (450ms)
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — Verified exit code 0

## Automated Tests
- [x] `npm test` passes all tests — `Test Files 45 passed (45)` / `Tests 443 passed (443)`
- [x] Automated smoke tool passes (`node <local-smoke-tool>`) — Verified `BROWSER_DONE 48` (0 console errors) and `CLI_SMOKE_ALL_OK`

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — Verified (PASS `sim.run`)
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — Verified (PASS `sim.summary`)
- [x] The total assets progression graph is rendered — Verified (PASS `sim.assetChart`)
- [x] The downside focus toggle works (show only 50% or below) — Verified (PASS `sim.downside`)
- [x] "Save image" succeeds — Verified (PASS `sim.saveImage`)
- [x] "Post to X" generates the correct URL — Verified (PASS `sim.shareX`)
- [x] "Open another tab with the same conditions" works — Verified (PASS `sim.openTab`)
- [x] "Copy analysis result URL link" works — Verified (PASS `sim.copyUrl`)

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — Verified (PASS `risk.below`)
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — Verified (PASS `risk.sell`)
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — Verified via `tests/integration/belowinit-charts.test.ts` and browser smoke
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — Verified via `tests/integration/belowinit-charts.test.ts`
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — Verified via `tests/unit/chart-helpers.test.ts`
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — Verified (PASS `risk.noDownside`)
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — Verified via `tests/integration/belowinit-charts.test.ts` and PASS `en.switch`

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — Verified (PASS `an.base`)
- [x] Clicking a factor card selects/deselects it — Verified (PASS `an.select`)
- [x] The number of selected factors and scenarios is updated correctly — Verified (PASS `an.count`)
- [x] "Run Analysis" displays the comparison table — Verified (PASS `an.run`)
- [x] The target table is displayed correctly — Verified (PASS `an.target`)
- [x] Switching the evaluation metric updates the table and labels — Verified (PASS `an.metric`)
- [x] Deselecting all factors displays "Please select a factor" — Verified (PASS `an.empty`)
- [x] The "Edit conditions in Simulation tab" button switches tabs — Verified (PASS `an.edit`)

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — Verified (PASS `cmp.open`)
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — Verified (PASS `cmp.add`, `cmp.dup`)
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — Verified (PASS `cmp.cancelDel`)
- [x] The column order can be changed with the left/right move buttons — Verified (PASS `cmp.move`)
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — Verified (PASS `cmp.hint`)
- [x] The common seed and common path count can be changed — Verified (PASS `cmp.common`)
- [x] A red border animation is displayed when an input value is clamped out of range — Verified via `tests/integration/comparison-ui.test.ts`
- [x] After entering a numeric value, pressing Tab moves focus to the next field — Verified via `tests/integration/comparison-ui.test.ts`
- [x] "Run All" executes all scenarios sequentially — Verified (PASS `cmp.runAllDone`)
- [x] All operation buttons are disabled during execution — Verified via `tests/unit/comparison-runner.test.ts`
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — Verified via `tests/unit/comparison-state.test.ts`
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — Verified (PASS `cmp.runAllDone`)
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — Verified (PASS `cmp.oku`)
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — Verified (PASS `cmp.man`)
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — Verified (PASS `cmp.bai`)
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — Verified (PASS `en.units`)
- [x] In English mode, "x" is displayed to the right of the replenishment pace — Verified via `tests/unit/comparison-ui.test.ts`
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — Verified via `tests/unit/comparison-ui.test.ts`
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — Verified via `tests/unit/comparison-ui.test.ts`
- [x] In English mode, the value is maintained even after editing targetAssetRatio — Verified via `tests/unit/comparison-ui.test.ts`
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — Verified (PASS `mobile viewport 390x844`)
- [x] Confirm that the scroll position is maintained after the table is redrawn — Verified via `tests/integration/comparison-ui.test.ts`
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — Verified via `src/app/ui-helpers.ts` (`focusin`/`focusout` handlers)
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — Verified via `tests/integration/comparison-ui.test.ts`
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — Verified via `tests/integration/comparison-ui.test.ts`
- [x] After editing a scenario name, the name on screen is immediately updated — Verified (PASS `cmp.rename`)
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — Verified via `tests/integration/comparison-ui.test.ts`
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — Verified (PASS `cmp.rename`, `cmp.runAllDone`)
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — Verified (PASS `cmp.selects`, `console.errors none`)
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — Verified across browser smoke tab transitions
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — Verified (PASS `an.base`)
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — Verified (PASS `console.ref`)
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — Verified (PASS `en.switch`, `console.errors none`)
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — Verified valid table markup in browser smoke DOM
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — Verified (PASS `console.ref`, `console.errors none`)

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — Verified via headless Chromium (`BROWSER_DONE 48`)
- [x] Mobile display (responsive) is not broken — Verified (PASS `mobile viewport 390x844`)

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — Verified (PASS `en.switch`)
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — Verified (PASS `en.noJa`)
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — Verified (PASS `en.units`)
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — Verified via `tests/unit/i18n.test.ts` and browser smoke
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — Verified via `tests/integration/analysis-ui.test.ts`
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — Verified via `tests/integration/analysis-ui.test.ts`
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — Verified via `tests/unit/ui-helpers-currency.test.ts`
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — Verified via `tests/unit/chart-helpers.test.ts`
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — Verified (PASS `sim.saveImage`)
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — Verified (PASS `sim.shareX`, `sim.copyUrl`, `sim.openTab`)

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node dist/cli.js run <sample.json>` generates a full result JSON under `output/fire-sim/` and outputs a scalar summary to stdout — Verified via CLI smoke check (`CLI_SMOKE_ALL_OK`)
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — Verified `SCALAR_FIELDS` (`successRate: 90.12`, `finalMedian: 477095552`, `targetAssetMaintainRate: 80.28`)
- [x] Confirm that `output/` output files do **not** appear in `git status` (`output/` is gitignored) — Verified `GITIGNORE_OK`
- [x] `node dist/cli.js run <file> --no-file` outputs summary to stdout without creating any output file — Verified `STDOUT_JSON_OK`
- [x] `node dist/cli.js run <file> --stdout` outputs full result JSON directly to stdout — Verified `STDOUT_JSON_OK 329526`
- [x] `node dist/cli.js run <file> --compact` outputs minified single-line JSON — Verified `COMPACT_OK`
- [x] `node dist/cli.js run <file> --out output/custom/output.json` creates the directory automatically and writes the file — Verified `CUSTOM_OUT_OK`

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — Verified `3.0.3`
- [x] `src/i18n.ts` `getAppVersion()` fallback return value matches target release version — Verified `3.0.3`
- [x] `src/cli.ts` `getCliVersion()` fallback return value matches target release version — Verified `3.0.3` (`getPackageVersion()`)
- [x] `index.html` all version occurrences match target release version: — Verified all 5 occurrences match `3.0.3` / `v3.0.3`
  - [x] `<meta name="app-version">` — Verified `3.0.3`
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — Verified `3.0.3`
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — Verified `3.0.3`
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — Verified `v3.0.3`
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — Verified `v3.0.3`
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — Verified via `tests/unit/version-parity.test.ts` (11/11 PASS)
- [x] `docs.html` meta tag matches target release version — Verified `3.0.3`
- [x] `docs/internal/style-guide.md` example query strings match target release version — Verified `3.0.3`
- [x] Run exhaustive workspace text search (searching for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — Verified 0 missed occurrences of `3.0.2` across all 11 surfaces
- [x] Run semver allowlist scan across executable source files (`src/`, `index.html`, `docs.html`, `dist/cli.js`) to verify zero unapproved semver literals remain — Verified via `tests/unit/version-parity.test.ts`

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`output/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — Verified generated at `output/github_preview_readme_en.html` and `output/github_preview_readme_ja.html`
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — Verified relative image assets resolve with base href
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — Links provided in release gate handoff summary
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — Verified rendered via official GitHub Markdown API
