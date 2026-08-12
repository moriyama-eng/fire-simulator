/**
 * Helper functions to construct options objects for buildSimulationUrl.
 */

export function getCopyUrlOptions(dyn = {}) {
  return {
    autoRun: true,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    lang: dyn.lang
  };
}

export function getShareUrlOptions(dyn = {}) {
  return {
    autoRun: true,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    baseUrl: 'https://moriyama-eng.github.io/fire-simulator/',
    lang: dyn.lang
  };
}

export function getCompareUrlOptions(dyn = {}) {
  return {
    autoRun: false,
    fixedSeed: true,
    seed: dyn.seed,
    percentileRaw: dyn.percentileRaw,
    lang: dyn.lang
  };
}
