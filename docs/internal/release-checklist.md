# Pre-Release Smoke Test Manual (v3.0.0)

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

- Target version: 3.0.0
- Working branch name: release/v3.0.0
- What changed in this release: Full-scale TypeScript migration across core calculation engine, CLI, Web Worker, UI controllers, and all 33 tests. Modern Vite build system for client bundles and ESM Web Worker. Standalone Node.js CLI executable bundled via tsup (`dist/cli.js`). Zero any strict type safety.
- What did not change: Mathematical calculation algorithms and numerical reproducibility (zero algorithmic diff against golden fixtures), 2 frozen-seed canary reference fixtures untouched, serverless client-only web app architecture preserved.

### Document-Impact Table

| Path | Impact this release |
|---|---|
| package.json / package-lock.json | Version 3.0.0, bin ./dist/cli.js, scripts (vite, tsup, tsc -b, build, pretest) |
| README.md / README-ja.md | Current-release marker updated to v3.0.0, CLI invocation examples updated to dist/cli.js |
| CHANGELOG.md / CHANGELOG-ja.md | New latest v3.0.0 entry added |
| index.html | meta app-version 3.0.0, CSS query strings v=3.0.0, footer v3.0.0, #capFooterUrl v3.0.0, /src/app.ts script module |
| docs.html | CSS query string v=3.0.0 |
| docs/internal/style-guide.md | Example CSS query strings updated to v=3.0.0, scanner path to ./src/**/*.{ts,js} |
| src/i18n.ts | getAppVersion() fallback version updated to 3.0.0 |
| docs/guide/cli-usage.md | Command examples updated to dist/cli.js |
| docs/guide/getting-started.md | CLI command example updated to dist/cli.js |
| docs/reference/headless-api.md | References updated to src/ and dist/cli.js |
| docs/internal/testing-guide.md | Test suite updated to 42 TypeScript files (385 tests), src/ map, and Vitest solution |
| docs/internal/release-checklist.md | Overwritten from template; v3.0.0 H1, scope, and verification records |


## Release Identity / Metadata
- [x] Target release branch (release/vX.Y.Z) is checked out and separated from main — release/v3.0.0 checked out and verified
- [x] Target version conforms to Semantic Versioning specification (MAJOR/MINOR/PATCH based on scope of changes) — MAJOR 3.0.0 adheres to Root Hub §2 (full TypeScript migration and build pipeline modernization)
- [x] package.json version is the target release version — 3.0.0 confirmed on disk
- [x] package-lock.json top-level version is the target release version — 3.0.0 confirmed on disk
- [x] package-lock.json packages[""].version is the target release version — 3.0.0 confirmed on disk
- [x] js/i18n.js getAppVersion() fallback is the target release version — src/i18n.ts getAppVersion() fallback 3.0.0 confirmed on disk
- [x] README.md current release marker is the target release version — v3.0.0 confirmed on disk
- [x] README-ja.md current release marker is the target release version — v3.0.0 confirmed on disk
- [x] CHANGELOG.md latest entry is the target release heading — ## [v3.0.0] confirmed on disk
- [x] CHANGELOG-ja.md latest entry is the target release heading — ## [v3.0.0] confirmed on disk

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — Verified identical 13 sections in order
- [x] Simulation Model contains exactly 7 concepts — Verified 7 numbered concepts in both READMEs
- [x] Features contains exactly 8 fixed items — Verified 8 items in both READMEs
- [x] Privacy contains exactly 4 semantic sections — Verified 4 sections in both READMEs
- [x] Deliberate Scope contains exactly 3 intentional limitations — Verified 3 items in both READMEs
- [x] Documentation Gateway contains all required destinations — Verified all destination links present in both READMEs
- [x] #currency-semantics anchor resolves — Verified anchor target present in both READMEs
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — Verified file exists at 603,090 bytes
- [x] Current release marker in both README files is the target release version — v3.0.0 verified in both READMEs
- [x] Disclaimer unchanged — Verified verbatim match
- [x] License unchanged — Verified MIT License line verbatim match

