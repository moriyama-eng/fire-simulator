// tests/helpers/async-utils.js
import { vi } from 'vitest';

/**
 * A simple polling helper for waiting for asynchronous state changes.
 * Prioritizes delegation to vi.waitFor when available, while preserving
 * diagnostic message formatting and providing a fallback loop.
 *
 * @param {Function} callback - A function that performs an assertion or condition check. Resolves normally if the condition is met; throws an exception if not.
 * @param {Object} [options]
 * @param {number} [options.timeout=3000] - Maximum wait time (ms).
 * @param {number} [options.interval=100] - Polling interval (ms)
 * @param {string} [options.message] - Custom description to display on timeout
 */
export async function waitFor(callback, { timeout = 3000, interval = 100, message } = {}) {
  if (typeof vi.waitFor === 'function') {
    try {
      return await vi.waitFor(callback, { timeout, interval });
    } catch (err) {
      const contextMsg = message ? `(${message}) ` : '';
      throw new Error(`waitFor timed out after ${timeout}ms ${contextMsg}. Last error: ${err.message}`);
    }
  }

  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      await callback();
      return;
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  const contextMsg = message ? `(${message}) ` : '';
  throw new Error(`waitFor timed out after ${timeout}ms ${contextMsg}. Last error: ${lastError?.message || 'timeout'}`);
}
