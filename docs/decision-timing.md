# About Simulation Decision Timing (v2.4.2)

## Monthly Processing Order
In this Monte Carlo simulator, the processing for each month is executed in the following order:

1. **Update inflation rate**: Calculate the inflation rate (fixed, or variable using the AR-1 model) and determine the inflation multiplier for the current month.
2. **Apply market return**: Multiply the balance of risk assets by the current month's market return (log-normal or log-t distribution).
3. **Execute spending (withdrawal)**: Deduct the inflation-adjusted monthly spending from assets according to the configured rules (source of spending, use of cash buffer, spending guardrail) determined up to the previous month.
4. **Confirm post-spending total assets**: Confirm the end-of-month total assets (risk assets + cash buffer) after the spending execution.
5. **Execute end-of-month evaluation (determinations)**: Based on the post-spending total assets, perform all threshold determinations including bankruptcy occurrence, guardrail activation/deactivation, cash buffer usage, all-time high update, replenishment mode start/end, and maximum drawdown recording (results are reflected in the next month's actions).

## Explanation of Post-Spending Determination Criteria
All threshold determinations (switching withdrawal rules due to drawdown, guardrail activation, etc.) are made based on the **end-of-month total assets "after spending"**. This enables more realistic and conservative determinations that take into account the direct impact that not only market fluctuations, but also one's own living expense withdrawals have on assets.

## About Determination Lag
The results of end-of-month determinations (whether the guardrail was triggered, whether to draw from the cash buffer, etc.) are **applied from the "next month's" spending processing**.
This reproduces in the simulation the actual action lag in real life of "confirming that assets have decreased, then cutting back on living expenses the following month."

## Document Version History

- **v2.4.2**: Unified asset chart tooltip null label to '—' and separated update history to CHANGELOGs.
- **v2.4.1**: No changes to the core monthly processing logic. Extracted unit-independent clamp pure functions (`js/core/params.js`) and added bit-for-bit equivalence validation tests.
- **v2.4.0**: No changes to the core monthly processing logic. Added headless execution function (`runSimulationHeadless`) and CLI interface (`cli.js`).
- **v2.3.2**: No changes to the core monthly processing logic. Finalized English translations for documentation and code comments.
- **v2.2.0**: The "Comparison" tab was added, but there are no changes to the core monthly processing logic (inflation → market return → spending → determination).
