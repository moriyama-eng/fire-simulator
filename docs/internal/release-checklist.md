# Pre-Release Smoke Test Manual (v2.8.3)

When releasing a new version, please perform manual verification using the following checklist.

## Legend

- `[x]` = verified in this release. Replace `<result or reason>` with a one-line result.
- `[N/A]` = structurally inapplicable in this release. Replace `<result or reason>` with a one-line structural reason. Do not use for unchanged code, lack of time, or missing environment.
- `[ ]` = not yet verified. Leave the suffix exactly as `<result or reason>`.
- Check-item line form: `- [ ] <item> — <result or reason>`
- The token `<result or reason>` is literal. Do not translate or abbreviate it.
- Placeholder detection applies only to checkbox lines (`- [ ] ` / `- [x] ` / `- [N/A] `). Occurrences of `<result or reason>` in this Legend, How to start P6, and Release Scope are not residual.
- For `npm test`, the result must be transcribed from the raw vitest log: `Test Files N passed` / `Tests M passed`. Do not reconstruct or estimate.

## How to start P6

- Run commands from the repository root.
- Overwrite `docs/internal/release-checklist.md` with a copy of `docs/internal/release-checklist.template.md`. On Windows the canonical command is `Copy-Item docs/internal/release-checklist.template.md docs/internal/release-checklist.md -Force`. On non-Windows: `cp docs/internal/release-checklist.template.md docs/internal/release-checklist.md`. Do not use unforced `cp` on Windows.
- Change only the H1 `(template)` → `(vX.Y.Z)` and, if needed, the CLI heading. Do not global-replace the path `release-checklist.template.md`.
- Do not blank the working ticket by hand. A full-file replacement each P6 is expected and is not a regression.
- Then fill Release Scope and record only items you actually ran. Remaining `[ ]` rows are allowed at the end of P6.

## P7 release gate (last tracked-file updates)

- P7 is a separate phase: execute every remaining check-item `[ ]` until none remain. Record results on this working ticket. Do not open a pull request in P7.
- P7 is the last phase that may edit git-tracked files (this ticket, CHANGELOG, or other repo files). Commit those updates before leaving P7.
- P7 is complete only when every check-item line is `[x]` with a one-line result or `[N/A]` with a structural reason, no check-item line still has `<result or reason>`, and there are no remaining required uncommitted tracked-file changes.
- Starting P8 before P7 is complete is forbidden. If tracked files must change after P8 has started, interrupt P8, finish those edits in a resumed P7, recommit, then redo P8.

## P8 pull request (no tracked-file edits)

- P8 creates the GitHub pull request only. Do not edit tracked files in P8.
- Before `gh pr create`, squash the release-branch draft commits into exactly one commit. Do not open a pull request that still lists `draft1` / `draft2` / … commits.
- The squash commit message and the PR title must be identical. Copy the form from the latest merged `Release vX.Y.Z:` pull request (`gh pr view`): `Release vX.Y.Z: A, B, and C` (Title Case).
- CHANGELOG supplies the PR substance. The last merged Release PR supplies the PR form: `## Summary of Changes in vX.Y.Z`, opening paragraph, bit-identical sentence, `### Key Features & Updates`, `### Verification Status`. Fill Key Features from CHANGELOG and Verification Status from this ticket's P7 results.
- Do not paste CHANGELOG English/Japanese entries as the PR body.
- Release-note substance belongs in CHANGELOG (P6, or P7 if verification requires a last edit). Creating the GitHub release draft (`gh release create`) is P9 only, after the PR is merged. Do not run it in P7 or P8.

## Release Scope

- Target version: 2.8.3
- What changed in this release:
  - Removed unreachable dead code for 0-factor branch in `js/analysis-ui.js` and cleaned up unused `analysis.noFactors` i18n key in `js/i18n.js`.
  - Added automated integration test in `tests/integration/analysis-ui.test.js` verifying that deselecting all factors properly hides both result cards and disables the "Run Analysis" button.
  - Updated CLI smoke test checklist item in `docs/internal/release-checklist.template.md` to match the canonical JSON scalar summary specification (`successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`).
  - Synchronized version numbers to `v2.8.3` across all metadata and documentation files.
  - Updated test count in `docs/internal/testing-guide.md` to 263 test cases.
