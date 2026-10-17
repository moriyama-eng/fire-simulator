// src/types/global.d.ts
import type { SimulationParams } from './params.js';
import type { AggregatedMetrics, BatchResult } from './simulation.js';

// ---- Ambient Declarations for External CDN Libraries (Zero any) ----

export interface ChartDataset {
  label?: string;
  data: number[] | Float32Array | unknown[];
  borderColor?: string | string[];
  backgroundColor?: string | string[];
  fill?: boolean | string;
  borderWidth?: number;
  borderDash?: number[];
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  yAxisID?: string;
  xAxisID?: string;
  order?: number;
}

export interface ChartData {
  labels?: (string | number)[];
  datasets: ChartDataset[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  animation?: boolean | Record<string, unknown>;
  plugins?: Record<string, unknown>;
  scales?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
  onClick?: (event: unknown, elements: unknown[], chart: ChartInstance) => void;
}

export interface ChartConfiguration {
  type: string;
  data: ChartData;
  options?: ChartOptions;
  plugins?: unknown[];
}

export interface ChartInstance {
  destroy(): void;
  update(mode?: string): void;
  resize(): void;
  data: ChartData;
  options: ChartOptions;
  toBase64Image(type?: string, quality?: number): string;
  setDatasetVisibility?(index: number, visible: boolean): void;
}

export interface ChartConstructor {
  new (ctx: CanvasRenderingContext2D | HTMLCanvasElement, config: ChartConfiguration): ChartInstance;
  register(...components: unknown[]): void;
  Tooltip?: {
    positioners?: Record<string, unknown>;
  };
}

export interface SortableOptions {
  animation?: number;
  handle?: string;
  draggable?: string;
  ghostClass?: string;
  chosenClass?: string;
  dragClass?: string;
  onEnd?: (event: { oldIndex?: number; newIndex?: number; item: HTMLElement }) => void;
  [key: string]: unknown;
}

export interface SortableInstance {
  destroy(): void;
  option<K extends keyof SortableOptions>(name: K): SortableOptions[K];
  option<K extends keyof SortableOptions>(name: K, value: SortableOptions[K]): void;
  toArray(): string[];
  sort(order: string[]): void;
}

export interface SortableConstructor {
  create(el: HTMLElement, options?: SortableOptions): SortableInstance;
}

export interface HTML2CanvasOptions {
  backgroundColor?: string | null;
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  logging?: boolean;
  width?: number;
  height?: number;
  windowWidth?: number;
  windowHeight?: number;
  x?: number;
  y?: number;
  scrollX?: number;
  scrollY?: number;
  [key: string]: unknown;
}

export type HTML2CanvasFunction = (element: HTMLElement, options?: HTML2CanvasOptions) => Promise<HTMLCanvasElement>;

// ---- Window & Global Augmentations ----

declare global {
  interface Window {
    __currentLang?: string;
    lastMainExecutionMs?: number;
    lastSimOnlyMs?: number;
    __setLanguage?: (lang: string) => void;
    __getLanguage?: () => string;
    Chart?: ChartConstructor;
    Sortable?: SortableConstructor;
    html2canvas?: HTML2CanvasFunction;
  }
  var __currentLang: string | undefined;
  var lastMainExecutionMs: number | undefined;
  var lastSimOnlyMs: number | undefined;
  var Chart: ChartConstructor | undefined;
  var Sortable: SortableConstructor | undefined;
  var html2canvas: HTML2CanvasFunction | undefined;
}

// ---- Ambient Declarations for Transitionally Referenced Modules ----

declare module '*/i18n.js' {
  export function getLanguage(): string;
  export function setLanguage(lang: string): void;
  export function getSupportedLanguages(): string[];
  export function t(key: string, placeholders?: unknown[] | Record<string, string | number>): string;
  export function formatCurrency(v: number, unit?: string): string;
  export function formatPercent(v: number): string;
  export function formatDate(d: Date): string;
  export function formatNumber(v: number): string;
  export function formatYears(v: number): string;
  export const TRANSLATIONS: Record<string, Record<string, string>>;
}

declare module '*/worker.js' {
  export function runWorkerBatch(
    params: SimulationParams,
    pathsCount: number,
    seedOffset: number,
    dataLen: number,
    onProgress?: (completed: number) => void
  ): BatchResult;
}

declare module '*/headless.js' {
  export function runSimulationHeadless(
    params: SimulationParams,
    percentiles?: number[],
    numWorkers?: number
  ): AggregatedMetrics;
}

declare module '*/params-accessor.js' {
  export function getCurrentSimParams(): SimulationParams;
}

