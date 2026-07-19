import { vi } from 'vitest';

vi.mock('../../js/i18n.js', async (importOriginal) => {
  // Inside vi.mock callback in tests/helpers/i18n-mock.js
  const actual = await importOriginal();
  const ja = actual.TRANSLATIONS.ja;

  // * Version number for testing (fixed is fine)
  const APP_VERSION = '2.3.2';

  function mockT(key, placeholders = []) {
    let text = ja[key] || key;
    // * Replace version number
    text = text.replace(/\{VERSION\}/g, APP_VERSION);
    placeholders.forEach((p, i) => {
      text = text.replace(new RegExp('\\{' + i + '\\}', 'g'), p);
    });
    return text;
  }
  function mockFormatCurrency(v, unit) {
    if (v < 0) return '-' + mockFormatCurrency(-v, unit);
    if (unit === '億円') return (v / 1e8).toLocaleString('ja-JP', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' 億円';
    if (unit === '万円') return (v / 1e4).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + ' 万円';
    return v.toLocaleString('ja-JP');
  }
  return {
    t: mockT,
    setLanguage: vi.fn(),
    getLanguage: vi.fn(() => 'ja'),
    getSupportedLanguages: vi.fn(() => ['ja', 'en']),
    formatCurrency: mockFormatCurrency,
    formatPercent: v => (v * 100).toFixed(1) + '%',
    formatDate: d => d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    formatNumber: v => v.toLocaleString('ja-JP'),
    formatYears: v => v + '年',
  };
});