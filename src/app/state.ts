// ====================================================================
// src/app/state.ts
// Global state variable management module
// Does not import any other module (prevents circular imports)
// ====================================================================

import type { ChartInstance } from '../types/global.js';
import type { AggregatedMetrics } from '../types/simulation.js';
import type { SimulationParams } from '../types/params.js';

let assetChart: ChartInstance | null = null;
let cashChart: ChartInstance | null = null;
let ddHistChart: ChartInstance | null = null;
let uwHistChart: ChartInstance | null = null;
let belowInitChart: ChartInstance | null = null;  // Chart for the consecutive period below initial total assets
let sellChart: ChartInstance | null = null;       // Chart for the consecutive risk asset sell period
let lastSimResult: AggregatedMetrics | null = null;
let isRunning = false;
let isResultDirty = false;  // Flag indicating un-executed state after input change
let lastExecutedParams: SimulationParams | null = null;      // Parameters of the last successful execution

// Getters
export function getAssetChart(): ChartInstance | null { return assetChart; }
export function getCashChart(): ChartInstance | null { return cashChart; }
export function getDdHistChart(): ChartInstance | null { return ddHistChart; }
export function getUwHistChart(): ChartInstance | null { return uwHistChart; }
export function getBelowInitChart(): ChartInstance | null { return belowInitChart; }
export function getSellChart(): ChartInstance | null { return sellChart; }
export function getLastSimResult(): AggregatedMetrics | null { return lastSimResult; }
export function getIsRunning(): boolean { return isRunning; }
export function getIsResultDirty(): boolean { return isResultDirty; }
export function getLastExecutedParams(): SimulationParams | null { return lastExecutedParams; }

// Setters
export function setAssetChart(val: ChartInstance | null): void { assetChart = val; }
export function setCashChart(val: ChartInstance | null): void { cashChart = val; }
export function setDdHistChart(val: ChartInstance | null): void { ddHistChart = val; }
export function setUwHistChart(val: ChartInstance | null): void { uwHistChart = val; }
export function setBelowInitChart(val: ChartInstance | null): void { belowInitChart = val; }
export function setSellChart(val: ChartInstance | null): void { sellChart = val; }
export function setLastSimResult(val: AggregatedMetrics | null): void { lastSimResult = val; }
export function setIsRunning(val: boolean): void { isRunning = val; }
export function setIsResultDirty(val: boolean): void { isResultDirty = val; }
export function setLastExecutedParams(val: SimulationParams | null): void { lastExecutedParams = val; }
