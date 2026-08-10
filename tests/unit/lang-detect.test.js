// ====================================================================
// tests/unit/lang-detect.test.js
// Unit tests for resolveInitialLang() pure function (js/lang-detect.js)
// and boot vs pure consistency verification
// ====================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolveInitialLang } from '../../js/lang-detect.js';

// Extract the boot inline script directly from index.html (no duplicate logic in tests)
const html = readFileSync('index.html', 'utf-8');
const scriptMatch = html.match(/<!-- Boot-time language resolution [\s\S]*?<script>([\s\S]*?)<\/script>/);
const bootScriptCode = scriptMatch ? scriptMatch[1] : '';

function runBootInlineScript() {
    new Function(bootScriptCode)();
    return globalThis.__currentLang;
}

// Prevent globalThis.__currentLang from leaking between tests
beforeEach(() => {
    delete globalThis.__currentLang;
    try { localStorage.removeItem('lang'); } catch (e) {}
});

describe('resolveInitialLang - URL ?lang= parameter (highest priority)', () => {
    it('returns en when ?lang=en is present (overrides stored ja)', () => {
        expect(resolveInitialLang('?lang=en', '', 'ja')).toBe('en');
    });

    it('returns ja when ?lang=ja is present (overrides stored en)', () => {
        expect(resolveInitialLang('?lang=ja', '', 'en')).toBe('ja');
    });

    it('ignores ?lang=en-US (partial match is invalid)', () => {
        // Falls through to storedLang
        expect(resolveInitialLang('?lang=en-US', '', 'ja')).toBe('ja');
    });

    it('ignores empty ?lang= value', () => {
        expect(resolveInitialLang('?lang=', '', 'en')).toBe('en');
    });

    it('ignores duplicate ?lang= parameters (en&lang=ja)', () => {
        // Both are invalid when count > 1; falls through to storedLang
        expect(resolveInitialLang('?lang=en&lang=ja', '', 'ja')).toBe('ja');
    });

    it('accepts ?lang=EN (case-insensitive)', () => {
        // String(v).toLowerCase() converts 'EN' -> 'en', so this IS valid
        expect(resolveInitialLang('?lang=EN', '', 'ja')).toBe('en');
    });

    it('ignores unknown lang value (e.g. ?lang=fr)', () => {
        // Falls through to storedLang
        expect(resolveInitialLang('?lang=fr', '', 'en')).toBe('en');
    });
});

describe('resolveInitialLang - localStorage (second priority)', () => {
    it('returns en when storedLang is en and no URL lang', () => {
        expect(resolveInitialLang('', '', 'en')).toBe('en');
    });

    it('returns ja when storedLang is ja and no URL lang', () => {
        expect(resolveInitialLang('', '', 'ja')).toBe('ja');
    });

    it('ignores invalid stored values (falls to navigator)', () => {
        // storedLang='fr' is invalid; falls through to navigator
        expect(resolveInitialLang('', 'ja-JP', 'fr')).toBe('ja');
    });
});

describe('resolveInitialLang - navigator normalized string (third priority)', () => {
    it('returns ja when navigator normalized string is ja-JP', () => {
        expect(resolveInitialLang('', 'ja-JP', null)).toBe('ja');
    });

    it('returns ja when navigator normalized string is ja', () => {
        expect(resolveInitialLang('', 'ja', null)).toBe('ja');
    });

    it('returns en when navigator normalized string is en-US', () => {
        expect(resolveInitialLang('', 'en-US', null)).toBe('en');
    });

    it('returns en when navigator normalized string is fr-FR (non-ja defaults to en)', () => {
        expect(resolveInitialLang('', 'fr-FR', null)).toBe('en');
    });

    it('returns en when navigator normalized string is zh-CN', () => {
        expect(resolveInitialLang('', 'zh-CN', null)).toBe('en');
    });
});

describe('resolveInitialLang - fallback behavior', () => {
    it('falls back to ja when all sources are empty/null', () => {
        expect(resolveInitialLang('', '', null)).toBe('ja');
    });

    it('falls back to ja when localStorage threw (storedLang=null) and no navigator', () => {
        // Simulates localStorage exception scenario: storedLang passed as null
        expect(resolveInitialLang('', '', null)).toBe('ja');
    });
});

// ===== Boot inline vs Pure resolveInitialLang Consistency Verification =====
describe('Boot inline vs Pure resolveInitialLang consistency (KEEP-IN-SYNC)', () => {
    const origLocation = window.location;
    const origNavLangs = navigator.languages;
    const origNavLang = navigator.language;

    function testCase(description, { search = '', stored = null, navLangs = [], navLang = '' }) {
        it(description, () => {
            // Setup DOM/Environment for boot inline script
            delete globalThis.__currentLang;
            if (stored !== null) {
                try { localStorage.setItem('lang', stored); } catch (e) {}
            } else {
                try { localStorage.removeItem('lang'); } catch (e) {}
            }

            delete window.location;
            window.location = new URL(`http://localhost/${search}`);

            Object.defineProperty(navigator, 'languages', { value: navLangs, configurable: true });
            Object.defineProperty(navigator, 'language', { value: navLang, configurable: true });

            // 1. Run actual boot script extracted from index.html
            const bootResult = runBootInlineScript();

            // 2. Normalize navigator string (caller side responsibility)
            const normalizedNavLang = (navLangs && navLangs.length > 0)
                ? navLangs[0]
                : (navLang || '');

            // 3. Run pure function
            const pureResult = resolveInitialLang(search, normalizedNavLang, stored);

            // Assert exact match between boot inline script and pure function
            expect(bootResult).toBe(pureResult);

            // Cleanup location
            window.location = origLocation;
        });
    }

    testCase('Case 1: navigator.languages=["ja-JP"]', {
        search: '', stored: null, navLangs: ['ja-JP'], navLang: 'ja-JP'
    });

    testCase('Case 2: navigator.languages=["en-US"]', {
        search: '', stored: null, navLangs: ['en-US'], navLang: 'en-US'
    });

    testCase('Case 3: navigator.languages=["fr-FR"]', {
        search: '', stored: null, navLangs: ['fr-FR'], navLang: 'fr-FR'
    });

    testCase('Case 4 (Fixed discrepancy case): navigator.languages=[], navigator.language="en-US"', {
        search: '', stored: null, navLangs: [], navLang: 'en-US'
    });

    testCase('Case 5: navigator.languages=[], navigator.language=undefined', {
        search: '', stored: null, navLangs: [], navLang: undefined
    });

    testCase('Case 6: ?lang=en URL overrides stored ja and navigator ja-JP', {
        search: '?lang=en', stored: 'ja', navLangs: ['ja-JP'], navLang: 'ja-JP'
    });
});

