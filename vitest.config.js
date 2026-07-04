import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    retry: 2,
    // 出力時の記号表示を簡素化し、Windowsコンソールの文字化けを回避する
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
        'js/comparison-runner.js'
      ]
    }
  }
});
