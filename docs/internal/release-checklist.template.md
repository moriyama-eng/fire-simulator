# Pre-Release Smoke Test Manual (template)

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

- Target version:
- What changed in this release:
- What did not change:

## Release Identity / Metadata
- [ ] package.json version is the target release version — <result or reason>
- [ ] package-lock.json top-level version is the target release version — <result or reason>
- [ ] package-lock.json packages[""].version is the target release version — <result or reason>
- [ ] README.md current release marker is the target release version — <result or reason>
- [ ] README-ja.md current release marker is the target release version — <result or reason>
- [ ] CHANGELOG.md latest entry is the target release heading — <result or reason>
- [ ] CHANGELOG-ja.md latest entry is the target release heading — <result or reason>

## README 3.0 Release Gate
- [ ] README.md and README-ja.md have identical section structure and order — <result or reason>
- [ ] Simulation Model contains exactly 7 concepts — <result or reason>
- [ ] Features contains exactly 8 fixed items — <result or reason>
- [ ] Privacy contains exactly 4 semantic sections — <result or reason>
- [ ] Deliberate Scope contains exactly 3 intentional limitations — <result or reason>
- [ ] Documentation Gateway contains all required destinations — <result or reason>
- [ ] #currency-semantics anchor resolves — <result or reason>
- [ ] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png — <result or reason>
- [ ] Current release marker in both README files is the target release version — <result or reason>
- [ ] Disclaimer unchanged — <result or reason>
- [ ] License unchanged — <result or reason>

## Documentation Integrity
- [ ] All README documentation links resolve — <result or reason>
- [ ] No forbidden obsolete documentation path is used by current README links — <result or reason>
- [ ] testing-guide.md matches actual test structure — <result or reason>
- [ ] cli-usage.md examples match current CLI implementation — <result or reason>
- [ ] No stale current-version marker remains — <result or reason>
- [ ] CHANGELOG EN/JA latest entries describe the target release — <result or reason>
- [ ] docs/guide/overview.md is content-consistent with README.md source sections (Overview, Psychological Load, Privacy, Deliberate Scope, Disclaimer); README.md is the single source of truth and overview.md is synced one-way (developer-only sections such as Features / CLI / License / Documentation are intentionally excluded) — <result or reason>

## CSS & Build Freshness Verification
- [ ] `npm run build:css` executes cleanly — <result or reason>
- [ ] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK) — <result or reason>

## Automated Tests
- [ ] `npm test` passes all tests — <result or reason>

## Simulation Tab
- [ ] Results are displayed by clicking the "Run Simulation" button — <result or reason>
- [ ] The summary card displays the success rate, final total assets median, and target asset maintenance probability — <result or reason>
- [ ] The total assets progression graph is rendered — <result or reason>
- [ ] The downside focus toggle works (show only 50% or below) — <result or reason>
- [ ] "Save image" succeeds — <result or reason>
- [ ] "Post to X" generates the correct URL — <result or reason>
- [ ] "Open another tab with the same conditions" works — <result or reason>
- [ ] "Copy analysis result URL link" works — <result or reason>

## Simulation Tab (New Risk Indicator Graphs)
- [ ] The "Probability of continued period below initial total assets" graph is rendered correctly — <result or reason>
- [ ] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly — <result or reason>
- [ ] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English — <result or reason>
- [ ] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%) — <result or reason>
- [ ] The period and probability are displayed correctly when hovering the tooltip on the new graphs — <result or reason>
- [ ] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification) — <result or reason>
- [ ] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs — <result or reason>

## Analysis Tab
- [ ] Opening the Analysis tab displays the base scenario card — <result or reason>
- [ ] Clicking a factor card selects/deselects it — <result or reason>
- [ ] The number of selected factors and scenarios is updated correctly — <result or reason>
- [ ] "Run Analysis" displays the comparison table — <result or reason>
- [ ] The target table is displayed correctly — <result or reason>
- [ ] Switching the evaluation metric updates the table and labels — <result or reason>
- [ ] Deselecting all factors displays "Please select a factor" — <result or reason>
- [ ] The "Edit conditions in Simulation tab" button switches tabs — <result or reason>

