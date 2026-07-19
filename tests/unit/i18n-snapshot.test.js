import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../../js/i18n.js';

describe('i18n translation snapshot', () => {
  it('TRANSLATIONS.ja should match snapshot (complete match to v2.0.0)', () => {
    // Take a snapshot in sorted state (to ignore differences in key order)
    const sorted = JSON.stringify(TRANSLATIONS.ja, Object.keys(TRANSLATIONS.ja).sort(), 2);
    expect(sorted).toMatchSnapshot();
  });
});