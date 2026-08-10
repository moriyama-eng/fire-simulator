// ====================================================================
// js/lang-detect.js
// ====================================================================
//
// Pure function for resolving the initial display language.
// KEEP-IN-SYNC: The logic here must match the boot inline script in index.html.
// When modifying either, update BOTH files.
//
// Priority order (highest to lowest):
//   1. URL ?lang=  (exact 'ja' or 'en', single occurrence only)
//   2. localStorage.getItem('lang')  (passed in as storedLang argument)
//   3. Normalized navigator language tag string (e.g. 'ja-JP', 'en-US')
//   4. 'ja' (fallback)
//
// This function is a pure function: all external inputs are passed as arguments.
// No DOM access, no localStorage access, no side effects inside this function.
// Side effects (setting globalThis.__currentLang, document.documentElement.lang,
// localStorage.setItem) are the caller's responsibility.
// ====================================================================

/**
 * Resolves the initial display language from available sources.
 *
 * @param {string} search - The raw query string (e.g. location.search).
 * @param {string} navLang - Normalized navigator language string (e.g. navigator.languages[0] || navigator.language || '').
 * @param {string | null} storedLang - The stored language from localStorage, or null if unavailable.
 * @returns {'ja' | 'en'} The resolved language.
 */
export function resolveInitialLang(search, navLang, storedLang) {
    // --- 1. URL ?lang= parameter (highest priority) ---
    const params = new URLSearchParams(search);
    const langValues = params.getAll('lang');
    if (langValues.length === 1) {
        const urlLang = String(langValues[0]).toLowerCase();
        if (urlLang === 'ja' || urlLang === 'en') {
            return urlLang;
        }
    }
    // If lang appears multiple times, or has invalid value, fall through.

    // --- 2. localStorage stored value ---
    if (storedLang === 'ja' || storedLang === 'en') {
        return storedLang;
    }

    // --- 3. navigator language tag (normalized string) ---
    // Note: Languages resolved via navigator are NOT persisted to localStorage (by design).
    if (/^ja\b/i.test(navLang)) {
        return 'ja';
    }
    if (navLang) {
        // Any non-empty, non-Japanese navigator language defaults to English
        return 'en';
    }

    // --- 4. Final fallback ---
    return 'ja';
}
