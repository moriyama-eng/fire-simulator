// ====================================================================
// src/app.ts
// Entry point: imports all modules and re-exports necessary ones
// The original DOMContentLoaded listener has been fully migrated to init.ts
// ====================================================================

import './app/init.js';

// Re-export buildCdfPoints for tests (referenced by tests/unit/chart-helpers.test.ts)
export { buildCdfPoints } from './app/charts.js';
