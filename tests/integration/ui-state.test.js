// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { markInputChanged, markResultClean } from '../../js/core/state.js';
vi.mock('../../js/simulation-engine.js', () => ({ runSimulation: vi.fn().mockResolvedValue({}), setProgressCallback: vi.fn() }));

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');
describe('dirty state', () => {
    beforeEach(() => { document.body.innerHTML = dom; markResultClean(); });
    it('disables buttons when input changes', () => {
        markInputChanged();
        expect(document.getElementById('shareXBtn').disabled).toBe(true);
    });
    it('re-enables buttons after re-execution', () => {
        markInputChanged();
        markResultClean();
        expect(document.getElementById('shareXBtn').disabled).toBe(false);
    });
});