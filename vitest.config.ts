import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    retry: 2,
    // Simplify symbols in output to avoid mojibake in Windows console
    reporters: ['default'],
    outputFile: {
      json: './coverage/test-results.json'
    },
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/core/**/*.ts',
        'src/analysis-state.ts',
        'src/analysis-runner.ts',
        'src/comparison-state.ts',
        'src/comparison-runner.ts',
        'tests/helpers/stub-worker.ts',
        'tests/helpers/async-utils.ts'
      ],
      // Explicitly override default exclude so tests/helpers/** is tracked
      exclude: [
        'node_modules/**',
        'coverage/**',
        'tests/unit/**',
        'tests/integration/**',
        'tests/fixtures/**',
        'tests/setup.ts'
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
