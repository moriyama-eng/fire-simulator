import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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
});
