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
        expect(resultCell.textContent.trim()).toBe('');
    });

    it('「すべて実行」ボタンがシミュレーションを呼び出す', async () => {
        const runBtn = document.getElementById('runAllBtn');
        runBtn.click();
        await waitFor(() => expect(runSimulation).toHaveBeenCalled());
    });

    it('CB OFF時にinitial_cash_bufferの入力欄がdisabledになる', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'cashBufferEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="initialCashBuffer"]');
        expect(input.disabled).toBe(true);
    });

    it('GR OFF時にguardrail_triggerの入力欄がdisabledになる', () => {
        const scenario = CS.getScenarios()[0];
        CS.updateScenarioInput(scenario.id, 'guardrailEnabled', false);
        renderComparisonTab();
        const input = document.querySelector('input[data-field="guardrailTrigger"]');
        expect(input.disabled).toBe(true);
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

    it('トグルがランダムの状態で「すべて実行」すると、シード入力欄のvalueがランダムシード値に即時更新される', async () => {
        const seedToggle = document.getElementById('commonSeedToggle');
        const seedInput = document.getElementById('commonSeedInput');
        
        // 初期状態はランダム（checked === true）
        expect(seedToggle.checked).toBe(true);
        const oldSeed = seedInput.value;
        
        const runBtn = document.getElementById('runAllBtn');
        runBtn.click();
        
        // 実行直後にシード入力欄のvalueが更新される
        expect(seedInput.value).not.toBe(oldSeed);
        expect(seedInput.value).toBe(CS.getCommonSeed().toString());
    });
});
