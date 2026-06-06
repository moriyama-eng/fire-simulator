import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../../js/i18n.js';

describe('i18n translation snapshot', () => {
  it('TRANSLATIONS.ja should match snapshot (complete match to v2.0.0)', () => {
    // ソートされた状態でスナップショットを取得（キー順序の違いを無視）
    const sorted = JSON.stringify(TRANSLATIONS.ja, Object.keys(TRANSLATIONS.ja).sort(), 2);
    expect(sorted).toMatchSnapshot();
  });
});