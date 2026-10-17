// tests/helpers/i18n-mock.ts
import { vi } from 'vitest';

vi.mock('../../src/i18n.js', async (importOriginal: () => Promise<{ TRANSLATIONS: { ja: Record<string, string> } }>) => {
  // Inside vi.mock callback in tests/helpers/i18n-mock.ts
  const actual = await importOriginal();
  const ja = actual.TRANSLATIONS.ja;

  // * Version number for testing (fixed is fine)
  const APP_VERSION = '2.3.2';

  function mockT(key: string, placeholders: (string | number)[] = []): string {
    let text = ja[key] || key;
    // * Replace version number
    text = text.replace(/\{VERSION\}/g, APP_VERSION);
    placeholders.forEach((p, i) => {
      text = text.replace(new RegExp('\\{' + i + '\\}', 'g'), String(p));
    });
    return text;
  }
  function mockFormatCurrency(v: number, unit?: string): string {
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
    formatPercent: (v: number) => (v * 100).toFixed(1) + '%',
    formatDate: (d: Date) => d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    formatNumber: (v: number) => v.toLocaleString('ja-JP'),
    formatYears: (v: number | string) => v + '年',
  };
});
