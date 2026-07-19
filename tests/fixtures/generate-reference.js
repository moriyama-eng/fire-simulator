// Execute in browser DevTools console
// * To set the number of paths to 1000, temporarily change the min attribute of simPathsNum, or
//   enter document.getElementById('simPathsNum').value = '1000' in DevTools.
(function generateReference() {
    if (typeof lastSimResult === 'undefined') {
        console.error('❌ lastSimResult is not defined. Please run the simulation first.');
        return;
    }
    const ref = {
        _comment: 'v1.8.3 reference data. seed=123456, paths=1000, other default values',
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
    console.log('✅ Reference data:\n' + jsonStr);
    copy(jsonStr);
    console.log('\n📝 Save to tests/fixtures/reference-results.json and verify with:');
    console.log('node --input-type=commonjs -e "JSON.parse(require(\'fs\').readFileSync(\'tests/fixtures/reference-results.json\',\'utf-8\')); console.log(\'OK\')"');
})();