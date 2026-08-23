# Pre-Release Smoke Test Manual (v2.8.7)

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

- Target version: 2.8.7
- Working branch name: release/v2.8.7
- What changed in this release: Audit remediation: Version fallback sync & guard, RNG call order doc correction, unreferenced test stub & comment cleanups, fixture translation, CLI usage placeholder standardization, and release checklist hardening.
- What did not change: Simulation core engine, mathematical models, UI layout/styling, and calculation logic were not modified (simulation-core source files untouched).

### Document-Impact Table (14 entries covering all 18 changed files)

| Path | Impact this release |
|---|---|
| package.json / package-lock.json | Version 2.8.7 |
| README.md / README-ja.md | Current-release marker only (v2.8.7) |
| CHANGELOG.md / CHANGELOG-ja.md | New latest v2.8.7 entry only |
| index.html | meta, CSS queries, footer, #capFooterUrl (v2.8.7); standardized boot language invariant comments |
| docs.html | CSS query (?v=2.8.7) |
| docs/internal/style-guide.md | Example CSS query strings (?v=2.8.7) |
| js/i18n.js | getAppVersion() fallback version ('2.8.7'); removed internal marker |
| js/analysis-state.js | Removed unreferenced _setAvailableFactorsForTest() stub and stale hack comment |
| js/core/url.js | Standardized boot/URL initialization order comment to focus on invariants |
| docs/explanation/reproducibility.md | Correct RNG call order description |
| docs/guide/cli-usage.md | Standardize meta object with semver & timestamp placeholders |
| tests/fixtures/analysis-dom-snippet.html | English comment translation |
| tests/unit/i18n.test.js | Added automated fallback & DOM priority version tests with DOM cleanup |
| docs/internal/release-checklist.md | Overwritten from template; v2.8.7 H1, scope, and verification records |


## Release Identity / Metadata
- [x] Target release branch (release/v2.8.7) is checked out and separated from main — verified: current branch is release/v2.8.7
- [x] Target version conforms to Semantic Versioning specification (MAJOR/MINOR/PATCH based on scope of changes) — verified: patch release 2.8.7 conforming to SemVer for bug fixes, doc sync, and test/comment cleanups
- [x] package.json version is the target release version — verified: correctly updated to 2.8.7
- [x] package-lock.json top-level version is the target release version — verified: correctly updated to 2.8.7
- [x] package-lock.json packages[""].version is the target release version — verified: correctly updated to 2.8.7
- [x] js/i18n.js getAppVersion() fallback is the target release version — verified: correctly updated to 2.8.7
- [x] README.md current release marker is the target release version — verified: correctly updated to v2.8.7
- [x] README-ja.md current release marker is the target release version — verified: correctly updated to v2.8.7
- [x] CHANGELOG.md latest entry is the target release heading — verified: added ## [v2.8.7]
- [x] CHANGELOG-ja.md latest entry is the target release heading — verified: added ## [v2.8.7]

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — verified: identical 13-section structure confirmed
- [x] Simulation Model contains exactly 7 concepts — verified: exactly 7 concepts verified
- [x] Features contains exactly 8 fixed items — verified: exactly 8 fixed feature items verified
- [x] Privacy contains exactly 4 semantic sections — verified: exactly 4 privacy subsections verified
- [x] Deliberate Scope contains exactly 3 intentional limitations — verified: exactly 3 intentional limitations verified
- [x] Documentation Gateway contains all required destinations — verified: all gateway links resolve cleanly
- [x] #currency-semantics anchor resolves — verified: anchor resolves to Overview section
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — verified: file exists and renders properly (342KB)
- [x] Current release marker in both README files is the target release version — verified: v2.8.7 in both README.md and README-ja.md
- [x] Disclaimer unchanged — verified: non-financial advice disclaimer preserved
- [x] License unchanged — verified: MIT License preserved

## Documentation Integrity
- [x] All README documentation links resolve — verified: all internal relative links resolve without 404
- [x] No forbidden obsolete documentation path is used by current README links — verified: no obsolete paths detected
- [x] testing-guide.md matches actual test structure — verified: test guide matches current 28 vitest suites
- [x] cli-usage.md examples match current CLI implementation — verified: CLI options, syntax, and schema match cli.js
- [x] No stale current-version marker remains — verified: all surfaces sweeped and updated to 2.8.7
- [x] CHANGELOG EN/JA latest entries describe the target release — verified: both CHANGELOG.md and CHANGELOG-ja.md updated for v2.8.7
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — verified: overview.md content matches README source sections
- [x] Confirm no internal agent/orchestration markers (e.g. internal workflow tokens, scratch paths, local-only directives) leaked into git-tracked public documentation or source diffs — verified: git diff scan confirmed zero internal tokens in tracked files

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — verified: built cleanly in 753ms
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — verified: zero diff against css/tailwind.css

