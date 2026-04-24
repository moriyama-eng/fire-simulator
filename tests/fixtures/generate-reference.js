// ブラウザ DevTools コンソールで実行
// ※ パス数などを 1000 に設定するには、一時的に simPathsNum の min 属性を変更するか、
//    DevTools で document.getElementById('simPathsNum').value = '1000' と入力する。
(function generateReference() {
    if (typeof lastSimResult === 'undefined') {
        console.error('❌ lastSimResult がありません。先にシミュレーションを実行してください。');
        return;
    }
    const ref = {
        _comment: 'v1.8.3 参照データ。seed=123456, paths=1000, 他デフォルト値',
        successRate: lastSimResult.successRate,
        finalMedian: lastSimResult.finalMedian,
        worst10MaxDd: lastSimResult.worst10MaxDd,
        worst5MaxDd: lastSimResult.worst5MaxDd,
        medianMaxUw: lastSimResult.medianMaxUw,
        worst10MaxUw: lastSimResult.worst10MaxUw,
        percentileFinalValues: lastSimResult.percentiles.reduce((acc, pct, i) => {
            const lastIdx = lastSimResult.totalPercentileData[i].length - 1; 
            acc[String(pct)] = lastSimResult.totalPercentileData[i][lastIdx];
            return acc;
        }, {}),
        seed: lastSimResult.usedSeed,
        modelType: lastSimResult.modelType,
        usedDf: lastSimResult.usedDf
    };
    const jsonStr = JSON.stringify(ref, null, 2);
    console.log('✅ 参照データ:\n' + jsonStr);
    copy(jsonStr);
    console.log('\n📝 tests/fixtures/reference-results.json に保存し、以下で検証:');
    console.log('node --input-type=commonjs -e "JSON.parse(require(\'fs\').readFileSync(\'tests/fixtures/reference-results.json\',\'utf-8\')); console.log(\'OK\')"');
})();