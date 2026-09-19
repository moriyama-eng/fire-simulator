// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { TRANSLATIONS, t, formatCurrency, formatPercent, formatYears, setLanguage } from '../../js/i18n.js';

beforeAll(() => {
  setLanguage('ja');
});

beforeEach(() => {
  setLanguage('ja');
});

describe('i18n module', () => {
  it('should translate keys correctly', () => {
    expect(t('header.title')).toMatch(/^FIRE モンテカルロ・シミュレータ/);
  });

  it('should replace placeholders', () => {
    expect(t('summary.cb.triggerValue', [20])).toBe('ドローダウン 20%');
  });

  it('should format currency correctly', () => {
    expect(formatCurrency(100000000, '億円')).toBe('1.0億円');
    expect(formatCurrency(10000, '万円')).toBe('1万円');
  });

  it('should format currency correctly in English mode', () => {
    setLanguage('en');
    expect(formatCurrency(0, '円')).toBe('$0');
    expect(formatCurrency(49, '円')).toBe('$0');
    expect(formatCurrency(50, '円')).toBe('$1');
    expect(formatCurrency(1234, '円')).toBe('$12');
    expect(formatCurrency(123456, '円')).toBe('$1.2K');
    expect(formatCurrency(12345678, '円')).toBe('$123.5K');
    expect(formatCurrency(1234567890, '円')).toBe('$12.3M');
    expect(formatCurrency(-123456, '円')).toBe('-$1.2K');
  });

  it('should format percentages correctly', () => {
    expect(formatPercent(0.05)).toBe('5.0%');
  });

  it('should format years correctly', () => {
    expect(formatYears(30)).toBe('30年');
  });

  describe('Translation key consistency', () => {
    it('should have no missing keys in English translation', () => {
      const jaKeys = Object.keys(TRANSLATIONS.ja);
      const enKeys = Object.keys(TRANSLATIONS.en);
      const missing = jaKeys.filter(key => !enKeys.includes(key));
      expect(missing).toEqual([]);
    });

    it('should have no extra keys in English translation', () => {
      const jaKeys = Object.keys(TRANSLATIONS.ja);
      const enKeys = Object.keys(TRANSLATIONS.en);
      const extra = enKeys.filter(key => !jaKeys.includes(key));
      expect(extra).toEqual([]);
    });

    it('should have non-empty string values for all English translations', () => {
      const emptyKeys = Object.entries(TRANSLATIONS.en)
        .filter(([key, value]) => typeof value !== 'string' || value.trim() === '')
        .map(([key]) => key);
      expect(emptyKeys).toEqual([]);
    });
  });

  describe('Version interpolation and fallback', () => {
    let originalHeadHTML = '';

    beforeEach(() => {
      originalHeadHTML = document.head.innerHTML;
    });

    afterEach(() => {
      document.head.innerHTML = originalHeadHTML;
      vi.resetModules();
    });

    it('should use fallback literal when meta tag is absent and match package.json version', async () => {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));

      // Ensure no meta tag is present in document.head
      const existingMeta = document.querySelector('meta[name="app-version"]');
      if (existingMeta) existingMeta.remove();

      // Reset module cache and dynamically import fresh i18n module
      vi.resetModules();
      const i18n = await import('../../js/i18n.js');

      const footerUrl = i18n.t('capture.footerUrl');
      expect(footerUrl).toBe(`https://moriyama-eng.github.io/fire-simulator/ | v${pkg.version}`);
      expect(footerUrl).toContain(`v${pkg.version}`);
      expect(footerUrl).not.toContain('{VERSION}');
    });

    it('should prioritize meta[name="app-version"] when present in DOM', async () => {
      // Set up a custom meta tag in document.head
      let meta = document.querySelector('meta[name="app-version"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'app-version');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', '9.9.9-test');

      // Reset module cache and dynamically import fresh i18n module
      vi.resetModules();
      const i18n = await import('../../js/i18n.js');

      const footerUrl = i18n.t('capture.footerUrl');
      expect(footerUrl).toContain('v9.9.9-test');
      expect(footerUrl).not.toContain('{VERSION}');
    });
  });
});



