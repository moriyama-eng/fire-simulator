// tests/helpers/comparison-fixtures.js

/**
 * モックのシナリオ入力パラメータを生成
 * @param {Object} overrides - 上書きするフィールド
 * @returns {Object}
 */
export function makeMockScenarioInputs(overrides = {}) {
    return {
        initialRiskAsset: 100000000,          // 1億円
        initialCashBuffer: 10000000,          // 1000万円
        monthlyExpense: 300000,               // 30万円
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
 * モックのシナリオオブジェクトを生成
 * @param {string} id - シナリオID
 * @param {string} name - シナリオ名
 * @param {Object} inputsOverrides - 入力パラメータの上書き
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
 * モックのシミュレーション結果を生成
 * @param {Object} overrides - 上書きするフィールド
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
 * モックの翻訳関数（単体テスト用）
 * @param {string} key - 翻訳キー
 * @param {Array} args - プレースホルダー引数
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