## Comparison Tab
- [ ] Opening the Comparison tab displays one scenario (in both Japanese and English) — <result or reason>
- [ ] Adding, deleting, duplicating, and overwriting scenarios works correctly — <result or reason>
- [ ] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted — <result or reason>
- [ ] The column order can be changed with the left/right move buttons — <result or reason>
- [ ] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button — <result or reason>
- [ ] The common seed and common path count can be changed — <result or reason>
- [ ] A red border animation is displayed when an input value is clamped out of range — <result or reason>
- [ ] After entering a numeric value, pressing Tab moves focus to the next field — <result or reason>
- [ ] "Run All" executes all scenarios sequentially — <result or reason>
- [ ] All operation buttons are disabled during execution — <result or reason>
- [ ] Confirm that common settings (seed, path count) cannot be changed during execution — <result or reason>
- [ ] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario) — <result or reason>
- [ ] In Japanese mode, "億円" is displayed to the right of the initial risk assets — <result or reason>
- [ ] In Japanese mode, "万円" is displayed to the right of the initial cash buffer — <result or reason>
- [ ] In Japanese mode, "倍" is displayed to the right of the replenishment pace — <result or reason>
- [ ] In English mode, the currency unit is displayed correctly such as "M" or "K" — <result or reason>
- [ ] In English mode, "x" is displayed to the right of the replenishment pace — <result or reason>
- [ ] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct — <result or reason>
- [ ] In English mode, increment/decrement step, min, and max values are also converted correctly — <result or reason>
- [ ] In English mode, the value is maintained even after editing targetAssetRatio — <result or reason>
- [ ] Horizontal scrolling and first column fixing work correctly on mobile displays — <result or reason>
- [ ] Confirm that the scroll position is maintained after the table is redrawn — <result or reason>
- [ ] Tooltips (ℹ️ icons) can be focused by keyboard — <result or reason>
- [ ] CB-related parameters are not editable (grayed out) for scenarios with CB OFF — <result or reason>
- [ ] GR-related parameters are not editable (grayed out) for scenarios with GR OFF — <result or reason>
- [ ] After editing a scenario name, the name on screen is immediately updated — <result or reason>
- [ ] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored — <result or reason>
- [ ] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed — <result or reason>
- [ ] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console) — <result or reason>
- [ ] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed — <result or reason>
- [ ] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab — <result or reason>
- [ ] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs) — <result or reason>
- [ ] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate — <result or reason>
- [ ] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools — <result or reason>
- [ ] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console — <result or reason>

## Cross-Browser Verification
- [ ] Normal operation in the latest version of Chrome — <result or reason>
- [ ] Mobile display (responsive) is not broken — <result or reason>

## English Mode Verification

- [ ] Clicking the language switch button "English" switches the UI to English — <result or reason>
- [ ] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself) — <result or reason>
- [ ] The currency display in the Simulation tab is displayed in the correct unit (M, K) — <result or reason>
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [ ] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M` — <result or reason>
- [ ] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit — <result or reason>
- [ ] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow — <result or reason>
- [ ] The decimal values entered manually do not disappear when operating the stepper button in English mode — <result or reason>
- [ ] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M` — <result or reason>
- [ ] The currency display in the PNG generated by "Save image" conforms to English mode — <result or reason>
- [ ] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well — <result or reason>

## CLI Smoke Test

Note: `.github/` contains no release workflow; P6 (release) is operated manually.

- [ ] `node cli.js run <sample.json>` generates a full result JSON under `.agent/scratch/fire-sim/` and outputs a scalar summary to stdout — <result or reason>
- [ ] Scalar summary output matches specification (`FIRE Success Rate`, `Median Final Assets`, `Target Maintenance Rate`, `Execution Time`) — <result or reason>
- [ ] Confirm that `.agent/scratch/` output files do **not** appear in `git status` (`.agent/` is gitignored) — <result or reason>
- [ ] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file — <result or reason>
- [ ] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout — <result or reason>
- [ ] `node cli.js run <file> --compact` outputs minified single-line JSON — <result or reason>
- [ ] `node cli.js run <file> --out .agent/scratch/custom/output.json` creates the directory automatically and writes the file — <result or reason>

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [ ] `package.json` version matches the target release version — <result or reason>
- [ ] `index.html` all version occurrences match target release version: — <result or reason>
  - [ ] `<meta name="app-version">` — <result or reason>
  - [ ] `<link rel="stylesheet" href="css/tailwind.css?v=...">` — <result or reason>
  - [ ] `<link rel="stylesheet" href="css/style.css?v=...">` — <result or reason>
  - [ ] Modal / Footer version span `<span>vX.Y.Z</span>` — <result or reason>
  - [ ] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`) — <result or reason>
- [ ] `{VERSION}` placeholders resolve to the `meta[name="app-version"]` target release version — <result or reason>
- [ ] `docs.html` CSS query strings match target release version — <result or reason>
- [ ] `docs/internal/style-guide.md` example query strings match target release version — <result or reason>
- [ ] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files — <result or reason>

## README 3.0 & Documentation Human Inspection Preview

- [ ] Generate authentic GitHub-style HTML preview files (`.agent/scratch/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser. — <result or reason>
- [ ] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser. — <result or reason>
- [ ] Provide browser-accessible links to the user for human inspection before PR creation. — <result or reason>
- [ ] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking. — <result or reason>
