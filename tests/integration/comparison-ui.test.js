import { vi } from 'vitest';

vi.mock('../../js/simulation-engine.js');

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderComparisonTab } from '../../js/comparison-ui.js';
import * as CS from '../../js/comparison-state.js';
import { runSimulation } from '../../js/simulation-engine.js';
import { makeMockScenarioInputs, makeMockSimResult, mockT } from '../helpers/comparison-fixtures.js';
import { waitFor } from '../helpers/async-utils.js';

describe('comparison-ui integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        runSimulation.mockResolvedValue(makeMockSimResult());
        CS._resetComparisonStateForTest();
        document.body.innerHTML = '<div id="comparisonTableContainer"></div>';
        CS.initScenarios(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
    });
    afterEach(() => vi.restoreAllMocks());

    it('シナリオ追加ボタンで列が増える', () => {
        expect(CS.getScenarioCount()).toBe(1);
        const addBtn = document.getElementById('addScenarioBtn');
        addBtn.click();
        expect(CS.getScenarioCount()).toBe(2);
        renderComparisonTab();
        const headers = document.querySelectorAll('.scenario-header');
        expect(headers.length).toBe(2);
    });

    it('シナリオ削除ボタンで列が減る', async () => {
        CS.addScenario(makeMockScenarioInputs(), mockT);
        renderComparisonTab();
        expect(CS.getScenarioCount()).toBe(2);
        const deleteBtn = document.querySelector('[data-action="delete"]');
        deleteBtn.click();
        await waitFor(() => expect(CS.getScenarioCount()).toBe(1));
    });

    it('最後の1つのシナリオは削除されない', async () => {
        expect(CS.getScenarioCount()).toBe(1);
        const deleteBtn = document.querySelector('[data-action="delete"]');
        expect(deleteBtn.disabled).toBe(true);
        expect(CS.deleteScenario(CS.getScenarios()[0].id)).toBe(false);
        expect(CS.getScenarioCount()).toBe(1);
    });

    it('共通設定変更時に全結果がクリアされる', () => {
        const id = CS.getScenarios()[0].id;
        CS.setScenarioResult(id, { successRate: 95 });
        renderComparisonTab();
        const seedInput = document.getElementById('commonSeedInput');
        seedInput.value = '99999';
        seedInput.dispatchEvent(new Event('change'));
        // data-section="output-header" の次の行の2つ目のセル（最初のシナリオの結果）
        const resultCell = document.querySelector('tbody tr[data-section="output-header"] ~ tr td:nth-child(2)');
        expect(resultCell.textContent.trim()).toBe('-');
    });

    it('「すべて実行」ボタンがシミュレーションを呼び出す', async () => {
        const runBtn = document.getElementById('runAllBtn');
        runBtn.click();
        await waitFor(() => expect(runSimulation).toHaveBeenCalled());
    });

    it('CB OFF時にinitial_cash_buffer行が非表示になる', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'cashBufferEnabled', false);
        renderComparisonTab();
        const rows = document.querySelectorAll('tr');
        let found = false;
        rows.forEach(row => { if (row.textContent && row.textContent.includes('初期現金バッファ')) found = true; });
        expect(found).toBe(false);
    });

    it('GR OFF時にguardrail_trigger行が非表示になる', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'guardrailEnabled', false);
        renderComparisonTab();
        const rows = document.querySelectorAll('tr');
        let found = false;
        rows.forEach(row => { if (row.textContent && row.textContent.includes('発動')) found = true; });
        expect(found).toBe(false);
    });

    it('左右移動ボタンで列順序が変わる', () => {
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

    it('セレクトボックス（変動モデル）を変更しても状態がNaNにならず、シミュレーションが実行できる', async () => {
        const scenario = CS.getScenarios()[0];
        expect(scenario.inputs.returnModel).toBe('log-t');
        const select = document.querySelector(`select[data-id="${scenario.id}"][data-field="returnModel"]`);
        select.value = 'log-normal';
        select.dispatchEvent(new Event('change'));
        const updatedScenario = CS.getScenarios()[0];
        expect(updatedScenario.inputs.returnModel).toBe('log-normal');
        expect(typeof updatedScenario.inputs.returnModel).toBe('string');
    });
});
