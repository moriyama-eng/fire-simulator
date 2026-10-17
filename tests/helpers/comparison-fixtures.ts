// tests/helpers/comparison-fixtures.ts

export interface MockScenarioInputs {
    initialRiskAsset: number;
    initialCashBuffer: number;
    monthlyExpense: number;
    targetAssetRatio: number;
    expectedReturn: number;
    volatility: number;
    inflationRate: number;
    simYears: number;
    returnModel: string;
    tDfMode: string;
    tDfManual: number;
    inflationModel: string;
    infVol: number;
    infAr: number;
    cashBufferEnabled: boolean;
    drawdownTrigger: number;
    drawdownReplenish: number;
    replenishPace: number;
    guardrailEnabled: boolean;
    guardrailTrigger: number;
    guardrailRelease: number;
    guardrailReduction: number;
    [key: string]: unknown;
}

export interface MockScenario {
    id: string;
    name: string;
    inputs: MockScenarioInputs;
    result: unknown | null;
    error: unknown | null;
}

export interface MockSimResult {
    successRate: number;
    finalMedian: number;
    targetAssetMaintainRate: number;
    worst10MaxDd: number;
    medianMaxUw: number;
    [key: string]: unknown;
}

/**
 * Generate mock scenario input parameters
 */
export function makeMockScenarioInputs(overrides: Partial<MockScenarioInputs> = {}): MockScenarioInputs {
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
 */
export function makeMockScenario(id: string = 'test-id', name: string = 'Test Scenario', inputsOverrides: Partial<MockScenarioInputs> = {}): MockScenario {
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
 */
export function makeMockSimResult(overrides: Partial<MockSimResult> = {}): MockSimResult {
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
 */
export function mockT(key: string, args: (string | number)[] = []): string {
    const map: Record<string, string> = {
        'comparison.scenarioDefaultName': `Scenario ${args[0] || 1}`,
        'comparison.duplicateName': `Copy of ${args[0] || 'Scenario'}`,
        'comparison.maxScenarios': 'Maximum 10 scenarios allowed',
        'comparison.confirmDelete': 'Delete this scenario?',
        'comparison.moveHint': 'Use ← → buttons to reorder scenarios.',
    };
    return map[key] || key;
}