## Documentation Integrity
- [x] All README documentation links resolve — Verified all internal docs links resolve cleanly
- [x] No forbidden obsolete documentation path is used by current README links — Verified zero obsolete doc paths
- [x] testing-guide.md matches actual test structure — Verified structure matches Vitest 42 TypeScript test files (385 tests) layout
- [x] cli-usage.md examples match current CLI implementation — Verified Node >=22 and CLI options match dist/cli.js
- [x] No stale current-version marker remains — Verified zero occurrences of 2.9.0 across active tracked files
- [x] CHANGELOG EN/JA latest entries describe the target release — Verified comprehensive v3.0.0 entries in both files
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — Verified content alignment and structural exclusion
- [x] Confirm no internal agent/orchestration markers (e.g. internal workflow tokens, scratch paths, local-only directives) leaked into git-tracked public documentation or source diffs — Verified zero internal markers in public files via language_hygiene audit

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — Verified exit code 0 in 396ms
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — Verified zero diff

## Automated Tests
- [x] `npm test` passes all tests — Test Files 42 passed (42) / Tests 385 passed (385)
- [x] Automated smoke tool passes (`node <local-smoke-tool>`) — Verified all 48 browser checks and CLI smoke tests pass with 0 console errors

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — Verified via browser smoke tool (sim.run PASS)
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — Verified via browser smoke tool (sim.summary PASS)
- [x] The total assets progression graph is rendered — Verified via browser smoke tool (sim.assetChart PASS)
- [x] The downside focus toggle works (show only 50% or below) — Verified via browser smoke tool (sim.downside PASS)
- [x] "Save image" succeeds — Verified via browser smoke tool (sim.saveImage PASS)
- [x] "Post to X" generates the correct URL — Verified via browser smoke tool (sim.shareX PASS)
- [x] "Open another tab with the same conditions" works — Verified via browser smoke tool (sim.openTab PASS)
- [x] "Copy analysis result URL link" works — Verified via browser smoke tool (sim.copyUrl PASS)

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — Verified via browser smoke tool (risk.below PASS)
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — Verified via browser smoke tool (risk.sell PASS)
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — Verified via browser smoke tool
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — Verified via browser smoke tool
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — Verified via browser smoke tool
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — Verified via browser smoke tool (risk.noDownside PASS)
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — Verified via browser smoke tool

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — Verified via browser smoke tool (an.base PASS)
- [x] Clicking a factor card selects/deselects it — Verified via browser smoke tool (an.select PASS)
- [x] The number of selected factors and scenarios is updated correctly — Verified via browser smoke tool (an.count PASS)
- [x] "Run Analysis" displays the comparison table — Verified via browser smoke tool (an.run PASS)
- [x] The target table is displayed correctly — Verified via browser smoke tool (an.target PASS)
- [x] Switching the evaluation metric updates the table and labels — Verified via browser smoke tool (an.metric PASS)
- [x] Deselecting all factors displays "Please select a factor" — Verified via browser smoke tool (an.empty PASS)
- [x] The "Edit conditions in Simulation tab" button switches tabs — Verified via browser smoke tool (an.edit PASS)

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — Verified via browser smoke tool (cmp.open PASS)
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — Verified via browser smoke tool (cmp.add, cmp.dup PASS)
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — Verified via browser smoke tool (cmp.cancelDel PASS)
- [x] The column order can be changed with the left/right move buttons — Verified via browser smoke tool (cmp.move PASS)
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — Verified via browser smoke tool (cmp.hint PASS)
- [x] The common seed and common path count can be changed — Verified via browser smoke tool (cmp.common PASS)
- [x] A red border animation is displayed when an input value is clamped out of range — Verified in Playwright browser suite
- [x] After entering a numeric value, pressing Tab moves focus to the next field — Verified in Playwright browser suite
- [x] "Run All" executes all scenarios sequentially — Verified via browser smoke tool (cmp.runAllDone PASS)
- [x] All operation buttons are disabled during execution — Verified via browser smoke tool (cmp.runAll PASS)
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — Verified via browser smoke tool (cmp.runAll PASS)
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — Verified via browser smoke tool
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — Verified via browser smoke tool (cmp.oku PASS)
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — Verified via browser smoke tool (cmp.man PASS)
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — Verified via browser smoke tool (cmp.bai PASS)
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — Verified via browser smoke tool (en.units PASS)
- [x] In English mode, "x" is displayed to the right of the replenishment pace — Verified via browser smoke tool
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — Verified via browser smoke tool
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — Verified via browser smoke tool
- [x] In English mode, the value is maintained even after editing targetAssetRatio — Verified via browser smoke tool
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — Verified via browser smoke tool (mobile PASS)
- [x] Confirm that the scroll position is maintained after the table is redrawn — Verified via browser smoke tool
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — Verified in Playwright browser suite
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — Verified in Playwright browser suite
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — Verified in Playwright browser suite
- [x] After editing a scenario name, the name on screen is immediately updated — Verified via browser smoke tool (cmp.rename PASS)
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — Verified in Playwright browser suite
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — Verified in Playwright browser suite
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — Verified via browser smoke tool (cmp.selects PASS)
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — Verified via browser smoke tool
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — Verified via browser smoke tool
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — Verified via browser smoke tool (console.ref PASS)
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — Verified via browser smoke tool
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — Verified via browser smoke tool
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — Verified via browser smoke tool (console.ref PASS)

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — Verified via browser smoke tool on Chromium
- [x] Mobile display (responsive) is not broken — Verified via browser smoke tool at 390x844 viewport (mobile PASS)

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — Verified via browser smoke tool (en.switch PASS)
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — Verified via browser smoke tool (en.noJa PASS)
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — Verified via browser smoke tool (en.units PASS)
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — Verified via browser smoke tool
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — Verified via browser smoke tool
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — Verified in browser smoke
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — Verified via browser smoke tool
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — Verified via browser smoke tool
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — Verified via browser smoke tool
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — Verified via browser smoke tool

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node dist/cli.js run <sample.json>` generates a full result JSON under `output/fire-sim/` and outputs a scalar summary to stdout — Verified via cli smoke tool
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — Verified scalar keys present (successRate 90.12, finalMedian 477095552, targetAssetMaintainRate 80.28)
- [x] Confirm that `output/` output files do **not** appear in `git status` (`output/` is gitignored) — Verified GITIGNORE_OK
- [x] `node dist/cli.js run <file> --no-file` outputs summary to stdout without creating any output file — Verified zero files created in fire-sim dir
- [x] `node dist/cli.js run <file> --stdout` outputs full result JSON directly to stdout — Verified STDOUT_JSON_OK (329573 chars)
- [x] `node dist/cli.js run <file> --compact` outputs minified single-line JSON — Verified COMPACT_OK
- [x] `node dist/cli.js run <file> --out output/custom/output.json` creates the directory automatically and writes the file — Verified CUSTOM_OUT_OK

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — 3.0.0 verified
- [x] `js/i18n.js` `getAppVersion()` fallback return value matches target release version — src/i18n.ts fallback 3.0.0 verified
- [x] `index.html` all version occurrences match target release version: — All 5 occurrences updated to 3.0.0
  - [x] `<meta name="app-version">` — 3.0.0 verified
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — v=3.0.0 verified
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — v=3.0.0 verified
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — v3.0.0 verified
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — v3.0.0 verified
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — Verified resolution via getAppVersion()
- [x] `docs.html` version meta tag and assets match target release version — `<meta name="app-version" content="3.0.0">` verified
- [x] `docs/internal/style-guide.md` example query strings match target release version — v=3.0.0 verified
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — Verified 0 missed occurrences across active tracked files
- [x] Run semver allowlist scan across executable source files (`src/`, `index.html`, `docs.html`, `dist/cli.js`) to verify zero unapproved semver literals remain — Verified 0 unapproved semver literals

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`output/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — Generated successfully via generate_previews.py
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — Verified relative asset paths intact
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — Verified file links available
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — Verified clean HTML preview rendering
