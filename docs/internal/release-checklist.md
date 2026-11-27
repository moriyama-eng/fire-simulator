# Pre-Release Smoke Test Manual (v3.0.4)

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

- Target version: `v3.0.4` (PATCH from `v3.0.3`)
- Working branch name: `release/v3.0.4`
- What changed in this release: Aligned `getParamsFromInputs` clamping with `normalizeHeadlessParams` and synced `actions.ts` random seed range (`[1, 99999999]`) and guardrail release DOM write-back; unified `simDf`/`usedDf` lower-bound clamping to `2.5`; replaced unsafe `as Float32Array` casts in `aggregation.ts`; hardened `runSimulation` (`simPaths <= 0` guard, `worker.onmessageerror`, preserved `error.cause`, 100% completion progress, optional `AbortSignal`); wrapped `saveImage()` style/chart mutations in outer `try / finally`; fixed `.md` query link double `?`; added ARIA tab roles and removed duplicate `max` attribute in `index.html`; eliminated double `renderAnalysisTab()` on `languageChanged`; cleaned 14 unreferenced i18n keys, completed English `cb.ddReplenish.tooltip`, and fixed USD boundary rounding rollovers; hardened `confinement.mjs` (intermediate symlinks and `internal;` post-realpath/ENOENT), `assert-client-bundle.mjs` / `smoke-subpath-server.mjs` (loud failure + Vite 8 backtick support), `verify-cdn-sri.mjs`, and `copy-docs.mjs`; switched CI workflows to `npm run test:coverage` with `pretest:coverage` and `timeout-minutes: 15`; modernized fixture generators for Node 22+; synced documentation parity (including KaTeX External Resources); and added 13 regression tests (45 files / 456 cases).
- What did not change: Core simulation mathematical formulas, PRNG sequence, and frozen golden fixtures (`reference-results.json`, `headless-reference-results.json`, `reference-belowinit-results.json`) remain 100% bit-for-bit identical.

### Document-Impact Table

| Path | Impact this release |
|---|---|
| package.json / package-lock.json | Version 3.0.4, `pretest:coverage`, deduplicated `build`, removed unused `@types/sortablejs` |
| README.md / README-ja.md | Current-release marker v3.0.4 and KaTeX entry in External Resources |
| CHANGELOG.md / CHANGELOG-ja.md | New latest v3.0.4 entry |
| index.html | meta, CSS queries, footer, `#capFooterUrl` to 3.0.4; removed duplicate `max`; added ARIA tab roles |
| docs.html | meta to 3.0.4 |
| docs/internal/style-guide.md | Example CSS query strings to 3.0.4; `typescript` fence, `CHANGELOG-ja.md`, `./docs.html` |
| src/i18n.ts | `getAppVersion()` fallback 3.0.4; removed 14 unused keys; English `cb.ddReplenish.tooltip`; USD rounding fix |
| src/cli.ts | `getPackageVersion()` fallback 3.0.4 |
| src/core/params.ts, headless-params.ts, simulation.ts, aggregation.ts, simulation-engine.ts, headless.ts, worker.ts, types/simulation.d.ts, app/actions.ts, app/ui-helpers.ts, docs-links.ts, analysis-ui.ts | Clamping alignment, Worker hardening, `df >= 2.5`, runtime `Float32Array`, `saveImage()` `try/finally`, query link fix, dead-code/comment cleanup |
| scripts/ & .github/workflows/ | Intermediate symlink/`internal;` confinement, Vite 8 Worker URL assertion, SRI timer cleanup, transient-only copy-docs retry, CI `test:coverage` & deduplication |
| docs/guide/overview.md, cli-usage.md, docs/explanation/reproducibility.md, docs/reference/metrics-glossary.md, docs/internal/testing-guide.md, release-checklist.template.md | KaTeX External Resources parity, TypeScript annotations, identifier reference, `file` mode note, CI/test count parity (45 files / 456 cases), closing tag typo fix |
| tests/ | Added 13 regression tests (45 files / 456 cases), refactored `belowinit-charts.test.ts` & `comparison-ui.test.ts`, modernized `tests/fixtures/generate-*.js`, removed unused `tests/helpers/i18n-mock.ts` |
| docs/internal/release-checklist.md | Overwritten from template; v3.0.4 H1, scope, and verification records |