## Automated Tests
- [x] `npm test` passes all tests — verified: Test Files 28 passed (28) / Tests 265 passed (265)

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — verified: pass (sim.run)
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — verified: pass (sim.summary: FIRE 成功率 93.3% 最終総資産 中央値 5.1億円 目標資産維持確率 83.2%)
- [x] The total assets progression graph is rendered — verified: pass (sim.assetChart)
- [x] The downside focus toggle works (show only 50% or below) — verified: pass (sim.downside: toggled false -> true)
- [x] "Save image" succeeds — verified: pass (sim.saveImage)
- [x] "Post to X" generates the correct URL — verified: pass (sim.shareX)
- [x] "Open another tab with the same conditions" works — verified: pass (sim.openTab)
- [x] "Copy analysis result URL link" works — verified: pass (sim.copyUrl)

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — verified: pass (risk.below)
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — verified: pass (risk.sell)
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — verified: pass
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — verified: pass
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — verified: pass
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — verified: pass (risk.noDownside)
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — verified: pass

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — verified: pass (an.base)
- [x] Clicking a factor card selects/deselects it — verified: pass (an.select)
- [x] The number of selected factors and scenarios is updated correctly — verified: pass (an.count)
- [x] "Run Analysis" displays the comparison table — verified: pass (an.run)
- [x] The target table is displayed correctly — verified: pass (an.target)
- [x] Switching the evaluation metric updates the table and labels — verified: pass (an.metric)
- [x] Deselecting all factors displays "Please select a factor" — verified: pass (an.empty)
- [x] The "Edit conditions in Simulation tab" button switches tabs — verified: pass (an.edit)

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — verified: pass (cmp.open)
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — verified: pass (cmp.add, cmp.dup)
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — verified: pass (cmp.cancelDel)
- [x] The column order can be changed with the left/right move buttons — verified: pass (cmp.move)
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — verified: pass (cmp.hint)
- [x] The common seed and common path count can be changed — verified: pass (cmp.common)
- [x] A red border animation is displayed when an input value is clamped out of range — verified: pass
- [x] After entering a numeric value, pressing Tab moves focus to the next field — verified: pass
- [x] "Run All" executes all scenarios sequentially — verified: pass (cmp.runAll, cmp.runAllDone)
- [x] All operation buttons are disabled during execution — verified: pass
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — verified: pass
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — verified: pass
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — verified: pass (cmp.oku)
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — verified: pass (cmp.man)
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — verified: pass (cmp.bai)
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — verified: pass (en.units)
- [x] In English mode, "x" is displayed to the right of the replenishment pace — verified: pass
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — verified: pass
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — verified: pass
- [x] In English mode, the value is maintained even after editing targetAssetRatio — verified: pass
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — verified: pass (mobile viewport 390x844)
- [x] Confirm that the scroll position is maintained after the table is redrawn — verified: pass
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — verified: pass
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — verified: pass
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — verified: pass
- [x] After editing a scenario name, the name on screen is immediately updated — verified: pass (cmp.rename)
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — verified: pass
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — verified: pass
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — verified: pass (cmp.selects)
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — verified: pass
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — verified: pass
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — verified: pass (console.ref)
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — verified: pass
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — verified: pass
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — verified: pass (console.ref)

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — verified: Chrome headless completed all 39 checks cleanly
- [x] Mobile display (responsive) is not broken — verified: mobile viewport 390x844 layout verified

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — verified: pass (en.switch)
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — verified: pass (en.noJa)
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — verified: pass (en.units)
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — verified: pass
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — verified: pass
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — verified: pass
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — verified: pass
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — verified: pass
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — verified: pass
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — verified: pass

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node cli.js run <sample.json>` generates a full result JSON under `output/fire-sim/` and outputs a scalar summary to stdout — verified: created run-2026-08-23T01-39-45-seed123456.json under output/fire-sim/
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — verified: successRate 90.12, finalMedian 477095552, targetAssetMaintainRate 80.28
- [x] Confirm that `output/` output files do **not** appear in `git status` (`output/` is gitignored) — verified: git status clean for output/ (GITIGNORE_OK)
- [x] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file — verified: pass (--no-file created 0 files)
- [x] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout — verified: pass (329573 bytes JSON)
- [x] `node cli.js run <file> --compact` outputs minified single-line JSON — verified: pass (single line JSON)
- [x] `node cli.js run <file> --out output/custom/output.json` creates the directory automatically and writes the file — verified: pass (output.json created)

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — verified: 2.8.7
- [x] `js/i18n.js` `getAppVersion()` fallback return value matches target release version — verified: 2.8.7
- [x] `index.html` all version occurrences match target release version: — verified: all occurrences match 2.8.7
  - [x] `<meta name="app-version">` — verified: content="2.8.7"
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — verified: href="css/tailwind.css?v=2.8.7"
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — verified: href="css/style.css?v=2.8.7"
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — verified: <span>v2.8.7</span>
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — verified: | v2.8.7
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — verified: unit tests in tests/unit/i18n.test.js passed (both fallback without meta and DOM priority verified)
- [x] `docs.html` CSS query strings match target release version — verified: href="css/style.css?v=2.8.7"
- [x] `docs/internal/style-guide.md` example query strings match target release version — verified: href="css/tailwind.css?v=2.8.7" & style.css?v=2.8.7
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — verified: No stale release-version literals found outside historical CHANGELOG entries and explicitly allowlisted external dependency versions.
- [x] Run semver allowlist scan across executable source files (`js/`, `index.html`, `docs.html`, `cli.js`) to verify zero unapproved semver literals remain — verified: zero unapproved semver literals found

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`output/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — verified: generated cleanly in output/
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — verified: asset resolution verified
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — verified: output/github_preview_readme_en.html & output/github_preview_readme_ja.html
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — verified: clean layout confirmed
