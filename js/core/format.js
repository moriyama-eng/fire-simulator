// ====================================================================
// js/core/format.js
// ====================================================================

export function formatPercentileInput(rawInput) {
    const parsed = rawInput.split(',').map(s => Number(s.trim()))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 99);
    const unique = [...new Set(parsed)].sort((a, b) => a - b).slice(0, 5);
    const result = unique.length > 0 ? unique : [10, 30, 50, 70, 90];
    return result.join(', ');
}

export function parsePercentiles(rawInput) {
    const formatted = formatPercentileInput(rawInput);
    return formatted.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
}