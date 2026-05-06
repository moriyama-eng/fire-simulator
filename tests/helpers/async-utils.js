// tests/helpers/async-utils.js

/**
 * 非同期の状態変化を待つ簡易ポーリングヘルパー。
 * Vitest 1.6.0 には vi.waitFor が存在しないため、本関数を代わりに使用する。
 *
 * @param {Function} callback - アサーションまたは条件チェックを行う関数。条件を満たせば正常終了、満たさなければ例外をスローする
 * @param {Object} [options]
 * @param {number} [options.timeout=3000] - 最大待機時間(ms)。通常のUIテストでは3秒で十分だが、長時間処理の場合は呼び出し側で延長する
 * @param {number} [options.interval=100] - ポーリング間隔(ms)
 * @param {string} [options.message] - タイムアウト時に表示するカスタム説明文
 */
export async function waitFor(callback, { timeout = 3000, interval = 100, message } = {}) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      callback();
      return; // 成功
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
