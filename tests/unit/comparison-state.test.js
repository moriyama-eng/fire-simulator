import { describe, it, expect, beforeEach } from 'vitest';
import * as CS from '../../js/comparison-state.js';
import { makeMockScenarioInputs, mockT } from '../helpers/comparison-fixtures.js';

describe('comparison-state', () => {
    beforeEach(() => CS._resetComparisonStateForTest());

    describe('createInputsFromSimParams', () => {
        it('converts simParams correctly', () => {
            const simParams = {
                initialRiskAsset: 200000000,
                initialCashBuffer: 20000000,
                monthlyExpense: 400000,
                targetAssetRatio: 120,
                expectedReturn: 11.0,
                volatility: 19.0,
                inflationRate: 2.5,
                simYears: 35,
                useTDistribution: true,
                simDfManual: false,
                simDfNum: 5.0,
                useArInflation: true,
                infVol: 2.2,
                infAr: 0.6,
                cashBufferToggle: true,
                drawdownTrigger: -25,
                drawdownReplenish: -8,
                replenishPace: 4.5,
                guardrailToggle: true,
                guardrailTrigger: -22,
                guardrailRelease: -17,
                guardrailReduction: -18,
            };
            const inputs = CS.createInputsFromSimParams(simParams);
            expect(inputs.initialRiskAsset).toBe(200000000);
            expect(inputs.returnModel).toBe('log-t');
            expect(inputs.tDfMode).toBe('auto');
            expect(inputs.inflationModel).toBe('ar1');
            expect(inputs.guardrailEnabled).toBe(true);
        });
    });

    describe('scenario management', () => {
        it('initializes with one scenario', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            expect(CS.getScenarioCount()).toBe(1);
            expect(CS.getScenarios()[0].name).toBe('Scenario 1');
        });

        it('adds scenario up to max 10', () => {
            const inputs = makeMockScenarioInputs();
            for (let i = 0; i < 10; i++) CS.addScenario(inputs, mockT);
            expect(CS.getScenarioCount()).toBe(10);
            expect(CS.addScenario(inputs, mockT)).toBe(false);
        });

        it('deletes scenario when more than one', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            CS.addScenario(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            expect(CS.deleteScenario(id)).toBe(true);
            expect(CS.getScenarioCount()).toBe(1);
        });

        it('does not delete the last scenario', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            expect(CS.deleteScenario(id)).toBe(false);
            expect(CS.getScenarioCount()).toBe(1);
        });

        it('duplicates scenario', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const originalId = CS.getScenarios()[0].id;
            CS.duplicateScenario(originalId, mockT);
            expect(CS.getScenarioCount()).toBe(2);
            expect(CS.getScenarios()[1].name).toBe('Copy of Scenario 1');
            expect(CS.getScenarios()[1].inputs).toEqual(CS.getScenarios()[0].inputs);
        });

        it('updates scenario name', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.updateScenarioName(id, 'New Name');
            expect(CS.getScenarios()[0].name).toBe('New Name');
        });

        it('overwrites scenario from sim params', () => {
            CS.initScenarios(makeMockScenarioInputs({ initialRiskAsset: 100000000 }), mockT);
            const id = CS.getScenarios()[0].id;
            const newInputs = makeMockScenarioInputs({ initialRiskAsset: 200000000 });
            CS.overwriteScenarioFromSim(id, newInputs);
            expect(CS.getScenarios()[0].inputs.initialRiskAsset).toBe(200000000);
            expect(CS.getScenarios()[0].result).toBeNull();
        });

        it('updates scenario input and clears result', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.setScenarioResult(id, { successRate: 95 });
            expect(CS.getScenarios()[0].result).not.toBeNull();
            CS.updateScenarioInput(id, 'expectedReturn', 12.0);
            expect(CS.getScenarios()[0].inputs.expectedReturn).toBe(12.0);
            expect(CS.getScenarios()[0].result).toBeNull();
        });

        it('moves scenario left and right', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            CS.addScenario(makeMockScenarioInputs(), mockT);
            CS.addScenario(makeMockScenarioInputs(), mockT);
            const ids = CS.getScenarios().map(s => s.id);
            CS.moveScenario(1, 0);
            expect(CS.getScenarios()[0].id).toBe(ids[1]);
            CS.moveScenario(0, 2);
            expect(CS.getScenarios()[2].id).toBe(ids[1]);
        });

        it('handles move on empty scenarios gracefully', () => {
            expect(() => CS.moveScenario(0, 1)).not.toThrow();
        });
    });

    describe('common settings', () => {
        it('sets common seed and clears results', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.setScenarioResult(id, { successRate: 95 });
            CS.setCommonSeed(99999);
            expect(CS.getCommonSeed()).toBe(99999);
            expect(CS.getScenarios()[0].result).toBeNull();
        });

        it('sets common paths and clears results', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.setScenarioResult(id, { successRate: 95 });
            CS.setCommonPaths(20000);
            expect(CS.getCommonPaths()).toBe(20000);
            expect(CS.getScenarios()[0].result).toBeNull();
        });

        it('clamps seed and paths', () => {
            CS.setCommonSeed(0); expect(CS.getCommonSeed()).toBe(1);
            CS.setCommonSeed(100000000); expect(CS.getCommonSeed()).toBe(99999999);
            CS.setCommonPaths(500); expect(CS.getCommonPaths()).toBe(1000);
            CS.setCommonPaths(60000); expect(CS.getCommonPaths()).toBe(50000);
        });
    });

    describe('result management', () => {
        it('sets scenario result and clears error', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.setScenarioError(id, 'some error');
            CS.setScenarioResult(id, { successRate: 95 });
            expect(CS.getScenarios()[0].result).toEqual({ successRate: 95 });
            expect(CS.getScenarios()[0].error).toBeNull();
        });

        it('sets scenario error and clears result', () => {
            CS.initScenarios(makeMockScenarioInputs(), mockT);
            const id = CS.getScenarios()[0].id;
            CS.setScenarioResult(id, { successRate: 95 });
            CS.setScenarioError(id, 'error message');
            expect(CS.getScenarios()[0].error).toBe('error message');
            expect(CS.getScenarios()[0].result).toBeNull();
        });
    });
});
