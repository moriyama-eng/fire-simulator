import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom: DOM APIを必要とするテスト（UI状態、URLパラメータ）に対応
    environment: 'jsdom',
    // tests/ ディレクトリ以下の .test.js ファイルを自動検出
    include: ['tests/**/*.test.js'],
    // CI環境でのflakyテスト対策（ネットワーク不安定・高負荷時を考慮）
    retry: 2,
    coverage: {
      provider: 'v8',
      // カバレッジ対象: js/core/ 以下の純粋ロジックモジュール
      // UI層（analysis-ui.js, app.js）はDOMに強く依存するため除外
      // analysis-state.js と analysis-runner.js は分析タブのコアロジックであり単体テストが存在するためカバレッジ対象に追加
      include: ['js/core/**/*.js', 'js/analysis-state.js', 'js/analysis-runner.js']
    }
  }
});
