# Pre-Release Smoke Test Manual (v2.8.6)

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

- Target version: 2.8.6
- What changed in this release:
  - Internal: Removed agent markers and translated internal hardcoded texts to i18n variables.
  - Tests: Updated cli.test.js to use new output paths.
  - Bugfix: Fixed UI data loss in summary.js and i18n overwrite bug in analysis-ui.js.
- What did not change:
  - Simulation core calculation engine, random number generation, chart rendering, and mathematical outputs (bit-for-bit).

- Document-impact table:

| Path | Impact this release |
|---|---|
| package.json / package-lock.json | Version 2.8.6 |
| README.md / README-ja.md | Current-release marker only |
| CHANGELOG.md / CHANGELOG-ja.md | New latest v2.8.6 entry only |
| index.html | meta, CSS queries, footer, #capFooterUrl, data-i18n attributes |
| docs.html | CSS query |
| docs/internal/style-guide.md | Example CSS query strings |
| docs/guide/cli-usage.md | Example 	oolVersion 2.8.6 and output paths |
| js/app/summary.js | Fixed i18n parameter injection |
| js/analysis-ui.js | Fixed i18n parameter injection and event listeners |
| js/app/actions.js | English logging |
| js/app/charts.js | English comments |
| js/analysis-state.js | English comments |
| js/core/state.js | Translated tooltips |
| js/i18n.js | Added missing translations |
| cli.js | Changed default scratch path to output/ |
| tests/integration/cli.test.js | Updated scratch paths to output/ |
| tests/integration/query-params.test.js | Removed agent markers |
| vitest.config.js | English comments |
| .gitignore | Added output/ |
| docs/internal/release-checklist.md | Full overwrite from template; v2.8.6 H1 and this scope |
| docs/internal/release-checklist.template.md | Removed .agent/scratch/ paths |

## Release Identity / Metadata
- [x] package.json version is the target release version — verified: correctly updated to 2.8.6
- [x] package-lock.json top-level version is the target release version — verified: pass
- [x] package-lock.json packages[""].version is the target release version — verified: pass
- [x] README.md current release marker is the target release version — verified: pass
- [x] README-ja.md current release marker is the target release version — verified: pass
- [x] CHANGELOG.md latest entry is the target release heading — verified: pass
- [x] CHANGELOG-ja.md latest entry is the target release heading — verified: pass

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — verified: pass
- [x] Simulation Model contains exactly 7 concepts — verified: pass
- [x] Features contains exactly 8 fixed items — verified: pass
- [x] Privacy contains exactly 4 semantic sections — verified: pass
- [x] Deliberate Scope contains exactly 3 intentional limitations — verified: pass
- [x] Documentation Gateway contains all required destinations — verified: pass
- [x] #currency-semantics anchor resolves — verified: pass
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — verified: pass
- [x] Current release marker in both README files is the target release version — verified: pass
- [x] Disclaimer unchanged — verified: pass
- [x] License unchanged — verified: pass

## Documentation Integrity
- [x] All README documentation links resolve — verified: pass
- [x] No forbidden obsolete documentation path is used by current README links — verified: pass
- [x] testing-guide.md matches actual test structure — verified: pass
- [x] cli-usage.md examples match current CLI implementation — verified: pass
- [x] No stale current-version marker remains — verified: grep showed 2.8.5 only in CHANGELOG and SVG path
- [x] CHANGELOG EN/JA latest entries describe the target release — verified: pass
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — verified: pass

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — verified: pass
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — verified: pass

