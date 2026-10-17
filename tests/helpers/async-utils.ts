// tests/helpers/async-utils.ts
import { vi } from 'vitest';

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

/**
 * A simple polling helper for waiting for asynchronous state changes.
 * Prioritizes delegation to vi.waitFor when available, while preserving
 * diagnostic message formatting and providing a fallback loop.
 */
export async function waitFor(
  callback: () => void | Promise<void>,
  { timeout = 3000, interval = 100, message }: WaitForOptions = {}
): Promise<void> {
  if (typeof vi.waitFor === 'function') {
    try {
      return await vi.waitFor(callback, { timeout, interval });
    } catch (err: unknown) {
      const contextMsg = message ? `(${message}) ` : '';
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`waitFor timed out after ${timeout}ms ${contextMsg}. Last error: ${errMsg}`);
    }
  }

  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeout) {
    try {
      await callback();
      return;
    } catch (e: unknown) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  const contextMsg = message ? `(${message}) ` : '';
  const lastMsg = (typeof lastError === 'object' && lastError !== null && 'message' in lastError && typeof (lastError as { message: unknown }).message === 'string')
    ? (lastError as { message: string }).message
    : 'timeout';
  throw new Error(`waitFor timed out after ${timeout}ms ${contextMsg}. Last error: ${lastMsg}`);
}
