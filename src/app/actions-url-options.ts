/**
 * Helper functions to construct options objects for buildSimulationUrl.
 */

export interface UrlOptionsDynamic {
  seed?: number;
  percentileRaw?: string;
  lang?: string;
}

export interface SimulationUrlOptions {
  autoRun: boolean;
  fixedSeed: boolean;
  seed?: number;
  percentileRaw?: string;
  lang?: string;
  baseUrl?: string;
}

export function getCopyUrlOptions(dyn: UrlOptionsDynamic = {}): SimulationUrlOptions {
  return {
    autoRun: true,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    lang: dyn.lang
  };
}

export function getShareUrlOptions(dyn: UrlOptionsDynamic = {}): SimulationUrlOptions {
  return {
    autoRun: true,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    baseUrl: 'https://moriyama-eng.github.io/fire-simulator/',
    lang: dyn.lang
  };
}

export function getCompareUrlOptions(dyn: UrlOptionsDynamic = {}): SimulationUrlOptions {
  return {
    autoRun: false,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    lang: dyn.lang
  };
}