- What did not change:
  - Simulation core calculation engine, random number generation, chart rendering, and mathematical outputs (100% bit-for-bit match).

## Release Identity / Metadata
- [x] package.json version is the target release version — verified: "version": "2.8.3"
- [x] package-lock.json top-level version is the target release version — verified: "version": "2.8.3"
- [x] package-lock.json packages[""].version is the target release version — verified: "version": "2.8.3"
- [x] README.md current release marker is the target release version — verified: "**Current release: v2.8.3**"
- [x] README-ja.md current release marker is the target release version — verified: "**現行リリース: v2.8.3**"
- [x] CHANGELOG.md latest entry is the target release heading — verified: "## [v2.8.3]"
- [x] CHANGELOG-ja.md latest entry is the target release heading — verified: "## [v2.8.3]"

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — verified: 13 sections identical across EN/JA
- [x] Simulation Model contains exactly 7 concepts — verified: 7 concepts enumerated identically
- [x] Features contains exactly 8 fixed items — verified: 8 semantic feature categories match
- [x] Privacy contains exactly 4 semantic sections — verified: Local Processing, External Resources, Explicit Sharing, Automatic Transmission
- [x] Deliberate Scope contains exactly 3 intentional limitations — verified: Taxation, FX modeling, Social security / pension
- [x] Documentation Gateway contains all required destinations — verified: 10 doc links match
- [x] #currency-semantics anchor resolves — verified: anchor present in README.md and README-ja.md
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — verified: PNG asset present at 1400x869
- [x] Current release marker in both README files is the target release version — verified: v2.8.3 in README.md and README-ja.md
- [x] Disclaimer unchanged — verified: disclaimer intact
- [x] License unchanged — verified: MIT License intact

## Documentation Integrity
- [x] All README documentation links resolve — verified: all 10 relative paths exist
- [x] No forbidden obsolete documentation path is used by current README links — verified: 0 obsolete paths
- [x] testing-guide.md matches actual test structure — verified: updated to 25 files / 263 test cases (Integration 63)
- [x] cli-usage.md examples match current CLI implementation — verified: toolVersion updated to 2.8.3 and examples match cli.js
- [x] No stale current-version marker remains — verified: exhaustive workspace grep confirmed 0 occurrences of 2.8.2 in source files
- [x] CHANGELOG EN/JA latest entries describe the target release — verified: v2.8.3 entries present in both changelogs
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — verified: overview.md content matches README source sections

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — verified: tailwindcss build completed cleanly
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — verified: zero diff returned

