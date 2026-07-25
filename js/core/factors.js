// ====================================================================
// js/core/factors.js
// Factor definitions shared by the analysis UI and the headless CLI.
// ====================================================================

// ----- Factor definitions -----
// paramKey must exactly match the property name in baseEffectiveParams (generated in app.js).
// It is also the property name used to apply factor changes in applyFactorChange (analysis-runner.js).
export const FACTORS = [
    { key: 'initial_risk_asset_jpy', labelKey: 'analysis.factors.initial_risk_asset_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.oku', step: 0.1, decimals: 1, scale: 1e8, paramKey: 'initialRiskAsset' },
    { key: 'initial_cash_buffer_jpy', labelKey: 'analysis.factors.initial_cash_buffer_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.man', step: 500, decimals: 0, scale: 1e4, paramKey: 'initialCashBuffer' },
    { key: 'monthly_expense_jpy', labelKey: 'analysis.factors.monthly_expense_jpy', categoryKey: 'analysis.category.asset', catClass: 'cat-asset', unitKey: 'unit.man', step: 5, decimals: 0, scale: 1e4, paramKey: 'monthlyExpense' },
    { key: 'expected_return_pct', labelKey: 'analysis.factors.expected_return_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 1.0, decimals: 1, scale: 1, paramKey: 'expectedReturn' },
    { key: 'volatility_pct', labelKey: 'analysis.factors.volatility_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 1.0, decimals: 1, scale: 1, paramKey: 'volatility' },
    { key: 'inflation_rate_pct', labelKey: 'analysis.factors.inflation_rate_pct', categoryKey: 'analysis.category.market', catClass: 'cat-market', unitKey: 'unit.percent', step: 0.5, decimals: 1, scale: 1, paramKey: 'inflationRate' },
    { key: 'drawdown_trigger_pct', labelKey: 'analysis.factors.drawdown_trigger_pct', categoryKey: 'analysis.category.buffer', catClass: 'cat-buffer', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'drawdownTrigger', requiresFeature: 'cashBuffer' },
    { key: 'replenish_pace_x_expense', labelKey: 'analysis.factors.replenish_pace_x_expense', categoryKey: 'analysis.category.buffer', catClass: 'cat-buffer', unitKey: 'unit.multiplier', step: 0.5, decimals: 1, scale: 1, paramKey: 'replenishPace', requiresFeature: 'cashBuffer' },
    { key: 'guardrail_trigger_pct', labelKey: 'analysis.factors.guardrail_trigger_pct', categoryKey: 'analysis.category.guardrail', catClass: 'cat-guardrail', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailTrigger', requiresFeature: 'guardrail' },
    { key: 'guardrail_reduction_pct', labelKey: 'analysis.factors.guardrail_reduction_pct', categoryKey: 'analysis.category.guardrail', catClass: 'cat-guardrail', unitKey: 'unit.percent', step: 5.0, decimals: 1, scale: 1, paramKey: 'guardrailReduction', requiresFeature: 'guardrail' },
];
