import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { markInputChanged, markResultClean } from '../../js/core/state.js';
vi.mock('../../js/simulation-engine.js', () => ({ runSimulation: vi.fn().mockResolvedValue({}), setProgressCallback: vi.fn() }));

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
describe('dirty 状態', () => {
    beforeEach(() => { document.body.innerHTML = dom; markResultClean(); });
    it('入力変更でボタン無効化', () => {
        document.getElementById('expectedReturnNum').value = '15.0';
        document.getElementById('expectedReturnNum').dispatchEvent(new Event('input', { bubbles: true }));
        markInputChanged();
        expect(document.getElementById('shareXBtn').disabled).toBe(true);
    });
    it('再実行で再有効化', () => {
        markInputChanged();
        markResultClean();
        expect(document.getElementById('shareXBtn').disabled).toBe(false);
    });
});