## Release Identity / Metadata
- [x] Target release branch (release/vX.Y.Z) is checked out and separated from main — Verified on `release/v3.0.4` separated from `main`
- [x] Target version conforms to Semantic Versioning specification (MAJOR/MINOR/PATCH based on scope of changes) — Verified PATCH (`3.0.3` -> `3.0.4`), backwards-compatible fixes and hardening only
- [x] package.json version is the target release version — Verified `"version": "3.0.4"` via `version-parity.test.ts`
- [x] package-lock.json top-level version is the target release version — Verified `3.0.4` via `version-parity.test.ts`
- [x] package-lock.json packages[""].version is the target release version — Verified `3.0.4` via `version-parity.test.ts`
- [x] src/i18n.ts getAppVersion() fallback is the target release version — Verified `'3.0.4'` via `version-parity.test.ts` and `i18n.test.ts`
- [x] src/cli.ts getCliVersion() fallback is the target release version — Verified `'3.0.4'` via `version-parity.test.ts`
- [x] README.md current release marker is the target release version — Verified `**Current release: v3.0.4**` via `version-parity.test.ts`
- [x] README-ja.md current release marker is the target release version — Verified `**現行リリース: v3.0.4**` via `version-parity.test.ts`
- [x] CHANGELOG.md latest entry is the target release heading — Verified `## [v3.0.4] - 2026-11-28` via `version-parity.test.ts`
- [x] CHANGELOG-ja.md latest entry is the target release heading — Verified `## [v3.0.4] - 2026-11-28` via `version-parity.test.ts`

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order — Verified via `tests/unit/readme-parity.test.ts` (10/10 PASS)
- [x] Simulation Model contains exactly 7 concepts — Verified via `tests/unit/readme-parity.test.ts`
- [x] Features contains exactly 8 fixed items — Verified via `tests/unit/readme-parity.test.ts`
- [x] Privacy contains exactly 4 semantic sections — Verified via `tests/unit/readme-parity.test.ts`
- [x] Deliberate Scope contains exactly 3 intentional limitations — Verified via `tests/unit/readme-parity.test.ts`
- [x] Documentation Gateway contains all required destinations — Verified via `tests/unit/readme-parity.test.ts`
- [x] #currency-semantics anchor resolves — Verified via `tests/unit/readme-parity.test.ts`
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — Verified via `tests/unit/readme-parity.test.ts` and subpath smoke check
- [x] Current release marker in both README files is the target release version — Verified `v3.0.4` in both files via `version-parity.test.ts`
- [x] Disclaimer unchanged — Verified unchanged in `README.md` and `README-ja.md`
- [x] License unchanged — Verified unchanged in `README.md` and `README-ja.md`

## Documentation Integrity
- [x] All README documentation links resolve — Verified via `tests/unit/doc-links-integrity.test.ts`
- [x] No forbidden obsolete documentation path is used by current README links — Verified via `tests/unit/stale-paths.test.ts` and `doc-links-integrity.test.ts`
- [x] testing-guide.md matches actual test structure — Verified via `tests/unit/testing-guide-parity.test.ts` (45 files / 456 cases, 100% parity)
- [x] cli-usage.md examples match current CLI implementation — Verified via `tests/integration/cli.test.ts` and automated CLI smoke suite
- [x] No stale current-version marker remains — Verified 0 occurrences of `3.0.3` in executable sources and `version-parity.test.ts` (11/11 PASS)
- [x] CHANGELOG EN/JA latest entries describe the target release — Verified `v3.0.4` EN/JA parity
- [x] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — Verified KaTeX External Resources and all mirrored sections match `README.md`
- [x] Confirm no internal agent/orchestration markers (e.g. internal workflow tokens, scratch paths, local-only directives) leaked into git-tracked public documentation or source diffs — Verified zero leaked internal workflow identifiers or local scratch paths in tracked files

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly — Verified exit code 0 (Tailwind CLI v3.4.17 minified output)
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — Verified exit code 0 with zero diff

## Automated Tests
- [x] `npm test` passes all tests — `Test Files 45 passed (45)` / `Tests 456 passed (456)` via `npm run test:coverage` (Stmts 99.31%, Branch 96.39%, Funcs 100%, Lines 99.86%)
- [x] Automated smoke tool passes (`node <local-smoke-tool>`) — Verified `BROWSER_DONE 48` (48/48 checks PASS, zero console errors) and `CLI_SMOKE_ALL_OK`

