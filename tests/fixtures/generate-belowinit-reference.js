// tests/fixtures/generate-belowinit-reference.js
// Script executed in browser console to retrieve values for reference-belowinit-results.json
(function generateBelowInitReference() {
    if (typeof lastSimResult === 'undefined') {
        console.error('❌ lastSimResult is not defined. Please run the simulation first.');
        return;
    }
    // Check existence of new metric data
    if (!lastSimResult.belowInitPeriods || !lastSimResult.consecutiveSellPeriods) {
        console.error('❌ New metrics data not found in lastSimResult. Please run with v2.3.0 code.');
        return;
    }
    const ref = {
        _comment: 'v2.3.0 reference data (for new metrics). seed=123456, paths=1000, other default values',
        belowInitMaxPeriods: Math.max(...lastSimResult.belowInitPeriods),
        consecutiveSellMaxPeriods: Math.max(...lastSimResult.consecutiveSellPeriods),
    };
    console.log('✅ Reference data:\n' + JSON.stringify(ref, null, 2));
    if (typeof copy !== 'undefined') {
        copy(JSON.stringify(ref, null, 2));
        console.log('\n📝 Copied to clipboard. Please save to tests/fixtures/reference-belowinit-results.json.');
    } else {
        console.log('\n📝 Please save the JSON above to tests/fixtures/reference-belowinit-results.json.');
    }
})();
