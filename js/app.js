// ====================================================================
// js/app.js
// Entry point: imports all modules and re-exports necessary ones
// The original DOMContentLoaded listener has been fully migrated to init.js
// ====================================================================

import './app/init.js';  // Executes all DOMContentLoaded processing

// Re-export buildCdfPoints for tests (referenced by tests/unit/chart-helpers.test.js)
export { buildCdfPoints } from './app/charts.js';
