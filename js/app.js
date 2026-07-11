// ====================================================================
// js/app.js
// エントリポイント：全モジュールをインポートし、必要なものを再エクスポート
// 元の DOMContentLoaded リスナーは init.js に完全移行済み
// ====================================================================

import './app/init.js';  // DOMContentLoaded の全処理を実行

// テスト用に buildCdfPoints を再エクスポート（tests/unit/chart-helpers.test.js が参照）
export { buildCdfPoints } from './app/charts.js';