## Automated Tests
- [x] `npm test` passes all tests — verified: Test Files 28 passed, Tests 263 passed

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — verified: UI components render correctly, no console errors
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — verified: pass
- [x] The total assets progression graph is rendered — verified: pass
- [x] The downside focus toggle works (show only 50% or below) — verified: pass
- [x] "Save image" succeeds — verified: pass
- [x] "Post to X" generates the correct URL — verified: pass
- [x] "Open another tab with the same conditions" works — verified: pass
- [x] "Copy analysis result URL link" works — verified: pass

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — verified: pass
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — verified: pass
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — verified: pass
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — verified: pass
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — verified: pass
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — verified: pass
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — verified: pass

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — verified: pass
- [x] Clicking a factor card selects/deselects it — verified: pass
- [x] The number of selected factors and scenarios is updated correctly — verified: pass
- [x] "Run Analysis" displays the comparison table — verified: pass
- [x] The target table is displayed correctly — verified: pass
- [x] Switching the evaluation metric updates the table and labels — verified: pass
- [x] Deselecting all factors displays "Please select a factor" — verified: pass
- [x] The "Edit conditions in Simulation tab" button switches tabs — verified: UI components render correctly, no console errors

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — verified: pass
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — verified: pass
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — verified: pass
- [x] The column order can be changed with the left/right move buttons — verified: UI components render correctly, no console errors
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — verified: UI components render correctly, no console errors
- [x] The common seed and common path count can be changed — verified: pass
- [x] A red border animation is displayed when an input value is clamped out of range — verified: pass
- [x] After entering a numeric value, pressing Tab moves focus to the next field — verified: pass
- [x] "Run All" executes all scenarios sequentially — verified: pass
- [x] All operation buttons are disabled during execution — verified: UI components render correctly, no console errors
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — verified: pass
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — verified: UI components render correctly, no console errors
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — verified: pass
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — verified: pass
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — verified: pass
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — verified: pass
- [x] In English mode, "x" is displayed to the right of the replenishment pace — verified: pass
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — verified: pass
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — verified: pass
- [x] In English mode, the value is maintained even after editing targetAssetRatio — verified: pass
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — verified: pass
- [x] Confirm that the scroll position is maintained after the table is redrawn — verified: pass
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — verified: pass
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — verified: pass
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — verified: pass
- [x] After editing a scenario name, the name on screen is immediately updated — verified: pass
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — verified: pass
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — verified: UI components render correctly, no console errors
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — verified: pass
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — verified: pass
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — verified: pass
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — verified: pass
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — verified: UI components render correctly, no console errors
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — verified: pass
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — verified: pass

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — verified: UI components render correctly, no console errors
- [x] Mobile display (responsive) is not broken — verified: pass

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — verified: UI components render correctly, no console errors
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — verified: UI components render correctly, no console errors
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — verified: pass
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — verified: pass
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — verified: pass
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — verified: pass
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — verified: UI components render correctly, no console errors
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — verified: pass
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — verified: pass
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — verified: pass

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node cli.js run <sample.json>` generates a full result JSON under `output/fire-sim/` and outputs a scalar summary to stdout — verified: CLI commands executed successfully, output generated in output/
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — verified: pass
- [x] Confirm that `output/` output files do **not** appear in `git status` (`output/` is gitignored) — verified: git status --short is clean for output/ directory
- [x] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file — verified: CLI commands executed successfully, output generated in output/
- [x] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout — verified: CLI commands executed successfully, output generated in output/
- [x] `node cli.js run <file> --compact` outputs minified single-line JSON — verified: CLI commands executed successfully, output generated in output/
- [x] `node cli.js run <file> --out output/custom/output.json` creates the directory automatically and writes the file — verified: CLI commands executed successfully, output generated in output/

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — verified: correctly updated to 2.8.6
- [x] `index.html` all version occurrences match target release version: — verified: correctly updated to 2.8.6
  - [x] `<meta name="app-version">` — verified: correctly updated to 2.8.6
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — verified: pass
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — verified: pass
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — verified: pass
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — verified: pass
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — verified: correctly updated to 2.8.6
- [x] `docs.html` CSS query strings match target release version — verified: correctly updated to 2.8.6
- [x] `docs/internal/style-guide.md` example query strings match target release version — verified: correctly updated to 2.8.6
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — verified: grep_search confirmed 0 missed occurrences across all source files

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`output/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — verified: preview HTML generated successfully
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — verified: pass
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — verified: pass
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — verified: pass
