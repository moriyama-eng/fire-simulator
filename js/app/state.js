// ====================================================================
// js/app/state.js
// グローバル状態変数の管理モジュール
// 他のどのモジュールもインポートしない（循環インポート防止）
// ====================================================================

let assetChart = null;
let cashChart = null;
let ddHistChart = null;
let uwHistChart = null;
let belowInitChart = null;  // v2.3.0: 初期総資産割れ継続期間グラフ
let sellChart = null;       // v2.3.0: リスク資産連続売却期間グラフ
let lastSimResult = null;
let isRunning = false;
let isResultDirty = false;  // 入力変更後未実行状態フラグ
let lastExecutedParams = null;      // 最後に成功した実行パラメータ
let lastMainExecutionMs = null;     // 実行時間ミリ秒
window.lastMainExecutionMs = null;

// ゲッター
export function getAssetChart() { return assetChart; }
export function getCashChart() { return cashChart; }
export function getDdHistChart() { return ddHistChart; }
export function getUwHistChart() { return uwHistChart; }
export function getBelowInitChart() { return belowInitChart; }
export function getSellChart() { return sellChart; }
export function getLastSimResult() { return lastSimResult; }
export function getIsRunning() { return isRunning; }
export function getIsResultDirty() { return isResultDirty; }
export function getLastExecutedParams() { return lastExecutedParams; }
export function getLastMainExecutionMs() { return lastMainExecutionMs; }

// セッター
export function setAssetChart(val) { assetChart = val; }
export function setCashChart(val) { cashChart = val; }
export function setDdHistChart(val) { ddHistChart = val; }
export function setUwHistChart(val) { uwHistChart = val; }
export function setBelowInitChart(val) { belowInitChart = val; }
export function setSellChart(val) { sellChart = val; }
export function setLastSimResult(val) { lastSimResult = val; }
export function setIsRunning(val) { isRunning = val; }
export function setIsResultDirty(val) { isResultDirty = val; }
export function setLastExecutedParams(val) { lastExecutedParams = val; }
export function setLastMainExecutionMs(val) {
    lastMainExecutionMs = val;
    // analysis-runner.js が window.lastMainExecutionMs を参照するため同期する
    window.lastMainExecutionMs = val;
}
