# Pre-Release Smoke Test Manual (v2.8.1)

When releasing a new version, please perform manual verification using the following checklist.

> **AI Agent Verification Requirement**: When performing pre-release verification, the AI agent MUST NOT provide abbreviated or summarized reports. ALL checklist items below MUST be explicitly reported in full list format (`- [x]` or `- [N/A]`). When recording test counts, transcribe the exact `Test Files N passed` / `Tests M passed` values directly from the raw `npm test` (vitest) log; do not reconstruct or estimate them.

## v2.8.1 Release Identity / Metadata
- [x] package.json version is 2.8.1
- [x] package-lock.json top-level version is 2.8.1
- [x] package-lock.json packages[""].version is 2.8.1
- [x] README.md current release is v2.8.1
- [x] README-ja.md current release is v2.8.1
- [x] CHANGELOG.md latest entry is [v2.8.1]
- [x] CHANGELOG-ja.md latest entry is [v2.8.1]

## README 3.0 Release Gate
- [x] README.md and README-ja.md have identical section structure and order
- [x] Simulation Model contains exactly 7 concepts
- [x] Features contains exactly 8 fixed items
- [x] Privacy contains exactly 4 semantic sections
- [x] Deliberate Scope contains exactly 3 intentional limitations
- [x] Documentation Gateway contains all required destinations
- [x] #currency-semantics anchor resolves
- [x] README screenshot asset exists at docs/assets/readme/fire-simulator-overview.png
- [x] Current release marker is v2.8.1 in both README files
- [x] Disclaimer unchanged
- [x] License unchanged

## Documentation Integrity
- [x] All README documentation links resolve
- [x] No forbidden obsolete documentation path is used by current README links
- [x] testing-guide.md matches actual test structure
- [x] cli-usage.md examples match current CLI implementation
- [x] No stale current-version marker remains
- [x] CHANGELOG EN/JA latest entries describe v2.8.1

## CSS & Build Freshness Verification
- [x] `npm run build:css` executes cleanly
- [x] `git diff --exit-code -- css/tailwind.css` passes with zero diff (CSS freshness OK)

## Simulation Tab
- [x] `npm test` passes all tests
- [x] Results are displayed by clicking the "Run Simulation" button
- [x] The summary card displays the success rate, final total assets median, and target asset maintenance probability
- [x] The total assets progression graph is rendered
- [x] The downside focus toggle works (show only 50% or below)
- [x] "Save image" succeeds
- [x] "Post to X" generates the correct URL
- [x] "Open another tab with the same conditions" works
- [x] "Copy analysis result URL link" works

## Simulation Tab (New Risk Indicator Graphs)
- [x] The "Probability of continued period below initial total assets" graph is rendered correctly
- [x] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly
- [x] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English
- [x] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%)
- [x] The period and probability are displayed correctly when hovering the tooltip on the new graphs
- [x] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification)
- [x] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs

## Analysis Tab
- [x] Opening the Analysis tab displays the base scenario card
- [x] Clicking a factor card selects/deselects it
- [x] The number of selected factors and scenarios is updated correctly
- [x] "Run Analysis" displays the comparison table
- [x] The target table is displayed correctly
- [x] Switching the evaluation metric updates the table and labels
- [x] Deselecting all factors displays "Please select a factor"
- [x] The "Edit conditions in Simulation tab" button switches tabs

