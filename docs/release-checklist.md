# Pre-Release Smoke Test Manual (v2.3.2)

When releasing a new version, please perform manual verification using the following checklist.

## Simulation Tab
- [ ] `npm test` passes all tests
- [ ] Results are displayed by clicking the "Run Simulation" button
- [ ] The summary card displays the success rate, final total assets median, and target asset maintenance probability
- [ ] The total assets progression graph is rendered
- [ ] The downside focus toggle works (show only 50% or below)
- [ ] "Save image" succeeds
- [ ] "Post to X" generates the correct URL
- [ ] "Open another tab with the same conditions" works
- [ ] "Copy analysis result URL link" works

## Simulation Tab (New Risk Indicator Graphs)
- [ ] The "Probability of continued period below initial total assets" graph is rendered correctly
- [ ] The "Probability of consecutive risk asset sell period when below initial total assets" graph is rendered correctly
- [ ] The tooltip (ℹ️ icon) for the new graphs is displayed correctly in both Japanese and English
- [ ] The X-axis and Y-axis labels for the new graphs are displayed in the correct units (years/%)
- [ ] The period and probability are displayed correctly when hovering the tooltip on the new graphs
- [ ] Confirm that the downside focus toggle does **not exist** on the new graphs (this is the intended specification)
- [ ] Language switching (Japanese ⇔ English) correctly switches the title, tooltip, and axis labels of the new graphs

## Analysis Tab
- [ ] Opening the Analysis tab displays the base scenario card
- [ ] Clicking a factor card selects/deselects it
- [ ] The number of selected factors and scenarios is updated correctly
- [ ] "Run Analysis" displays the comparison table
- [ ] The target table is displayed correctly
- [ ] Switching the evaluation metric updates the table and labels
- [ ] "ZIP output (Beta)" succeeds and the file is downloaded
- [ ] The ZIP contains summary.csv, comparison_summary.csv, metadata/*.json, manifest.json
- [ ] Deselecting all factors displays "Please select a factor"
- [ ] The "Edit conditions in Simulation tab" button switches tabs

## Comparison Tab
- [ ] Opening the Comparison tab displays one scenario (in both Japanese and English)
- [ ] Adding, deleting, duplicating, and overwriting scenarios works correctly
- [ ] When "Cancel" is selected in the delete confirmation dialog, the scenario is not deleted
- [ ] The column order can be changed with the left/right move buttons
- [ ] A hint is always displayed as text at the top of the screen indicating that reordering is possible by dragging or using the menu button
- [ ] The common seed and common path count can be changed
- [ ] A red border animation is displayed when an input value is clamped out of range
- [ ] After entering a numeric value, pressing Tab moves focus to the next field
- [ ] "Run All" executes all scenarios sequentially
- [ ] All operation buttons are disabled during execution
- [ ] Confirm that common settings (seed, path count) cannot be changed during execution
- [ ] The progress display is updated during execution (the table is redrawn and the button text is updated upon completion of each scenario)
- [ ] In Japanese mode, "億円" is displayed to the right of the initial risk assets
- [ ] In Japanese mode, "万円" is displayed to the right of the initial cash buffer
- [ ] In Japanese mode, "倍" is displayed to the right of the replenishment pace
- [ ] In English mode, the currency unit is displayed correctly such as "M" or "K"
- [ ] In English mode, "x" is displayed to the right of the replenishment pace
- [ ] Even after entering a numeric value in English mode and switching back to Japanese mode, the value is correct
- [ ] In English mode, increment/decrement step, min, and max values are also converted correctly
- [ ] In English mode, the value is maintained even after editing targetAssetRatio
- [ ] Horizontal scrolling and first column fixing work correctly on mobile displays
- [ ] Confirm that the scroll position is maintained after the table is redrawn
- [ ] Tooltips (ℹ️ icons) can be focused by keyboard
- [ ] CB-related parameters are not editable (grayed out) for scenarios with CB OFF
- [ ] GR-related parameters are not editable (grayed out) for scenarios with GR OFF
- [ ] After editing a scenario name, the name on screen is immediately updated
- [ ] Even if an external event such as a language switch occurs while editing a scenario name, the editing content is not lost, or focus is appropriately restored
- [ ] When the "Run All" button is pressed while editing a scenario name, execution starts after the edited content is confirmed
- [ ] Even if select boxes (fluctuation model, t-distribution degrees of freedom, inflation fluctuation model) are changed, the simulation can run without errors (no NaN errors in the console)
- [ ] Repeatedly switching tabs (Simulation ⇔ Analysis ⇔ Comparison) does not cause tab content to overlap, and only one tab is always displayed
- [ ] Analysis tab sync check: Run in the Simulation tab → Confirm that the base scenario matches in the Analysis tab
- [ ] Variable declaration check: Confirm that no `ReferenceError` occurs in the browser's developer console (in particular, that no `comparisonTabBtn` undefined error occurs)
- [ ] Language switch double-execution prevention: Confirm that even if the language switch button is clicked multiple times, redraws are not executed in duplicate
- [ ] Final confirmation of table closing tags: Confirm that the order of `</tbody><tr></div>` is correct in the developer tools
- [ ] Circular import check: Confirm that no error such as `TypeError: getParams is not a function` occurs in the browser console

## Cross-Browser Verification
- [ ] Normal operation in the latest version of Chrome
- [ ] Mobile display (responsive) is not broken

## English Mode Verification

- [ ] Clicking the language switch button "English" switches the UI to English
- [ ] After switching to English mode, no Japanese text remains in the UI (except for the "日本語" button itself)
- [ ] The currency display in the Simulation tab is displayed in the correct unit (M, K)
  - Example: Initial risk assets 1.0 億円 → `$1.0 M`
  - Example: Initial cash buffer 1,000 万円 → `$100 K`
- [ ] The "Final Total Assets Median" on the summary card is displayed correctly such as `$X.X M`
- [ ] The base values of the factors "Initial Risk Assets" and "Initial Cash Buffer" in the Analysis tab are displayed in the correct USD unit
- [ ] In the target table of the Analysis tab, long factor names (e.g., "Initial cash buffer") do not overflow the cell without wrapping, and horizontal scrolling or ellipsis is used if they do overflow
- [ ] The decimal values entered manually do not disappear when operating the stepper button in English mode
- [ ] The tooltip on the total assets graph displays the correct currency unit such as `$X.X M`
- [ ] The currency display in the PNG generated by "Save image" conforms to English mode
- [ ] The sharing functions "Post to X", "Copy URL", and "Open in new tab" work correctly in English mode as well