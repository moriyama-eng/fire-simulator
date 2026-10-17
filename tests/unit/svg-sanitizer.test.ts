import { describe, it, expect } from 'vitest';
import { sanitizeSvgContent } from '../../scripts/lib/confinement.mjs';

describe('sanitizeSvgContent', () => {
  it('preserves clean standard SVG structure', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    const sanitized = sanitizeSvgContent(raw);
    expect(sanitized).toContain('<svg');
    expect(sanitized).toContain('viewBox="0 0 100 100"');
    expect(sanitized).toContain('<circle');
  });

  it('accepts UTF-8 XML declaration prolog and rejects non-UTF-8 encoding', () => {
    const valid = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    expect(() => sanitizeSvgContent(valid)).not.toThrow();

    const invalid = '<?xml version="1.0" encoding="ISO-8859-1"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(() => sanitizeSvgContent(invalid)).toThrow(/non-UTF-8/i);
  });

  it('preserves camelCase attributes and gradient elements', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
        <defs>
          <linearGradient id="grad1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          </linearGradient>
        </defs>
        <rect width="20" height="20" fill="url(#grad1)" />
      </svg>
    `;
    const sanitized = sanitizeSvgContent(svg);
    expect(sanitized).toContain('viewBox="0 0 20 20"');
    expect(sanitized).toContain('linearGradient');
    expect(sanitized).toContain('gradientUnits="userSpaceOnUse"');
    expect(sanitized).toContain('stop-opacity="1"');
    expect(sanitized).toContain('fill="url(#grad1)"');
  });

  it('strips inline event handlers and script tags', () => {
    const dirty = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert(1)</script>
        <circle cx="10" cy="10" r="5" onclick="alert(2)" onload="bad()" />
      </svg>
    `;
    const sanitized = sanitizeSvgContent(dirty);
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('alert(1)');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onload');
  });

  it('restricts href and xlink:href strictly to same-document fragments', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <use href="#valid-id" xlink:href="#another-valid_1" />
        <use href="https://evil.com/icon.svg#test" />
        <use xlink:href="javascript:alert(1)" />
        <use href="../evil.svg" />
      </svg>
    `;
    const sanitized = sanitizeSvgContent(svg);
    expect(sanitized).toContain('href="#valid-id"');
    expect(sanitized).toContain('xlink:href="#another-valid_1"');
    expect(sanitized).not.toContain('https://evil.com');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('../evil.svg');
  });

  it('rejects DOCTYPE and ENTITY declarations', () => {
    const xxe = '<!DOCTYPE svg [ <!ENTITY xxe "evil"> ]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>';
    expect(() => sanitizeSvgContent(xxe)).toThrow(/disallowed DOCTYPE or ENTITY/i);
  });

  it('enforces XML namespace allowlist', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:custom="http://evil.com/ns" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect width="10" height="10"/>
      </svg>
    `;
    const sanitized = sanitizeSvgContent(svg);
    expect(sanitized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(sanitized).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(sanitized).not.toContain('http://evil.com/ns');
  });
});
