// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { marked } from 'marked';
import { renderDocTokens, setActiveNavLink, makeSlug, renderMath } from '../../src/docs-app.js';

describe('docs-render DOM tree builder', () => {
  it('drops raw html tokens, script tags, and iframes completely', () => {
    const dirtyMd = `
# Title

<script>window.pwned = true;</script>
<iframe src="https://evil.com"></iframe>
<p style="color:red">Normal text with <b>bold</b> html tag</p>

[Normal Link](https://example.com)
`;
    const tokens = marked.lexer(dirtyMd);
    const { container } = renderDocTokens(tokens, 'guide', 'http://localhost:5173/docs.html');

    expect(container.querySelectorAll('script').length).toBe(0);
    expect(container.querySelectorAll('iframe').length).toBe(0);
    expect(container.textContent).not.toContain('window.pwned');
    expect(container.textContent).not.toContain('https://evil.com');
  });

  it('omits dangerous links href and marks them aria-disabled', () => {
    const md = `[Attack](javascript:alert(1))`;
    const tokens = marked.lexer(md);
    const { container } = renderDocTokens(tokens, 'guide', 'http://localhost:5173/docs.html');

    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.hasAttribute('href')).toBe(false);
    expect(a?.getAttribute('aria-disabled')).toBe('true');
  });

  it('omits invalid or dangerous images entirely', () => {
    const md = `
![Evil Image](/absolute/path.png)
![Internal](../internal/secret.png)
![Valid](../assets/readme/fire-simulator-overview.png)
`;
    const tokens = marked.lexer(md);
    const { container } = renderDocTokens(tokens, 'guide', 'http://localhost:5173/docs.html');

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe('/docs/assets/readme/fire-simulator-overview.png');
  });

  it('generates deterministic heading slugs and disambiguates collisions', () => {
    const counts = new Map<string, number>();
    expect(makeSlug('Prerequisites', counts)).toBe('prerequisites');
    expect(makeSlug('Prerequisites', counts)).toBe('prerequisites-1');
    expect(makeSlug('Prerequisites', counts)).toBe('prerequisites-2');
    expect(makeSlug('日本語 セクション', counts)).toBe('日本語-セクション');
  });

  describe('setActiveNavLink', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="nav-list">
          <a class="nav-link active" data-doc="guide/overview" aria-current="page">Overview</a>
          <a class="nav-link" data-doc="guide/getting-started">Getting Started</a>
          <a class="nav-link" data-doc="reference/headless-api">Headless API</a>
        </div>
      `;
    });

    it('clears active and aria-current from old links and assigns to target link', () => {
      setActiveNavLink('guide/getting-started');

      const oldLink = document.querySelector('[data-doc="guide/overview"]');
      const newLink = document.querySelector('[data-doc="guide/getting-started"]');
      const otherLink = document.querySelector('[data-doc="reference/headless-api"]');

      expect(oldLink?.classList.contains('active')).toBe(false);
      expect(oldLink?.hasAttribute('aria-current')).toBe(false);

      expect(newLink?.classList.contains('active')).toBe(true);
      expect(newLink?.getAttribute('aria-current')).toBe('page');

      expect(otherLink?.classList.contains('active')).toBe(false);
      expect(otherLink?.hasAttribute('aria-current')).toBe(false);
    });
  });

  describe('renderMath LaTeX expressions', () => {
    it('renders LaTeX expressions ($$...$$ and \\(...\\)) using renderMathInElement', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p>Inline math: \\(E = mc^2\\)</p>
        <p>Display math: $$\\int_0^\\infty e^{-x} dx = 1$$</p>
      `;

      let passedOptions: unknown = null;
      const mockRender = (el: HTMLElement, opts: unknown) => {
        passedOptions = opts;
        // Simulate KaTeX DOM modification
        const p1 = el.querySelector('p');
        if (p1) {
          const span = document.createElement('span');
          span.className = 'katex';
          span.textContent = 'E = mc^2';
          p1.replaceChildren(span);
        }
        const p2 = el.querySelectorAll('p')[1];
        if (p2) {
          const span = document.createElement('span');
          span.className = 'katex-display';
          span.textContent = 'integral';
          p2.replaceChildren(span);
        }
      };

      (window as unknown as { renderMathInElement?: typeof mockRender }).renderMathInElement = mockRender;

      renderMath(container);

      expect(passedOptions).toEqual({
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });

      const katexEls = container.querySelectorAll('.katex, .katex-display');
      expect(katexEls.length).toBe(2);
      katexEls.forEach(el => {
        expect(el.getAttribute('translate')).toBe('no');
        expect(el.classList.contains('notranslate')).toBe(true);
        expect(el.parentElement?.getAttribute('translate')).toBe('no');
        expect(el.parentElement?.classList.contains('notranslate')).toBe(true);
      });

      delete (window as unknown as { renderMathInElement?: typeof mockRender }).renderMathInElement;
    });

    it('gracefully degrades when renderMathInElement is not available', () => {
      const container = document.createElement('div');
      container.innerHTML = `<p>\\(x + y\\)</p>`;

      expect(() => renderMath(container)).not.toThrow();
      expect(container.innerHTML).toBe('<p>\\(x + y\\)</p>');
    });

    it('gracefully catches and does not throw when renderMathInElement throws an exception', () => {
      const container = document.createElement('div');
      container.innerHTML = `<p>$$invalid \\math$$</p>`;

      (window as unknown as { renderMathInElement?: () => void }).renderMathInElement = () => {
        throw new Error('KaTeX rendering error');
      };

      expect(() => renderMath(container)).not.toThrow();
      expect(container.innerHTML).toBe('<p>$$invalid \\math$$</p>');

      delete (window as unknown as { renderMathInElement?: unknown }).renderMathInElement;
    });
  });
});