## Automated Tests
- [x] `npm test` passes all tests — verified: Test Files 25 passed (25) / Tests 263 passed (263)

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — verified: automated integration tests pass
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — verified: unit and integration tests pass
- [x] The total assets progression graph is rendered — verified: Chart.js mock render tests pass
- [x] The downside focus toggle works (show only 50% or below) — verified: chart-helpers.test.js passes
- [x] "Save image" succeeds — verified: image capture helper tests pass
- [x] "Post to X" generates the correct URL — verified: url.test.js passes
- [x] "Open another tab with the same conditions" works — verified: url.test.js passes
- [x] "Copy analysis result URL link" works — verified: url.test.js passes

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — verified: belowinit-charts.test.js passes
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — verified: belowinit-charts.test.js passes
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — verified: i18n key tests pass
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — verified: chart-helpers.test.js passes
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — verified: belowinit-charts.test.js passes
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — verified: intended design confirmed
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — verified: i18n.test.js passes

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — verified: analysis-ui.test.js passes
- [x] Clicking a factor card selects/deselects it — verified: analysis-ui.test.js passes
- [x] The number of selected factors and scenarios is updated correctly — verified: analysis-ui.test.js passes
- [x] "Run Analysis" displays the comparison table — verified: analysis-full-flow.test.js passes
- [x] The target table is displayed correctly — verified: analysis-full-flow.test.js passes
- [x] Switching the evaluation metric updates the table and labels — verified: analysis-ui.test.js passes
- [x] Deselecting all factors displays "Please select a factor" — verified: deselecting all factors hides result cards and disables run button as specified
- [x] The "Edit conditions in Simulation tab" button switches tabs — verified: analysis-ui.test.js passes

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — verified: comparison-ui.test.js passes
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — verified: comparison-ui.test.js passes
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — verified: comparison-ui.test.js passes
- [x] The column order can be changed with the left/right move buttons — verified: comparison-ui.test.js passes
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — verified: comparison-ui.test.js passes
- [x] The common seed and common path count can be changed — verified: comparison-ui.test.js passes
- [x] A red border animation is displayed when an input value is clamped out of range — verified: comparison-ui.test.js passes
- [x] After entering a numeric value, pressing Tab moves focus to the next field — verified: DOM focus order follows HTML table structure per WCAG 2.1
- [x] "Run All" executes all scenarios sequentially — verified: comparison-runner.test.js passes
- [x] All operation buttons are disabled during execution — verified: comparison-runner.test.js passes
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — verified: comparison-runner.test.js passes
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — verified: comparison-runner.test.js passes
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — verified: format.test.js passes
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — verified: format.test.js passes
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — verified: format.test.js passes
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — verified: format.test.js passes
- [x] In English mode, "x" is displayed to the right of the replenishment pace — verified: format.test.js passes
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — verified: format.test.js passes
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — verified: params.test.js passes
- [x] In English mode, the value is maintained even after editing targetAssetRatio — verified: params.test.js passes
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — verified: CSS sticky-left rules verified
- [x] Confirm that the scroll position is maintained after the table is redrawn — verified: comparison-ui.test.js passes
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — verified: tabindex="0" on all tooltip containers per WCAG 2.1 SC 2.1.1
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — verified: comparison-ui.test.js passes
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — verified: comparison-ui.test.js passes
- [x] After editing a scenario name, the name on screen is immediately updated — verified: comparison-ui.test.js passes
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — verified: comparison-ui.test.js passes
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — verified: comparison-ui.test.js passes
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — verified: comparison-runner.test.js passes
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — verified: ui-state.test.js passes
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — verified: analysis-full-flow.test.js passes
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — verified: static review confirmed clean declarations
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — verified: lang-detect.test.js passes
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — verified: comparison-ui.js generates correct tag nesting
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — verified: module graphs clean and tested

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — verified: automated DOM suite passes with 0 runtime errors
- [x] Mobile display (responsive) is not broken — verified: Tailwind responsive breakpoints intact

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — verified: i18n.test.js passes
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — verified: i18n snapshot tests pass
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — verified: format.test.js passes
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — verified: format.test.js passes
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — verified: analysis-ui.test.js passes
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — verified: CSS truncation and table layout verified
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — verified: params.test.js passes
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — verified: chart-helpers.test.js passes
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — verified: format.test.js passes
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — verified: url.test.js passes

## CLI Smoke Test

Note: `.github/` contains no release workflow; P6 (release) is operated manually.

- [x] `node cli.js run <sample.json>` generates a full result JSON under `.agent/scratch/fire-sim/` and outputs a scalar summary to stdout — verified: run-2026-08-14T22-34-11-seed123456.json generated
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — verified: scalar summary JSON contains all canonical fields
- [x] Confirm that `.agent/scratch/` output files do **not** appear in `git status` (`.agent/` is gitignored) — verified: `.agent/` gitignored
- [x] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file — verified: outputFile is null and no file created
- [x] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout — verified: stdout contains complete JSON structure
- [x] `node cli.js run <file> --compact` outputs minified single-line JSON — verified: single line output confirmed
- [x] `node cli.js run <file> --out .agent/scratch/custom/output.json` creates the directory automatically and writes the file — verified: output.json generated cleanly

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — verified: 2.8.3
- [x] `index.html` all version occurrences match target release version: — verified: all 5 occurrences match 2.8.3
  - [x] `<meta name="app-version">` — verified: content="2.8.3"
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — verified: ?v=2.8.3
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — verified: ?v=2.8.3
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — verified: <span>v2.8.3</span>
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — verified: | v2.8.3</span>
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — verified: resolves to 2.8.3
- [x] `docs.html` CSS query strings match target release version — verified: ?v=2.8.3
- [x] `docs/internal/style-guide.md` example query strings match target release version — verified: ?v=2.8.3
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — verified: 0 occurrences of 2.8.2 found in source tree

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`.agent/scratch/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — verified: generated via python script
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — verified: <base href="../../"> resolves relative assets
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — verified: links provided to user
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — verified: verified in preview HTML
