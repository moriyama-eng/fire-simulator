import { describe, it, expect } from 'vitest';
import { normalizeAndValidateUrl } from '../../src/url-utils.js';

describe('normalizeAndValidateUrl', () => {
  it('returns null for non-string inputs', () => {
    expect(normalizeAndValidateUrl(null)).toBeNull();
    expect(normalizeAndValidateUrl(undefined)).toBeNull();
    expect(normalizeAndValidateUrl(123)).toBeNull();
    expect(normalizeAndValidateUrl({})).toBeNull();
  });

  it('normalizes backslashes and trims whitespace', () => {
    expect(normalizeAndValidateUrl('  assets\\images\\test.png  ')).toBe('assets/images/test.png');
  });

  it('handles multiple rounds of percent and entity decoding', () => {
    expect(normalizeAndValidateUrl('assets%2Fguide%2Foverview.md')).toBe('assets/guide/overview.md');
    expect(normalizeAndValidateUrl('assets&#x2F;test.png')).toBe('assets/test.png');
    expect(normalizeAndValidateUrl('assets&#47;test.png')).toBe('assets/test.png');
  });

  it('fails closed on malformed percent encoding', () => {
    expect(normalizeAndValidateUrl('foo%G1bar')).toBeNull();
    expect(normalizeAndValidateUrl('%E0%A4%A')).toBeNull();
  });

  it('fails closed on surrogate range error', () => {
    expect(normalizeAndValidateUrl('&#xD800;')).toBeNull();
    expect(normalizeAndValidateUrl('&#55296;')).toBeNull();
  });

  it('fails closed on nested encoding overflow exceeding 10 iterations', () => {
    // 11 levels of encoding
    let payload = 'test';
    for (let i = 0; i < 12; i++) {
      payload = encodeURIComponent(payload);
    }
    // With a non-alphanumeric character like slash
    let slashPayload = 'a/b';
    for (let i = 0; i < 11; i++) {
      slashPayload = encodeURIComponent(slashPayload);
    }
    expect(normalizeAndValidateUrl(slashPayload)).toBeNull();
  });

  it('fails closed when control characters remain', () => {
    expect(normalizeAndValidateUrl('test\u0000.png')).toBeNull();
    expect(normalizeAndValidateUrl('test\u001F.png')).toBeNull();
    expect(normalizeAndValidateUrl('test\u007F.png')).toBeNull();
    expect(normalizeAndValidateUrl('test\u0085.png')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    expect(normalizeAndValidateUrl('//evil.com/asset.png')).toBeNull();
  });

  it('rejects root-absolute URLs by default', () => {
    expect(normalizeAndValidateUrl('/assets/test.png')).toBeNull();
    expect(normalizeAndValidateUrl('/assets/test.png', { allowLeadingSlash: true })).toBe('/assets/test.png');
  });

  it('handles parent traversal segments based on options', () => {
    expect(normalizeAndValidateUrl('../assets/test.png')).toBeNull();
    expect(normalizeAndValidateUrl('foo/../bar.png')).toBeNull();
    expect(normalizeAndValidateUrl('../assets/test.png', { allowParentTraversal: true })).toBe('../assets/test.png');
  });

  it('allows same-document fragments', () => {
    expect(normalizeAndValidateUrl('#section-1')).toBe('#section-1');
  });

  it('handles schemes strictly based on allowExternalHttp', () => {
    expect(normalizeAndValidateUrl('https://example.com/doc')).toBeNull();
    expect(normalizeAndValidateUrl('https://example.com/doc', { allowExternalHttp: true })).toBe('https://example.com/doc');
    expect(normalizeAndValidateUrl('mailto:test@example.com', { allowExternalHttp: true })).toBe('mailto:test@example.com');
    expect(normalizeAndValidateUrl('http://insecure.com', { allowExternalHttp: true })).toBeNull();
    expect(normalizeAndValidateUrl('javascript:alert(1)', { allowExternalHttp: true })).toBeNull();
    expect(normalizeAndValidateUrl('data:text/html,evil', { allowExternalHttp: true })).toBeNull();
  });

  it('rejects relative path containing a colon before first slash', () => {
    expect(normalizeAndValidateUrl('javascript:foo/bar')).toBeNull();
    expect(normalizeAndValidateUrl('evil:doc.png')).toBeNull();
    expect(normalizeAndValidateUrl('path/to:file.png')).toBe('path/to:file.png');
  });
});
