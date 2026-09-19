import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    retry: 2,
    // Simplify symbols in output to avoid mojibake in Windows console
    reporters: ['default'],
    outputFile: {
      json: './coverage/test-results.json'
    },
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: [
        'js/core/**/*.js',
        'js/analysis-state.js',
        'js/analysis-runner.js',
        'js/comparison-state.js',
        'js/comparison-runner.js',
        'tests/helpers/stub-worker.js',
        'tests/helpers/async-utils.js'
      ],
      // Explicitly override default exclude so tests/helpers/** is tracked
      exclude: [
        'node_modules/**',
        'coverage/**',
        'tests/unit/**',
        'tests/integration/**',
        'tests/fixtures/**',
        'tests/setup.js'
      ],
      thresholds: {
        statements: 99.0,
        branches: 88.0,
        functions: 97.0,
        lines: 99.0
      }
    }
  }
});