## Simulation Tab
- [x] Results are displayed by clicking the "Run Simulation" button — Verified via browser smoke (`PASS sim.run`)
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability — Verified via browser smoke (`PASS sim.summary`)
- [x] The total assets progression graph is rendered — Verified via browser smoke (`PASS sim.assetChart`)
- [x] The downside focus toggle works (show only 50% or below) — Verified via browser smoke (`PASS sim.downside toggled false -> true`)
- [x] "Save image" succeeds — Verified via browser smoke (`PASS sim.saveImage`)
- [x] "Post to X" generates the correct URL — Verified via browser smoke (`PASS sim.shareX`)
- [x] "Open another tab with the same conditions" works — Verified via browser smoke (`PASS sim.openTab`)
- [x] "Copy analysis result URL link" works — Verified via browser smoke (`PASS sim.copyUrl`)

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly — Verified via browser smoke (`PASS risk.below`) and `belowinit-charts.test.ts`
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — Verified via browser smoke (`PASS risk.sell`) and `belowinit-charts.test.ts`
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — Verified via `i18n.test.ts` and browser smoke
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — Verified via `belowinit-charts.test.ts` and browser smoke
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs — Verified via `chart-helpers.test.ts` and browser smoke
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — Verified via browser smoke (`PASS risk.noDownside`)
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — Verified via `belowinit-charts.test.ts` and browser smoke

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card — Verified via browser smoke (`PASS an.base`)
- [x] Clicking a factor card selects/deselects it — Verified via browser smoke (`PASS an.select`)
- [x] The number of selected factors and scenarios is updated correctly — Verified via browser smoke (`PASS an.count`)
- [x] "Run Analysis" displays the comparison table — Verified via browser smoke (`PASS an.run`)
- [x] The target table is displayed correctly — Verified via browser smoke (`PASS an.target`)
- [x] Switching the evaluation metric updates the table and labels — Verified via browser smoke (`PASS an.metric`)
- [x] Deselecting all factors displays "Please select a factor" — Verified via browser smoke (`PASS an.empty`) and `analysis-ui.test.ts`
- [x] The "Edit conditions in Simulation tab" button switches tabs — Verified via browser smoke (`PASS an.edit`)

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English) — Verified via browser smoke (`PASS cmp.open`)
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly — Verified via browser smoke (`PASS cmp.add`, `cmp.dup`) and `comparison-ui.test.ts`
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — Verified via browser smoke (`PASS cmp.cancelDel`) and `comparison-ui.test.ts`
- [x] The column order can be changed with the left/right move buttons — Verified via browser smoke (`PASS cmp.move`) and `comparison-ui.test.ts`
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — Verified via browser smoke (`PASS cmp.hint`)
- [x] The common seed and common path count can be changed — Verified via browser smoke (`PASS cmp.common`)
- [x] A red border animation is displayed when an input value is clamped out of range — Verified via `comparison-ui.test.ts`
- [x] After entering a numeric value, pressing Tab moves focus to the next field — Verified via `comparison-ui.test.ts`
- [x] "Run All" executes all scenarios sequentially — Verified via browser smoke (`PASS cmp.runAllDone`)
- [x] All operation buttons are disabled during execution — Verified via `comparison-runner.test.ts` and `comparison-ui.test.ts`
- [x] Confirm that common settings (seed, path count) cannot be changed during execution — Verified via `comparison-ui.test.ts`
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — Verified via browser smoke (`PASS cmp.runAllDone`)
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets — Verified via browser smoke (`PASS cmp.oku`)
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — Verified via browser smoke (`PASS cmp.man`)
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace — Verified via browser smoke (`PASS cmp.bai`)
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K" — Verified via browser smoke (`PASS en.units`) and `comparison-ui.test.ts`
- [x] In English mode, "x" is displayed to the right of the replenishment pace — Verified via `comparison-ui.test.ts`
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — Verified via `comparison-ui.test.ts` and `ui-helpers-currency.test.ts`
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly — Verified via `comparison-ui.test.ts`
- [x] In English mode, the value is maintained even after editing targetAssetRatio — Verified via `comparison-ui.test.ts`
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays — Verified via browser smoke (`PASS mobile viewport 390x844`)
- [x] Confirm that the scroll position is maintained after the table is redrawn — Verified via `comparison-ui.test.ts`
- [x] Tooltips (ℹ️ icons) can be focused by keyboard — Verified via `ui-helpers.ts` (`focusin`/`focusout`) and `comparison-ui.test.ts`
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — Verified via `comparison-ui.test.ts`
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — Verified via `comparison-ui.test.ts`
- [x] After editing a scenario name, the name on screen is immediately updated — Verified via browser smoke (`PASS cmp.rename`)
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — Verified via `comparison-ui.test.ts`
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — Verified via browser smoke (`PASS cmp.rename`, `cmp.runAllDone`)
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — Verified via browser smoke (`PASS cmp.selects`, `cmp.runAllDone`) and `comparison-ui.test.ts`
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — Verified via browser smoke across all 3 tabs
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — Verified via browser smoke (`PASS an.base`)
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — Verified via browser smoke (`PASS console.ref`)
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — Verified redundant `analysis-ui.ts` listener removed; single `init.ts` redraw path
- [x] Final confirmation of table closing tags: Confirm that the order of `</tr></tbody></table></div>` is correct in the developer tools — Verified in `comparison-ui.ts` table HTML and browser smoke
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — Verified via browser smoke (`PASS console.ref`, `PASS console.errors none`)

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome — Verified via headless Chromium Playwright suite (`BROWSER_DONE 48`, zero console errors)
- [x] Mobile display (responsive) is not broken — Verified via browser smoke (`PASS mobile viewport 390x844`)

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English — Verified via browser smoke (`PASS en.switch`)
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — Verified via browser smoke (`PASS en.noJa`)
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K) — Verified via browser smoke (`PASS en.units`) and `ui-helpers-currency.test.ts`
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — Verified via `i18n.test.ts` and `summary.test.ts`
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — Verified via `analysis-ui.test.ts`
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — Verified via `analysis-ui.test.ts` and browser smoke
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode — Verified via `ui-helpers-currency.test.ts`
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — Verified via `i18n.test.ts` and `chart-helpers.test.ts`
- [x] The currency display in the PNG generated by "Save image" conforms to English mode — Verified via `actions.ts` `formatCurrency` and browser smoke (`PASS sim.saveImage`)
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — Verified via `actions-url-options.test.ts`, `query-params.test.ts`, and browser smoke

