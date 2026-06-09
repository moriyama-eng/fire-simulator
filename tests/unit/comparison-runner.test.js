import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertComparisonParamsToLegacy, runAllScenarios } from '../../js/comparison-runner.js';
import * as CS from '../../js/comparison-state.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { makeMockScenarioInputs, makeMockSimResult, mockT } from '../helpers/comparison-fixtures.js';

vi.mock('../../js/simulation-engine.js');

describe('comparison-runner', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        CS._resetComparisonStateForTest();
        runSimulation.mockResolvedValue(makeMockSimResult());
    });

    describe('convertComparisonParamsToLegacy', () => {
        it('converts basic fields correctly', () => {
            const inputs = makeMockScenarioInputs({
                initialRiskAsset: 150000000,
                expectedReturn: 11.0,
                volatility: 19.0,
                simYears: 35,
                cashBufferEnabled: true,
                guardrailEnabled: true,
            });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.initialRiskAsset).toBe(150000000);
            expect(legacy.expectedReturn).toBe(11.0);
            expect(legacy.simYears).toBe(35);
            expect(legacy.cashBufferToggle).toBe(true);
            expect(legacy.guardrailToggle).toBe(true);
            expect(legacy.seedNum).toBe(123456);
            expect(legacy.simPaths).toBe(10000);
        });

        it('sets initialCashBuffer to 0 when CB disabled', () => {
            const inputs = makeMockScenarioInputs({ cashBufferEnabled: false, initialCashBuffer: 10000000 });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.initialCashBuffer).toBe(0);
        });

        it('handles t-distribution mode correctly', () => {
            const inputs = makeMockScenarioInputs({ returnModel: 'log-t', tDfMode: 'manual', tDfManual: 6.0 });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.useTDistribution).toBe(true);
            expect(legacy.simDfManual).toBe(true);
            expect(legacy.simDfNum).toBe(6.0);
        });

        it('handles AR-1 inflation model correctly', () => {
            const inputs = makeMockScenarioInputs({ inflationModel: 'ar1', infVol: 2.5, infAr: 0.7 });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.useArInflation).toBe(true);
            expect(legacy.infVol).toBe(2.5);
            expect(legacy.infAr).toBe(0.7);
        });

        it('clamps negative values', () => {
            const inputs = makeMockScenarioInputs({ drawdownTrigger: -30, drawdownReplenish: -10, guardrailTrigger: -25 });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.drawdownTrigger).toBe(-30);
            expect(legacy.drawdownReplenish).toBe(-10);
            expect(legacy.guardrailTrigger).toBe(-25);
        });

        it('clamps targetAssetRatio', () => {
            const inputs = makeMockScenarioInputs({ targetAssetRatio: 600 });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.targetAssetRatio).toBe(500);
            const inputs2 = makeMockScenarioInputs({ targetAssetRatio: -10 });
            const legacy2 = convertComparisonParamsToLegacy(inputs2, 123456, 10000);
            expect(legacy2.targetAssetRatio).toBe(0);
        });

        it('clamps simPaths', () => {
            const inputs = makeMockScenarioInputs();
            let legacy = convertComparisonParamsToLegacy(inputs, 123456, 500);
            expect(legacy.simPaths).toBe(1000);
            legacy = convertComparisonParamsToLegacy(inputs, 123456, 60000);
            expect(legacy.simPaths).toBe(50000);
        });

        it('guards tDfManual undefined', () => {
            const inputs = makeMockScenarioInputs({ tDfManual: undefined });
            const legacy = convertComparisonParamsToLegacy(inputs, 123456, 10000);
            expect(legacy.simDfNum).toBe(4.0);
        });
    });

    describe('runAllScenarios', () => {
        it('executes simulations for all scenarios sequentially', async () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            CS.addScenario(makeMockScenarioInputs(), mockT);
            const progressSpy = vi.fn();
            const completeSpy = vi.fn();
            const errorSpy = vi.fn();
            await runAllScenarios(progressSpy, () => {}, completeSpy, errorSpy);
            expect(runSimulation).toHaveBeenCalledTimes(2);
            expect(progressSpy).toHaveBeenCalledWith(1, 2);
            expect(progressSpy).toHaveBeenCalledWith(2, 2);
            expect(completeSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('handles simulation errors and continues', async () => {
            runSimulation.mockRejectedValueOnce(new Error('Sim failed'));
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            CS.addScenario(makeMockScenarioInputs(), mockT);
            const errorSpy = vi.fn();
            const completeSpy = vi.fn();
            await runAllScenarios(() => {}, () => {}, completeSpy, errorSpy);
            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(completeSpy).toHaveBeenCalledTimes(1);
            const scenarios = CS.getScenarios();
            expect(scenarios[0].error).toBeDefined();
            expect(scenarios[1].error).toBeNull();
        });

        it('does nothing if no scenarios', async () => {
            await runAllScenarios(() => {}, () => {}, () => {}, () => {});
            expect(runSimulation).not.toHaveBeenCalled();
        });

        it('sets isRunning flag correctly even on error', async () => {
            runSimulation.mockRejectedValueOnce(new Error('Sim failed'));
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            expect(CS.getIsRunning()).toBe(false);
            await runAllScenarios(() => {}, () => {}, () => {}, () => {});
            expect(CS.getIsRunning()).toBe(false);
        });
    });
});
