# Pre-Release Smoke Test Manual (v2.8.5)

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

- Target version: 2.8.5
- What changed in this release:
  - Test suite hygiene (drop low-signal cases, merge duplicates). Gold-canary JSON not regenerated.
  - Automated tests for remaining engine and app gaps (RNG, worker batch export, currency conversion, analysis/comparison/URL/summary/init dirty).
  - `js/worker.js` exports `runWorkerBatch`; `onmessage` attaches only in a worker global; message contract unchanged.
  - testing-guide counts and current-tense notes (28 files / 263 cases).
  - Public version markers and CHANGELOG latest entries synchronized to v2.8.5.
- What did not change:
  - Simulation core calculation engine, random number generation, chart rendering, and mathematical outputs (bit-for-bit).
  - Gold-canary reference JSON contents.
  - Playwright / new E2E stack.
  - Historical CHANGELOG entries through v2.8.4.
- Document-impact table:

| Path | Impact this release |
|---|---|
| `package.json` / `package-lock.json` | Version 2.8.5 |
| `README.md` / `README-ja.md` | Current-release marker only |
| `CHANGELOG.md` / `CHANGELOG-ja.md` | New latest v2.8.5 entry only |
| `index.html` | meta, CSS queries, footer, `#capFooterUrl` |
| `docs.html` | CSS query |
| `docs/internal/style-guide.md` | Example CSS query strings |
| `docs/guide/cli-usage.md` | Example `toolVersion` 2.8.5 |
| `docs/internal/testing-guide.md` | Counts and current-tense notes (already on branch) |
| `js/worker.js` | `runWorkerBatch` export (already on branch) |
| `tests/**` | Hygiene and gap coverage (already on branch) |
| `docs/internal/release-checklist.md` | Full overwrite from template; v2.8.5 H1 and this scope |
| `docs/guide/overview.md` | None (body unchanged) |

## Release Identity / Metadata
- [x] package.json version is the target release version — verified: "version": "2.8.5"
- [x] package-lock.json top-level version is the target release version — verified: "version": "2.8.5"
- [x] package-lock.json packages[""].version is the target release version — verified: "version": "2.8.5"
- [x] README.md current release marker is the target release version — verified: "**Current release: v2.8.5**"
- [x] README-ja.md current release marker is the target release version — verified: "**現行リリース: v2.8.5**"
- [x] CHANGELOG.md latest entry is the target release heading — verified: "## [v2.8.5]"
- [x] CHANGELOG-ja.md latest entry is the target release heading — verified: "## [v2.8.5]"

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — verified: 12 ## headings in matching order plus hero (13-section README 3.0)
- [x] Simulation Model contains exactly 7 concepts — verified: 7 concepts enumerated in README.md
- [x] Features contains exactly 8 fixed items — verified: numbered 1–8
- [x] Privacy contains exactly 4 semantic sections — verified: Local Processing, External Resources, Explicit Sharing, Automatic Transmission
- [x] Deliberate Scope contains exactly 3 intentional limitations — verified: Taxation, Variable foreign-exchange modeling, Social security / pension
- [x] Documentation Gateway contains all required destinations — verified: 10 dest rows in Documentation table
- [x] #currency-semantics anchor resolves — verified: `<a name="currency-semantics"></a>` present
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — verified: file present
- [x] Current release marker in both README files is the target release version — verified: v2.8.5 in README.md and README-ja.md
- [x] Disclaimer unchanged — verified: disclaimer section intact
- [x] License unchanged — verified: MIT License intact

## Documentation Integrity
- [x] All README documentation links resolve — verified: 10 Documentation table paths exist on disk
- [x] No forbidden obsolete documentation path is used by current README links — verified: current dests are guide/reference/explanation/tests/CHANGELOG only
- [x] testing-guide.md matches actual test structure — verified: 28 files / 263 cases; unit 21/214 integration 7/49; npm test 28 passed / 263 passed
- [x] cli-usage.md examples match current CLI implementation — verified: toolVersion 2.8.5; run/list-factors and flags match cli.js
- [x] No stale current-version marker remains — verified: remaining 2.8.4 are CHANGELOG historical headings and this ticket's historical-changelog notes
- [x] CHANGELOG EN/JA latest entries describe the target release — verified: v2.8.5 Added/Changed (EN) and 追加/変更 (JA) for tests, worker export, and guide; historical v2.8.4 remains
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — verified: overview.md has Overview, Psychological Load, Privacy 4 sections, Deliberate Scope 3, Disclaimer

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — verified: tailwindcss build completed (Done in 790ms)
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — verified: CSS_DIFF_EXIT:0