## Comparison Tab
- [x] Opening the Comparison tab displays one scenario (in both Japanese and English)
- [x] Adding, deleting, duplicating, and overwriting scenarios works correctly
- [x] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted
- [x] The column order can be changed with the left/right move buttons
- [x] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button
- [x] The common seed and common path count can be changed
- [x] A red border animation is displayed when an input value is clamped out of range
- [x] After entering a numeric value, pressing Tab moves focus to the next field
- [x] "Run All" executes all scenarios sequentially
- [x] All operation buttons are disabled during execution
- [x] Confirm that common settings (seed, path count) cannot be changed during execution
- [x] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario)
- [x] In Japanese mode, "億円" is displayed to the right of the initial risk assets
- [x] In Japanese mode, "万円" is displayed to the right of the initial cash buffer
- [x] In Japanese mode, "倍" is displayed to the right of the replenishment pace
- [x] In English mode, the currency unit is displayed correctly such as "M" or "K"
- [x] In English mode, "x" is displayed to the right of the replenishment pace
- [x] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct
- [x] In English mode, increment/decrement step, min, and max values are also converted correctly
- [x] In English mode, the value is maintained even after editing targetAssetRatio
- [x] Horizontal scrolling and first column fixing work correctly on mobile displays
- [x] Confirm that the scroll position is maintained after the table is redrawn
- [x] Tooltips (ℹ️ icons) can be focused by keyboard
- [x] CB-related parameters are not editable (grayed out) for scenarios with CB OFF
- [x] GR-related parameters are not editable (grayed out) for scenarios with GR OFF
- [x] After editing a scenario name, the name on screen is immediately updated
- [x] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored
- [x] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed
- [x] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console)
- [x] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed
- [x] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab
- [x] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs)
- [x] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate
- [x] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools
- [x] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console

## Cross-Browser Verification
- [x] Normal operation in the latest version of Chrome
- [x] Mobile display (responsive) is not broken

## English Mode Verification

- [x] Clicking the language switch button "English" switches the UI to English
- [x] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself)
- [x] The currency display in the Simulation tab is displayed in the correct unit (M, K)
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [x] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M`
- [x] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit
- [x] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow
- [x] The decimal values entered manually do not disappear when operating the stepper button in English mode
- [x] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M`
- [x] The currency display in the PNG generated by "Save image" conforms to English mode
- [x] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well

## CLI Smoke Test (v2.8.1)

Note: `.github/` contains no release workflow; P6 (release) is operated manually.

- [x] `node cli.js run <sample.json>` generates a full result JSON under `.agent/scratch/fire-sim/` and outputs a scalar summary to stdout
- [x] Scalar summary output matches specification (`FIRE Success Rate`, `Median Final Assets`, `Target Maintenance Rate`, `Execution Time`)
- [x] Confirm that `.agent/scratch/` output files do **not** appear in `git status` (`.agent/` is gitignored)
- [x] `node cli.js run <file> --no-file` outputs summary to stdout without creating any output file
- [x] `node cli.js run <file> --stdout` outputs full result JSON directly to stdout
- [x] `node cli.js run <file> --compact` outputs minified single-line JSON
- [x] `node cli.js run <file> --out .agent/scratch/custom/output.json` creates the directory automatically and writes the file

## Version Consistency & Exhaustive Search (Prevention of Missed Updates)

- [x] `package.json` version matches target release version (e.g. `2.8.1`)
- [x] `index.html` all version occurrences match target release version:
  - [x] `<meta name="app-version">`
  - [x] `<link rel="stylesheet" href="css/tailwind.css?v=...">`
  - [x] `<link rel="stylesheet" href="css/style.css?v=...">`
  - [x] Modal / Footer version span `<span>vX.Y.Z</span>`
  - [x] Image capture footer element `#capFooterUrl` (`| vX.Y.Z`)
- [x] `js/version.js` (`VERSION`) matches target release version
- [x] `js/i18n.js` metadata / strings match target release version
- [x] `docs.html` CSS query strings match target release version
- [x] `docs/internal/style-guide.md` example query strings match target release version
- [x] Run exhaustive workspace grep (`grep_search` for previous version string `vX.Y.Z-1`) to physically prove 0 missed occurrences across all source files

## README 3.0 & Documentation Human Inspection Preview

- [x] Generate authentic GitHub-style HTML preview files (`.agent/scratch/github_preview_readme_en.html` / `ja.html`) using official GitHub Markdown API or equivalent parser.
- [x] Ensure embedded screenshot images (e.g. `./docs/assets/readme/*.png`) resolve correctly via `<base href="../../">` or automated asset copying, guaranteeing zero 404 broken images when opened in browser.
- [x] Provide browser-accessible links to the user for human inspection before PR creation.
- [x] Confirm that markdown elements (horizontal rules `---`, badges, code blocks, tables, images, anchor links) render cleanly without broken layout or raw syntax leaking.