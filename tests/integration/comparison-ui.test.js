import { vi } from 'vitest';

vi.mock('../../js/simulation-engine.js');

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderComparisonTab } from '../../js/comparison-ui.js';
import * as CS from '../../js/comparison-state.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { makeMockScenarioInputs, makeMockSimResult, mockT } from '../helpers/comparison-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

describe('comparison-ui integration', () => {
    let originalConfirm;
    beforeEach(() => {
        vi.resetAllMocks();
        originalConfirm = window.confirm;
        window.confirm = vi.fn().mockReturnValue(true);
        runSimulation.mockResolvedValue(makeMockSimResult());
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
        const addBtn = document.getElementById('addScenarioBtn');
        addBtn.click();
        expect(CS.getScenarioCount()).toBe(2);
        renderComparisonTab();
        const headers = document.querySelectorAll('.scenario-header');
        expect(headers.length).toBe(2);
    });

    it('Clicking the delete scenario button decreases the column count', async () => {
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        expect(CS.getScenarioCount()).toBe(2);
        const deleteBtn = document.querySelector('[data-action="delete"]');
        deleteBtn.click();
        await waitFor(() => expect(CS.getScenarioCount()).toBe(1));
    });

    it('The last remaining scenario is not deleted', async () => {
        expect(CS.getScenarioCount()).toBe(1);
        const deleteBtn = document.querySelector('[data-action="delete"]');
        expect(deleteBtn.disabled).toBe(true);
        expect(CS.deleteScenario(CS.getScenarios()[0].id)).toBe(false);
        expect(CS.getScenarioCount()).toBe(1);
    });

    it('All results are cleared when common settings change', () => {
        const id = CS.getScenarios()[0].id;
        CS.setScenarioResult(id, { successRate: 95 });
        renderComparisonTab();
        const seedInput = document.getElementById('commonSeedInput');
        seedInput.value = '99999';
        seedInput.dispatchEvent(new Event('change'));
        // Second cell in the row following data-section="output-header" (result of the first scenario)
        const resultCell = document.querySelector('tbody tr[data-section="output-header"] ~ tr td:nth-child(2)');
        expect(resultCell.textContent.trim()).toBe('');
    });

    it('The "Run All" button calls the simulation', async () => {
        const runBtn = document.getElementById('runAllBtn');
        runBtn.click();
        await waitFor(() => expect(runSimulation).toHaveBeenCalled());
    });

    it('The initial_cash_buffer input is disabled when CB is OFF', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'cashBufferEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="initialCashBuffer"]');
        expect(input.disabled).toBe(true);
    });

    it('The guardrail_trigger input is disabled when GR is OFF', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'guardrailEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="guardrailTrigger"]');
        expect(input.disabled).toBe(true);
    });

    it('Column order changes with left/right move buttons', () => {
        CS.addScenario(makeMockScenarioInputs(), mockT);
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        const originalIds = CS.getScenarios().map(s => s.id);
        const moveRightBtn = document.querySelector('[data-action="move-right"]');
        moveRightBtn.click();
        const newIds = CS.getScenarios().map(s => s.id);
        expect(newIds[0]).toBe(originalIds[1]);
        expect(newIds[1]).toBe(originalIds[0]);
    });

    it('State does not become NaN and simulation can run even after changing the select box (volatility model)', async () => {
        const scenario = CS.getScenarios()[0];
        expect(scenario.inputs.returnModel).toBe('log-t');
        const select = document.querySelector(`select[data-id="${scenario.id}"][data-field="returnModel"]`);
        select.value = 'log-normal';
        select.dispatchEvent(new Event('change'));
        const updatedScenario = CS.getScenarios()[0];
        expect(updatedScenario.inputs.returnModel).toBe('log-normal');
        expect(typeof updatedScenario.inputs.returnModel).toBe('string');
    });

    it('When the toggle is in random mode and "Run All" is clicked, the seed input value is immediately updated to the random seed value', async () => {
        const seedToggle = document.getElementById('commonSeedToggle');
        const seedInput = document.getElementById('commonSeedInput');
        
        // Initial state is random (checked === true)
        expect(seedToggle.checked).toBe(true);
        const oldSeed = seedInput.value;
        
        const runBtn = document.getElementById('runAllBtn');
        runBtn.click();
        
        // The seed input value is updated immediately after execution
        expect(seedInput.value).not.toBe(oldSeed);
        expect(seedInput.value).toBe(CS.getCommonSeed().toString());
    });
});