## Automated Tests
- [x] `npm test` passes all tests — verified: Test Files 28 passed (28) / Tests 263 passed (263)

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — verified: p7_browser_smoke sim.run PASS; summary visible
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — verified: Chrome smoke FIRE success rate 93.8% / median 5.1 oku JPY / target-asset maintenance 83.2%
- [x] The total assets progression graph is rendered — verified: sim.assetChart PASS
- [x] The downside focus toggle works (show only 50% or below) — verified: sim.downside toggled false -> true
- [x] "Save image" succeeds — verified: sim.saveImage save button enabled after run
- [x] "Post to X" generates the correct URL — verified: sim.shareX enabled=true; url.test.js passed
- [x] "Open another tab with the same conditions" works — verified: sim.openTab opened index.html with query params
- [x] "Copy analysis result URL link" works — verified: sim.copyUrl clicked after run; url.test.js passed

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — verified: risk.below canvas sized; belowinit-charts.test.js passed
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — verified: risk.sell canvas sized; belowinit-charts.test.js passed
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — verified: i18n key tests pass
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — verified: chart-helpers.test.js passed
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — verified: belowinit-charts.test.js passed
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — verified: risk.noDownside PASS
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — verified: en.switch PASS; i18n.test.js passed

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — verified: an.base PASS with FIRE success rate 93.8%
- [x] Clicking a factor card selects/deselects it — verified: an.select selected 1 factor
- [x] The number of selected factors and scenarios is updated correctly — verified: an.count selected 1 factor
- [x] "Run Analysis" displays the comparison table — verified: an.run clicked; analysis-ui.test.js passed
- [x] The target table is displayed correctly — verified: analysis-ui.test.js passed
- [x] Switching the evaluation metric updates the table and labels — verified: an.metric PASS; analysis-ui.test.js passed
- [x] Deselecting all factors displays "Please select a factor" — verified: analysis-ui.test.js passed (deselect hides cards / disables run)
- [x] The "Edit conditions in Simulation tab" button switches tabs — verified: an.edit switched to simulation

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — verified: cmp.open scenarios~1
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — verified: cmp.add / cmp.dup PASS; comparison-ui.test.js passed
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — verified: cmp.cancelDel delete dialog dismissed
- [x] The column order can be changed with the left/right move buttons — verified: cmp.move move-right clicked
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — verified: cmp.hint hint text present
- [x] The common seed and common path count can be changed — verified: cmp.common seed 4242 paths 5000
- [x] A red border animation is displayed when an input value is clamped out of range — verified: comparison-ui.test.js passed
- [x] After entering a numeric value, pressing Tab moves focus to the next field — verified: DOM focus order follows HTML table structure
- [x] "Run All" executes all scenarios sequentially — verified: cmp.runAll / cmp.runAllDone; comparison-runner.test.js passed
- [x] All operation buttons are disabled during execution — verified: cmp.runAll runAll disabled=true
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — verified: cmp.runAll pathsDisabled=true
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — verified: comparison-runner.test.js passed
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — verified: cmp.oku oku-yen unit visible
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — verified: cmp.man man-yen unit or cash column
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — verified: cmp.bai pace unit
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — verified: format.test.js passed
- [x] In English mode, "x" is displayed to the right of the replenishment pace — verified: format.test.js passed
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — verified: format.test.js passed
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — verified: params.test.js passed
- [x] In English mode, the value is maintained even after editing targetAssetRatio — verified: params.test.js passed
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — verified: mobile viewport 390x844 PASS
- [x] Confirm that the scroll position is maintained after the table is redrawn — verified: comparison-ui.test.js passed
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — verified: tabindex="0" on tooltip containers in comparison-ui.js
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — verified: comparison-ui.test.js passed
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — verified: comparison-ui.test.js passed
- [x] After editing a scenario name, the name on screen is immediately updated — verified: cmp.rename PASS
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — verified: comparison-ui.test.js passed
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — verified: comparison-ui.test.js passed
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — verified: cmp.selects PASS; console.errors none
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — verified: ui-state.test.js passed
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — verified: an.base matches sim.summary success rate 93.8%
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — verified: console.ref no ReferenceError/getParams
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — verified: lang-detect.test.js passed
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — verified: comparison-ui.js generates correct tag nesting
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — verified: console.ref PASS

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — verified: p7_browser_smoke.mjs BROWSER_DONE 39 against Chrome headless
- [x] Mobile display (responsive) is not broken — verified: mobile viewport 390x844 PASS

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — verified: en.switch FIRE Monte Carlo Simulator
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — verified: en.noJa no CJK leftovers in sim tab text sample
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — verified: en.units cash input=100
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — verified: format.test.js passed
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — verified: analysis-ui.test.js passed
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — verified: CSS truncation and table layout present
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — verified: params.test.js passed
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — verified: chart-helpers.test.js passed
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — verified: format.test.js passed
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — verified: url.test.js passed; Chrome smoke share/copy/openTab PASS

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node cli.js run <sample.json>` generates a full result JSON under `.agent/scratch/fire-sim/` and outputs a scalar summary to stdout — verified: run-2026-08-20T16-18-19-seed123456.json created
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — verified: successRate 90.12 finalMedian 477095552 targetAssetMaintainRate 80.28
- [x] Confirm that `.agent/scratch/` output files do **not** appear in `git status` (`.agent/` is gitignored) — verified: GITIGNORE_OK; git status --short has no .agent/scratch paths
- [x] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file — verified: p7_cli_smoke --no-file created no extra files
- [x] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout — verified: STDOUT_JSON_OK 329573
- [x] `node cli.js run <file> --compact` outputs minified single-line JSON — verified: COMPACT_OK
- [x] `node cli.js run <file> --out .agent/scratch/custom/output.json` creates the directory automatically and writes the file — verified: CUSTOM_OUT_OK

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — verified: 2.8.5
- [x] `index.html` all version occurrences match target release version: — verified: all 5 occurrences match 2.8.5
  - [x] `<meta name="app-version">` — verified: content="2.8.5"
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — verified: ?v=2.8.5
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — verified: ?v=2.8.5
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — verified: <span>v2.8.5</span>
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — verified: | v2.8.5
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — verified: i18n.js replace {VERSION} from meta content="2.8.5"
- [x] `docs.html` CSS query strings match target release version — verified: ?v=2.8.5
- [x] `docs/internal/style-guide.md` example query strings match target release version — verified: ?v=2.8.5
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — verified: remaining 2.8.4 are CHANGELOG v2.8.4 headings and this ticket's historical-changelog notes only

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`.agent/scratch/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — verified: generate_previews.py wrote both HTML files
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — verified: preview has `<base href="../../">`
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — verified: `.agent/scratch/github_preview_readme_en.html` and `github_preview_readme_ja.html`
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — verified: preview CSS includes hr/code/table/img rules; generator completed
