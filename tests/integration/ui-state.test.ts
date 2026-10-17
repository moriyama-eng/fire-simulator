// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { markInputChanged, markResultClean } from '../../src/core/state.js';

vi.mock('../../src/simulation-engine.js', () => ({
    runSimulation: vi.fn().mockResolvedValue({}),
    setProgressCallback: vi.fn()
}));

const dom = readFileSync('tests/fixtures/dom-snippet.html', 'utf-8');

describe('dirty state', () => {
    beforeEach(() => {
        document.body.innerHTML = dom;
        markResultClean();
    });

    it('disables buttons when input changes', () => {
        markInputChanged();
        const btn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(btn?.disabled).toBe(true);
    });

    it('re-enables buttons after re-execution', () => {
        markInputChanged();
        markResultClean();
        const btn = document.getElementById('shareXBtn') as HTMLButtonElement | null;
        expect(btn?.disabled).toBe(false);
    });
});
