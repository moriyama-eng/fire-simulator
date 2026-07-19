// ====================================================================
// js/app/state.js
// Global state variable management module
// Does not import any other module (prevents circular imports)
// ====================================================================

let assetChart = null;
let cashChart = null;
let ddHistChart = null;
let uwHistChart = null;
let belowInitChart = null;  // v2.3.0: Chart for the consecutive period below initial total assets
let sellChart = null;       // v2.3.0: Chart for the consecutive risk asset sell period
let lastSimResult = null;
let isRunning = false;
let isResultDirty = false;  // Flag indicating un-executed state after input change
let lastExecutedParams = null;      // Parameters of the last successful execution
let lastMainExecutionMs = null;     // Execution time in milliseconds
window.lastMainExecutionMs = null;

// Getters
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

// Setters
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
    // Sync because analysis-runner.js references window.lastMainExecutionMs
    window.lastMainExecutionMs = val;
}
