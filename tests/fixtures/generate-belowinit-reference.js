// tests/fixtures/generate-belowinit-reference.js
// ブラウザのコンソールで実行して reference-belowinit-results.json の値を取得するスクリプト
(function generateBelowInitReference() {
    if (typeof lastSimResult === 'undefined') {
        console.error('❌ lastSimResult がありません。先にシミュレーションを実行してください。');
        return;
    }
    // 新指標データの存在チェック
    if (!lastSimResult.belowInitPeriods || !lastSimResult.consecutiveSellPeriods) {
        console.error('❌ 新指標データが lastSimResult に含まれていません。v2.3.0 のコードで実行してください。');
        return;
    }
    const ref = {
        _comment: 'v2.3.0 参照データ（新指標用）。seed=123456, paths=1000, 他デフォルト値',
        belowInitMaxPeriods: Math.max(...lastSimResult.belowInitPeriods),
        consecutiveSellMaxPeriods: Math.max(...lastSimResult.consecutiveSellPeriods),
    };
    console.log('✅ 参照データ:\n' + JSON.stringify(ref, null, 2));
    if (typeof copy !== 'undefined') {
        copy(JSON.stringify(ref, null, 2));
        console.log('\n📝 クリップボードにコピーしました。tests/fixtures/reference-belowinit-results.json に保存してください。');
    } else {
        console.log('\n📝 上記の JSON を tests/fixtures/reference-belowinit-results.json に保存してください。');
    }
})();