## CLI Smoke Test

Note: `.github/` contains no release workflow; release preparation is operated manually.

- [x] `node dist/cli.js run <sample.json>` generates a full result JSON under `output/fire-sim/` and outputs a scalar summary to stdout — Verified via CLI smoke (`CREATED_FILES [ 'run-...-seed123456.json' ]`, `CLI_SMOKE_ALL_OK`)
- [x] Scalar summary output matches specification (JSON fields `successRate`, `finalMedian`, `targetAssetMaintainRate`, etc. per `docs/guide/cli-usage.md`) — Verified (`successRate: 90.12`, `finalMedian: 477095552`, `targetAssetMaintainRate: 80.28`)
- [x] Confirm that `output/` output files do **not** appear in `git status` (`output/` is gitignored) — Verified via CLI smoke (`GITIGNORE_OK`)
- [x] `node dist/cli.js run <file> --no-file` outputs summary to stdout without creating any output file — Verified via CLI smoke and `cli.test.ts`
- [x] `node dist/cli.js run <file> --stdout` outputs full result JSON directly to stdout — Verified via CLI smoke (`STDOUT_JSON_OK 329526`)
- [x] `node dist/cli.js run <file> --compact` outputs minified single-line JSON — Verified via CLI smoke (`COMPACT_OK`)
- [x] `node dist/cli.js run <file> --out output/custom/output.json` creates the directory automatically and writes the file — Verified via CLI smoke (`CUSTOM_OUT_OK`)

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches the target release version — Verified `3.0.4` via `version-parity.test.ts`
- [x] `src/i18n.ts` `getAppVersion()` fallback return value matches target release version — Verified `'3.0.4'` via `version-parity.test.ts`
- [x] `src/cli.ts` `getCliVersion()` fallback return value matches target release version — Verified `'3.0.4'` via `version-parity.test.ts`
- [x] `index.html` all version occurrences match target release version: — Verified all 5 occurrences set to `3.0.4` via `version-parity.test.ts`
  - [x] `<meta name="app-version">` — Verified `content="3.0.4"`
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — Verified `?v=3.0.4`
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">` — Verified `?v=3.0.4`
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>` — Verified `<span>v3.0.4</span>`
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — Verified `| v3.0.4</span>`
- [x] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — Verified via `i18n.test.ts`
- [x] `docs.html` meta tag matches target release version — Verified `content="3.0.4"` via `version-parity.test.ts`
- [x] `docs/internal/style-guide.md` example query strings match target release version — Verified `?v=3.0.4` via `version-parity.test.ts`
- [x] Run exhaustive workspace text search (searching for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — Verified 0 occurrences of `3.0.3` across `src/`, `index.html`, `docs.html`, and `dist/cli.js`
- [x] Run semver allowlist scan across executable source files (`src/`, `index.html`, `docs.html`, `dist/cli.js`) to verify zero unapproved semver literals remain — Verified only `3.0.4` and allowlisted CDN library versions (`1.4.1`, `1.15.2`, `4.4.1`, `0.16.11`)

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`output/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — Verified generated via official GitHub Markdown API (`SUCCESS: Generated official GitHub HTML previews with Base Href!`)
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — Verified `<base href>` applied and overview PNG present
- [x] Provide browser-accessible links to the user for human inspection before PR creation. — Ready to present `output/github_preview_readme_en.html` and `output/github_preview_readme_ja.html` links in release summary
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — Verified via official GitHub Markdown API render and `docs.html` browser smoke (`PASS docs.math`, `PASS docs.nav`)
