// tests/helpers/comparison-fixtures.js

/**
 * Generate mock scenario input parameters
 * @param {Object} overrides - Fields to override
 * @returns {Object}
 */
export function makeMockScenarioInputs(overrides = {}) {
    return {
        initialRiskAsset: 100000000,          // 100 million yen
        initialCashBuffer: 10000000,          // 10 million yen
        monthlyExpense: 300000,               // 300 thousand yen
        targetAssetRatio: 100,                // 100%
        expectedReturn: 10.0,
        volatility: 18.0,
        inflationRate: 2.0,
        simYears: 30,
        returnModel: 'log-t',
        tDfMode: 'auto',
        tDfManual: 4.0,
        inflationModel: 'fixed',
        infVol: 2.0,
        infAr: 0.5,
        cashBufferEnabled: true,
        drawdownTrigger: -20.0,
        drawdownReplenish: -5.0,
        replenishPace: 5.0,
        guardrailEnabled: false,
        guardrailTrigger: -20.0,
        guardrailRelease: -15.0,
        guardrailReduction: -20.0,
        ...overrides,
    };
}

/**
 * Generate a mock scenario object
 * @param {string} id - Scenario ID
 * @param {string} name - Scenario name
 * @param {Object} inputsOverrides - Override for input parameters
 * @returns {Object}
 */
export function makeMockScenario(id = 'test-id', name = 'Test Scenario', inputsOverrides = {}) {
    return {
        id,
        name,
        inputs: makeMockScenarioInputs(inputsOverrides),
        result: null,
        error: null,
    };
}

/**
 * Generate mock simulation results
 * @param {Object} overrides - Fields to override
 * @returns {Object}
 */
export function makeMockSimResult(overrides = {}) {
    return {
        successRate: 93.5,
        finalMedian: 500000000,
        targetAssetMaintainRate: 85.0,
        worst10MaxDd: -0.35,
        medianMaxUw: 48,
        ...overrides,
    };
}

/**
 * Mock translation function (for unit tests)
 * @param {string} key - Translation key
 * @param {Array} args - Placeholder arguments
 * @returns {string}
 */
export function mockT(key, args = []) {
    const map = {
        'comparison.scenarioDefaultName': `Scenario ${args[0] || 1}`,
        'comparison.duplicateName': `Copy of ${args[0] || 'Scenario'}`,
        'comparison.maxScenarios': 'Maximum 10 scenarios allowed',
        'comparison.confirmDelete': 'Delete this scenario?',
        'comparison.moveHint': 'Use ← → buttons to reorder scenarios.',
    };
    return map[key] || key;
}
