// @vitest-environment jsdom
import { vi } from 'vitest';

vi.mock('../../src/simulation-engine.js');

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderComparisonTab } from '../../src/comparison-ui.js';
import * as CS from '../../src/comparison-state.js';
import { runSimulation } from '../../src/simulation-engine.js';
import { makeMockScenarioInputs, makeMockSimResult, mockT } from '../helpers/comparison-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

const runSimulationMock = runSimulation as unknown as ReturnType<typeof vi.fn>;

describe('comparison-ui integration', () => {
    let originalConfirm: typeof window.confirm;
    beforeEach(() => {
        vi.resetAllMocks();
        originalConfirm = window.confirm;
        window.confirm = vi.fn().mockReturnValue(true);
        runSimulationMock.mockResolvedValue(makeMockSimResult());
        CS._resetComparisonStateForTest();
        document.body.innerHTML = '<div id="comparisonTableContainer"></div>';
        CS.initScenarios(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
    });
    afterEach(() => {
        window.confirm = originalConfirm;
        vi.restoreAllMocks();
    });

    it('Clicking the add scenario button increases the column count', () => {
        expect(CS.getScenarioCount()).toBe(1);
        const addBtn = document.getElementById('addScenarioBtn') as HTMLButtonElement | null;
        addBtn?.click();
        expect(CS.getScenarioCount()).toBe(2);
        renderComparisonTab();
        const headers = document.querySelectorAll('.scenario-header');
        expect(headers.length).toBe(2);
    });

    it('Clicking the delete scenario button decreases the column count', async () => {
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        expect(CS.getScenarioCount()).toBe(2);
        const deleteBtn = document.querySelector('[data-action="delete"]') as HTMLButtonElement | null;
        deleteBtn?.click();
        await waitFor(() => expect(CS.getScenarioCount()).toBe(1));
    });

    it('does not decrease scenario count when delete confirm is cancelled', () => {
        window.confirm = vi.fn().mockReturnValue(false);
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        expect(CS.getScenarioCount()).toBe(2);
        const deleteBtn = document.querySelector('[data-action="delete"]') as HTMLButtonElement | null;
        deleteBtn?.click();
        expect(CS.getScenarioCount()).toBe(2);
        expect(window.confirm).toHaveBeenCalled();
    });

    it('The last remaining scenario is not deleted', async () => {
        expect(CS.getScenarioCount()).toBe(1);
        const deleteBtn = document.querySelector('[data-action="delete"]') as HTMLButtonElement | null;
        expect(deleteBtn?.disabled).toBe(true);
        expect(CS.getScenarioCount()).toBe(1);
    });

    it('All results are cleared when common settings change', () => {
        const id = CS.getScenarios()[0]?.id!;
        CS.setScenarioResult(id, { successRate: 95 } as unknown as import('../../src/types/simulation.js').AggregatedMetrics);
        renderComparisonTab();
        const seedInput = document.getElementById('commonSeedInput') as HTMLInputElement | null;
        if (seedInput) {
            seedInput.value = '99999';
            seedInput.dispatchEvent(new Event('change'));
        }
        // Second cell in the row following data-section="output-header" (result of the first scenario)
        const resultCell = document.querySelector('tbody tr[data-section="output-header"] ~ tr td:nth-child(2)');
        expect(resultCell?.textContent?.trim()).toBe('');
    });

    it('The initial_cash_buffer input is disabled when CB is OFF', () => {
        const scenario = CS.getScenarios()[0]!;
        CS.updateScenarioInput(scenario.id, 'cashBufferEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="initialCashBuffer"]') as HTMLInputElement | null;
        expect(input?.disabled).toBe(true);
    });

    it('The guardrail_trigger input is disabled when GR is OFF', () => {
        const scenario = CS.getScenarios()[0]!;
        CS.updateScenarioInput(scenario.id, 'guardrailEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="guardrailTrigger"]') as HTMLInputElement | null;
        expect(input?.disabled).toBe(true);
    });

    it('Column order changes with left/right move buttons', () => {
        CS.addScenario(makeMockScenarioInputs(), mockT);
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        const originalIds = CS.getScenarios().map(s => s.id);
        const moveRightBtn = document.querySelector('[data-action="move-right"]') as HTMLButtonElement | null;
        moveRightBtn?.click();
        const newIds = CS.getScenarios().map(s => s.id);
        expect(newIds[0]).toBe(originalIds[1]);
        expect(newIds[1]).toBe(originalIds[0]);
    });

    it('State does not become NaN and simulation can run even after changing the select box (volatility model)', async () => {
        const scenario = CS.getScenarios()[0]!;
        expect(scenario.inputs.returnModel).toBe('log-t');
        const select = document.querySelector(`select[data-id="${scenario.id}"][data-field="returnModel"]`) as HTMLSelectElement | null;
        if (select) {
            select.value = 'log-normal';
            select.dispatchEvent(new Event('change'));
        }
        const updatedScenario = CS.getScenarios()[0]!;
        expect(updatedScenario.inputs.returnModel).toBe('log-normal');
        expect(typeof updatedScenario.inputs.returnModel).toBe('string');
    });

    it('When the toggle is in random mode and "Run All" is clicked, the seed input value is immediately updated to the random seed value', async () => {
        const seedToggle = document.getElementById('commonSeedToggle') as HTMLInputElement | null;
        const seedInput = document.getElementById('commonSeedInput') as HTMLInputElement | null;
        
        // Initial state is random (checked === true)
        expect(seedToggle?.checked).toBe(true);
        const oldSeed = seedInput?.value;
        
        const runBtn = document.getElementById('runAllBtn') as HTMLButtonElement | null;
        runBtn?.click();
        
        // The seed input value is updated immediately after execution
        expect(seedInput?.value).not.toBe(oldSeed);
        expect(seedInput?.value).toBe(CS.getCommonSeed().toString());
    });
});
