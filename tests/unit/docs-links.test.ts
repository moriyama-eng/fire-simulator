import { describe, it, expect } from 'vitest';
import { resolveDocLink, resolveDocImageSrc } from '../../src/docs-links.js';

describe('docs-links module', () => {
  const hosts = [
    { name: 'Dev Server', base: 'http://localhost:5173/docs.html', expectedPrefix: '/docs/' },
    { name: 'Subpath Server', base: 'http://127.0.0.1:8080/fire-simulator/docs.html', expectedPrefix: '/fire-simulator/docs/' },
    { name: 'GitHub Pages', base: 'https://moriyama-eng.github.io/fire-simulator/docs.html', expectedPrefix: '/fire-simulator/docs/' }
  ];

  describe('resolveDocImageSrc across hosts', () => {
    for (const host of hosts) {
      it(`resolves relative image src correctly on ${host.name}`, () => {
        const res = resolveDocImageSrc('../assets/readme/fire-simulator-overview.png', 'guide', host.base);
        expect(res).toBe(`${host.expectedPrefix}assets/readme/fire-simulator-overview.png`);
      });
    }

    it('rejects root-absolute images', () => {
      expect(resolveDocImageSrc('/assets/test.png', 'guide', 'http://localhost:5173/docs.html')).toBe('');
    });

    it('rejects images escaping docs root or pointing to internal', () => {
      expect(resolveDocImageSrc('../../../outside.png', 'guide', 'http://localhost:5173/docs.html')).toBe('');
      expect(resolveDocImageSrc('../internal/diagram.png', 'guide', 'http://localhost:5173/docs.html')).toBe('');
      expect(resolveDocImageSrc('../Internal/diagram.png', 'guide', 'http://localhost:5173/docs.html')).toBe('');
    });

    it('rejects non-image extensions in resolveDocImageSrc', () => {
      expect(resolveDocImageSrc('getting-started.md', 'guide', 'http://localhost:5173/docs.html')).toBe('');
      expect(resolveDocImageSrc('malicious.js', 'guide', 'http://localhost:5173/docs.html')).toBe('');
    });
  });

  describe('resolveDocLink', () => {
    it('resolves intra-category and cross-category markdown links into SPA URLs', () => {
      const link1 = resolveDocLink('getting-started.md#prerequisites', 'guide', 'http://localhost:5173/docs.html');
      expect(link1).toEqual({
        type: 'spa',
        url: 'docs.html?doc=guide/getting-started#prerequisites'
      });

      const link2 = resolveDocLink('../reference/metrics-glossary.md', 'guide', 'http://localhost:5173/docs.html');
      expect(link2).toEqual({
        type: 'spa',
        url: 'docs.html?doc=reference/metrics-glossary'
      });
    });

    it('resolves external https and mailto links', () => {
      expect(resolveDocLink('https://github.com/moriyama-eng/fire-simulator', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'external',
        url: 'https://github.com/moriyama-eng/fire-simulator'
      });
      expect(resolveDocLink('mailto:support@example.com', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'external',
        url: 'mailto:support@example.com'
      });
    });

    it('resolves same-page hash links', () => {
      expect(resolveDocLink('#section-2', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'hash',
        url: '#section-2'
      });
    });

    it('resolves static assets as asset links', () => {
      const res = resolveDocLink('../assets/readme/fire-simulator-overview.png', 'guide', 'https://moriyama-eng.github.io/fire-simulator/docs.html');
      expect(res).toEqual({
        type: 'asset',
        url: '/fire-simulator/docs/assets/readme/fire-simulator-overview.png'
      });
    });

    it('rejects root-absolute links, internal references, and alternate data streams', () => {
      expect(resolveDocLink('/foo.png', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'dangerous'
      });
      expect(resolveDocLink('../internal/testing-guide.md', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'dangerous'
      });
      expect(resolveDocLink('../internal::$INDEX_ALLOCATION/testing-guide.md', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'dangerous'
      });
      expect(resolveDocLink('getting-started.md::$DATA', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'dangerous'
      });
      expect(resolveDocLink('javascript:alert(1)', 'guide', 'http://localhost:5173/docs.html')).toEqual({
        type: 'dangerous'
      });
    });

    it('rejects alternate data streams in image sources', () => {
      expect(resolveDocImageSrc('../internal::$INDEX_ALLOCATION/img.png', 'guide', 'http://localhost:5173/docs.html')).toBe('');
      expect(resolveDocImageSrc('img.png::$DATA', 'guide', 'http://localhost:5173/docs.html')).toBe('');
    });
  });
});
