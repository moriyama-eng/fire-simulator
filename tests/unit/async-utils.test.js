import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '../helpers/async-utils.js';

describe('async-utils waitFor', () => {
  it('resolves when condition passes via vi.waitFor', async () => {
    let count = 0;
    setTimeout(() => { count = 5; }, 20);
    await expect(waitFor(() => {
      expect(count).toBe(5);
    }, { timeout: 1000, interval: 10 })).resolves.toBeUndefined();
  });

  it('throws with diagnostic message on timeout via vi.waitFor', async () => {
    await expect(waitFor(() => {
      expect(1).toBe(2);
    }, { timeout: 50, interval: 10, message: 'checking one equals two' }))
      .rejects.toThrow(/waitFor timed out after 50ms \(checking one equals two\) \. Last error:/);
  });

  it('throws without message on timeout via vi.waitFor', async () => {
    await expect(waitFor(() => {
      expect(1).toBe(2);
    }, { timeout: 50, interval: 10 }))
      .rejects.toThrow(/waitFor timed out after 50ms \. Last error:/);
  });

  describe('fallback loop when vi.waitFor is unavailable', () => {
    const originalWaitFor = vi.waitFor;

    beforeEach(() => {
      vi.waitFor = undefined;
    });

    afterEach(() => {
      vi.waitFor = originalWaitFor;
    });

    it('resolves in fallback loop when condition passes', async () => {
      let passed = false;
      setTimeout(() => { passed = true; }, 20);
      await expect(waitFor(async () => {
        if (!passed) throw new Error('not yet');
      }, { timeout: 1000, interval: 10 })).resolves.toBeUndefined();
    });

    it('throws with diagnostic message in fallback loop on timeout', async () => {
      await expect(waitFor(() => {
        throw new Error('fallback failure');
      }, { timeout: 50, interval: 10, message: 'fallback check' }))
        .rejects.toThrow(/waitFor timed out after 50ms \(fallback check\) \. Last error: fallback failure/);
    });

    it('throws without message in fallback loop on timeout with error', async () => {
      await expect(waitFor(() => {
        throw new Error('raw error');
      }, { timeout: 50, interval: 10 }))
        .rejects.toThrow(/waitFor timed out after 50ms \. Last error: raw error/);
    });

    it('throws default timeout message when lastError has no message', async () => {
      await expect(waitFor(() => {
        // eslint-disable-next-line no-throw-literal
        throw null;
      }, { timeout: 50, interval: 10 }))
        .rejects.toThrow(/waitFor timed out after 50ms \. Last error: timeout/);
    });
  });
});
