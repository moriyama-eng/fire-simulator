// js/core/headless-params.js
// Headless execution parameter normalization module.
// Currency is label-only. No fixed-rate conversion ($1=100JPY) is applied.
// All monetary values are accepted in base currency units (JPY or USD).

// ----- Defaults for headless execution (base currency units) -----
// Do NOT mix in UI-unit DEFAULTS from js/core/params.js.
export const HEADLESS_DEFAULTS = Object.freeze({
    initialRiskAsset:  100_000_000,   // 100M JPY equivalent (base unit)
    initialCashBuffer:  10_000_000,   // 10M JPY equivalent
    monthlyExpense:        300_000,   // 300K JPY equivalent
    expectedReturn:           10.0,
    volatility:               18.0,
    inflationRate:             2.0,
    simYears:                   30,
    simPaths:                10000,
    drawdownTrigger:         -20.0,
    drawdownReplenish:        -5.0,
    replenishPace:             5.0,
    guardrailTrigger:        -20.0,
    guardrailReduction:      -20.0,
    guardrailRelease:        -15.0,
    infVol:                    2.0,
    infAr:                     0.5,
    simDfNum:                  4.0,
    seedNum:                123456,
    targetAssetRatio:        100.0,
    // Boolean fields (all false by default)
    cashBufferToggle:        false,
    guardrailToggle:         false,
    useArInflation:          false,
    useTDistribution:        false,
    simDfManual:             false,   // false = auto DF mode (uses calcAutoDf)
    currency:               'JPY',
});

// ----- Percentiles normalization (M6) -----
/**
 * Normalize a percentiles array using the same rules as formatPercentileInput:
 * - Integer values 1-99 only
 * - Deduplicated
 * - Sorted ascending
 * - Maximum 5 entries
 * - Returns default [10,30,50,70,90] when input is empty or invalid
 *
 * @param {any} arr - Input array (may be undefined, null, or empty)
 * @returns {number[]} Normalized percentiles array
 */
export function normalizeHeadlessPercentiles(arr) {
    const DEFAULT_PERCENTILES = [10, 30, 50, 70, 90];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_PERCENTILES;

    const valid = arr
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1 && v <= 99);

    // Deduplicate and sort ascending
    const unique = [...new Set(valid)].sort((a, b) => a - b);
    // Limit to 5 entries
    const limited = unique.slice(0, 5);

    return limited.length === 0 ? DEFAULT_PERCENTILES : limited;
}

// ----- Parameter normalization (single clamp aggregation layer) -----
/**
 * Accept raw input (flat JSON in base currency units), fill missing fields with
 * HEADLESS_DEFAULTS, and apply the same clamps/corrections used by
 * getParamsFromInputs and comparison-runner.
 * This function is the sole clamp aggregation layer;
 * runSimulationHeadless itself does NOT clamp.
 *
 * @param {Object} raw - Raw input parameters
 * @returns {Object} Fully normalized params object
 */
export function normalizeHeadlessParams(raw) {
    // Fill missing fields with HEADLESS_DEFAULTS
    const p = { ...HEADLESS_DEFAULTS, ...raw };

    // ----- Sanitize floats (NaN/Inf fall back to default value) -----
    const safeFloat = (key) => {
        const v = Number(p[key]);
        return Number.isFinite(v) ? v : HEADLESS_DEFAULTS[key];
    };

    p.expectedReturn = safeFloat('expectedReturn');
    p.volatility     = safeFloat('volatility');
    p.inflationRate  = safeFloat('inflationRate');

    // ----- Clamps (sources: getParamsFromInputs / comparison-runner / new guards) -----

    // simPaths: clamp to [5000, 50000] and round (matches getParamsFromInputs)
    p.simPaths = Math.max(5000, Math.min(50000, Math.round(Number(p.simPaths))));

    // simYears: minimum 1 (prevents negative dataLen)
    p.simYears = Math.max(1, Math.round(Number(p.simYears)));

    // seedNum: clamp to [1, 99999999] (consistent with comparison-state.js setCommonSeed)
    p.seedNum = Math.min(99999999, Math.max(1, Math.floor(Number(p.seedNum) || HEADLESS_DEFAULTS.seedNum)));

    // Monetary values: guard against negatives
    p.initialRiskAsset  = Math.max(0, Number(p.initialRiskAsset));
    p.initialCashBuffer = Math.max(0, Number(p.initialCashBuffer));
    p.monthlyExpense    = Math.max(0, Number(p.monthlyExpense));

    // Negative-clamp (matches getParamsFromInputs / comparison-runner)
    p.drawdownTrigger    = Math.min(0, Number(p.drawdownTrigger));
    p.drawdownReplenish  = Math.min(0, Number(p.drawdownReplenish));
    p.guardrailTrigger   = Math.min(0, Number(p.guardrailTrigger));
    p.guardrailReduction = Math.min(0, Number(p.guardrailReduction));
    p.guardrailRelease   = Math.min(0, Number(p.guardrailRelease));

    // Positive-clamp (matches getParamsFromInputs)
    p.replenishPace = Math.max(0, Number(p.replenishPace));

    // infVol: minimum 0 (matches comparison-runner)
    p.infVol = Math.max(0, Number(p.infVol));

    // infAr: clamp to [0, 1.0] (matches comparison-runner)
    p.infAr = Math.min(1.0, Math.max(0, Number(p.infAr)));

    // simDfNum: minimum 2.5 (matches getParamsFromInputs)
    p.simDfNum = Math.max(2.5, Number(p.simDfNum));

    // targetAssetRatio: clamp to [0, 500] (matches comparison-runner)
    p.targetAssetRatio = Math.min(500, Math.max(0, Number(p.targetAssetRatio)));

    // ----- M7: guardrail cross-validation -----
    // When guardrailToggle is true and guardrailRelease < guardrailTrigger,
    // snap guardrailRelease to guardrailTrigger (matches actions.js in the UI path).
    if (p.guardrailToggle && p.guardrailRelease < p.guardrailTrigger) {
        p.guardrailRelease = p.guardrailTrigger;
    }

    // currency: accept only 'JPY' or 'USD' (label-only, no conversion)
    if (p.currency !== 'JPY' && p.currency !== 'USD') {
        p.currency = HEADLESS_DEFAULTS.currency;
    }

    return p;
}
