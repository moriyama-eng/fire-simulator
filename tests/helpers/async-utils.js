// tests/helpers/async-utils.js

/**
 * A simple polling helper for waiting for asynchronous state changes.
 * Used instead of vi.waitFor, which does not exist in Vitest 1.6.0.
 *
 * @param {Function} callback - A function that performs an assertion or condition check. Resolves normally if the condition is met; throws an exception if not.
 * @param {Object} [options]
 * @param {number} [options.timeout=3000] - Maximum wait time (ms). 3 seconds is sufficient for ordinary UI tests; increase at the call site for long-running processes.
 * @param {number} [options.interval=100] - Polling interval (ms)
 * @param {string} [options.message] - Custom description to display on timeout
 */
export async function waitFor(callback, { timeout = 3000, interval = 100, message } = {}) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      callback();
      return; // success
    } catch (e) {
      lastError = e;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  const contextMsg = message ? `(${message}) ` : '';
  if (lastError) {
    throw new Error(
      `waitFor timed out after ${timeout}ms ${contextMsg}. Last error: ${lastError.message}`
    );
  }
  throw new Error(
    `waitFor timed out after ${timeout}ms ${contextMsg}. (condition never threw but was not met)`
  );
}
