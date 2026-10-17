import '../css/tailwind.css';
import { marked, type Token, type TokensList } from 'marked';
import { resolveDocLink, resolveDocImageSrc } from './docs-links.js';

export interface ManifestDoc {
  id: string;
  title: string;
}

export interface ManifestCategory {
  id: string;
  label: string;
  docs: ManifestDoc[];
}

export interface Manifest {
  categories: ManifestCategory[];
}

export function stripControlChars(str: string): string {
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

export function makeSlug(text: string, counts: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[\s\t\r\n]+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const cleanBase = base || 'section';
  const count = counts.get(cleanBase) || 0;
  counts.set(cleanBase, count + 1);
  return count === 0 ? cleanBase : `${cleanBase}-${count}`;
}

export function extractPlainText(token: Token): string {
  if ('text' in token && typeof token.text === 'string') {
    return token.text;
  }
  if ('tokens' in token && Array.isArray(token.tokens)) {
    return token.tokens.map(t => extractPlainText(t)).join('');
  }
  return '';
}

export interface RenderResult {
  container: HTMLElement;
  headings: Array<{ id: string; text: string; depth: number }>;
}

export function renderDocTokens(
  tokens: TokensList | Token[],
  category: string,
  pageUrl: string | URL = (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/')
): RenderResult {
  const container = document.createElement('div');
  const slugCounts = new Map<string, number>();
  const headings: Array<{ id: string; text: string; depth: number }> = [];

  function appendChildren(tokenList: Token[], parent: Node): void {
    for (const token of tokenList) {
      renderToken(token, parent);
    }
  }

  function renderToken(token: Token, parent: Node): void {
    switch (token.type) {
      case 'html':
        // Dropped: Drop all raw HTML tokens recursively
        break;

      case 'heading': {
        const h = document.createElement(`h${token.depth}`);
        const plainText = stripControlChars(token.text || extractPlainText(token));
        const slug = makeSlug(plainText, slugCounts);
        h.id = slug;
        if (token.depth === 2 || token.depth === 3) {
          headings.push({ id: slug, text: plainText, depth: token.depth });
        }
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, h);
        } else {
          h.textContent = plainText;
        }
        parent.appendChild(h);
        break;
      }

      case 'paragraph': {
        const p = document.createElement('p');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, p);
        } else {
          p.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(p);
        break;
      }

      case 'text': {
        if ('tokens' in token && token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, parent);
        } else {
          const txt = stripControlChars(token.text || '');
          if (txt) {
            parent.appendChild(document.createTextNode(txt));
          }
        }
        break;
      }

      case 'link': {
        const linkRes = resolveDocLink(token.href, category, pageUrl);
        const a = document.createElement('a');

        if (linkRes.type === 'external') {
          a.href = linkRes.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        } else if (linkRes.type === 'spa') {
          a.href = linkRes.url;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            history.pushState(null, '', linkRes.url);
            const targetUrl = new URL(linkRes.url, document.baseURI);
            const docParam = targetUrl.searchParams.get('doc');
            if (docParam && typeof window !== 'undefined' && (window as unknown as { __loadDoc?: (id: string) => void }).__loadDoc) {
              (window as unknown as { __loadDoc: (id: string) => void }).__loadDoc(docParam);
            }
          });
        } else if (linkRes.type === 'hash' || linkRes.type === 'asset') {
          a.href = linkRes.url;
        } else {
          // Dangerous: omit href, set aria-disabled
          a.setAttribute('aria-disabled', 'true');
        }

        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, a);
        } else {
          a.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(a);
        break;
      }

      case 'image': {
        const src = resolveDocImageSrc(token.href, category, pageUrl);
        if (!src) {
          // Omit img element entirely
          break;
        }
        const img = document.createElement('img');
        img.src = src;
        img.alt = stripControlChars(token.text || '');
        parent.appendChild(img);
        break;
      }

      case 'code': {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (token.lang) {
          code.className = `language-${stripControlChars(token.lang)}`;
        }
        code.textContent = stripControlChars(token.text || '');
        pre.appendChild(code);
        parent.appendChild(pre);
        break;
      }

      case 'codespan': {
        const code = document.createElement('code');
        code.textContent = stripControlChars(token.text || '');
        parent.appendChild(code);
        break;
      }

      case 'strong': {
        const strong = document.createElement('strong');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, strong);
        } else {
          strong.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(strong);
        break;
      }

      case 'em': {
        const em = document.createElement('em');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, em);
        } else {
          em.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(em);
        break;
      }

      case 'del': {
        const del = document.createElement('del');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, del);
        } else {
          del.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(del);
        break;
      }

      case 'blockquote': {
        const bq = document.createElement('blockquote');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, bq);
        } else {
          bq.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(bq);
        break;
      }

      case 'list': {
        const list = document.createElement(token.ordered ? 'ol' : 'ul');
        if (token.ordered && typeof token.start === 'number' && token.start !== 1) {
          (list as HTMLOListElement).start = token.start;
        }
        if (token.items && token.items.length > 0) {
          appendChildren(token.items, list);
        }
        parent.appendChild(list);
        break;
      }

      case 'list_item': {
        const li = document.createElement('li');
        if (token.tokens && token.tokens.length > 0) {
          appendChildren(token.tokens, li);
        } else {
          li.textContent = stripControlChars(token.text || '');
        }
        parent.appendChild(li);
        break;
      }

      case 'table': {
        const table = document.createElement('table');
        if (token.header && token.header.length > 0) {
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          for (const cell of token.header) {
            const th = document.createElement('th');
            if (cell.tokens && cell.tokens.length > 0) {
              appendChildren(cell.tokens, th);
            } else {
              th.textContent = stripControlChars(cell.text || '');
            }
            headerRow.appendChild(th);
          }
          thead.appendChild(headerRow);
          table.appendChild(thead);
        }
        if (token.rows && token.rows.length > 0) {
          const tbody = document.createElement('tbody');
          for (const row of token.rows) {
            const tr = document.createElement('tr');
            for (const cell of row) {
              const td = document.createElement('td');
              if (cell.tokens && cell.tokens.length > 0) {
                appendChildren(cell.tokens, td);
              } else {
                td.textContent = stripControlChars(cell.text || '');
              }
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
        }
        parent.appendChild(table);
        break;
      }

      case 'hr': {
        parent.appendChild(document.createElement('hr'));
        break;
      }

      case 'br': {
        parent.appendChild(document.createElement('br'));
        break;
      }

      case 'escape': {
        const txt = stripControlChars(token.text || '');
        if (txt) {
          parent.appendChild(document.createTextNode(txt));
        }
        break;
      }

      case 'space':
      case 'def':
      default:
        break;
    }
  }

  appendChildren(tokens, container);
  return { container, headings };
}

export function isAllowedDoc(catId: string, docId: string, manifest: Manifest): boolean {
  return manifest.categories.some(
    cat => cat.id === catId && cat.docs.some(d => d.id === docId)
  );
}

export function setActiveNavLink(docPath: string): void {
  const allLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-link');
  allLinks.forEach(link => {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
  });

  const activeLink = document.querySelector<HTMLAnchorElement>(`.nav-link[data-doc="${docPath}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
    activeLink.setAttribute('aria-current', 'page');
  }
}

export function renderMath(container: HTMLElement): void {
  const win = typeof window !== 'undefined' ? (window as unknown as { renderMathInElement?: (el: HTMLElement, opts: unknown) => void }) : undefined;
  if (!win || typeof win.renderMathInElement !== 'function') return;
  try {
    win.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  } catch {
    // Graceful degradation: raw text already visible
  }

  // Mark math elements as non-translatable
  container.querySelectorAll('.katex, .katex-display').forEach(el => {
    el.setAttribute('translate', 'no');
    el.classList.add('notranslate');
    if (el.parentElement) {
      el.parentElement.setAttribute('translate', 'no');
      el.parentElement.classList.add('notranslate');
    }
  });
}

// Browser app lifecycle
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let manifest: Manifest | null = null;

  const sidebar = document.getElementById('docs-sidebar');
  const navList = document.getElementById('nav-list');
  const tocSection = document.getElementById('toc-section');
  const loadingEl = document.getElementById('docs-loading');
  const contentEl = document.getElementById('docs-content');
  const notFoundEl = document.getElementById('not-found-card');
  const menuToggle = document.getElementById('menu-toggle');
  const overlay = document.getElementById('sidebar-overlay');

  function closeSidebar(): void {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  }

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      overlay.classList.toggle('open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    overlay.addEventListener('click', closeSidebar);
  }

  function getDocParam(): string | null {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('doc');
    } catch {
      return null;
    }
  }

  function showNotFound(): void {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
    if (notFoundEl) notFoundEl.style.display = 'block';
    document.title = 'Page Not Found — FIRE Monte Carlo Simulator Docs';
  }

  async function loadDoc(docPath: string): Promise<void> {
    if (!contentEl || !loadingEl || !notFoundEl) return;

    contentEl.style.display = 'none';
    notFoundEl.style.display = 'none';
    loadingEl.style.display = 'flex';
    contentEl.replaceChildren();
    if (tocSection) tocSection.replaceChildren();

    const parts = docPath.split('/');
    if (parts.length !== 2) {
      showNotFound();
      return;
    }
    const [category, name] = parts;

    if (!manifest || !isAllowedDoc(category, name, manifest)) {
      showNotFound();
      return;
    }

    setActiveNavLink(docPath);

    let md = '';
    try {
      const docUrl = new URL(`docs/${category}/${name}.md`, document.baseURI).href;
      const res = await fetch(docUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      md = await res.text();
    } catch {
      showNotFound();
      return;
    }

    const tokens = marked.lexer(md);
    const { container, headings } = renderDocTokens(tokens, category, document.baseURI);

    renderMath(container);

    contentEl.appendChild(container);
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    if (tocSection && headings.length > 0) {
      const label = document.createElement('div');
      label.className = 'toc-label';
      label.textContent = 'On this page';
      tocSection.appendChild(label);

      for (const h of headings) {
        const a = document.createElement('a');
        a.className = h.depth === 3 ? 'toc-link toc-h3' : 'toc-link';
        a.href = `#${h.id}`;
        a.textContent = h.text;
        tocSection.appendChild(a);
      }
    }

    const h1 = contentEl.querySelector('h1');
    document.title = (h1 ? `${h1.textContent} — ` : '') + 'FIRE Monte Carlo Simulator Docs';

    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        try {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          // invalid selector: ignore
        }
      }, 80);
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  (window as unknown as { __loadDoc: (id: string) => void }).__loadDoc = (id: string) => {
    loadDoc(id);
  };

  function buildNav(man: Manifest): void {
    if (!navList) return;
    navList.replaceChildren();

    for (const cat of man.categories) {
      const catDiv = document.createElement('div');
      catDiv.className = 'nav-category';

      const catLabel = document.createElement('div');
      catLabel.className = 'nav-category-label';
      catLabel.textContent = cat.label;
      catDiv.appendChild(catLabel);

      for (const doc of cat.docs) {
        const docId = `${cat.id}/${doc.id}`;
        const a = document.createElement('a');
        a.className = 'nav-link';
        a.setAttribute('data-doc', docId);
        a.href = `docs.html?doc=${docId}`;
        a.textContent = doc.title;

        a.addEventListener('click', (e) => {
          e.preventDefault();
          history.pushState(null, '', a.href);
          loadDoc(docId);
          closeSidebar();
        });

        catDiv.appendChild(a);
      }

      navList.appendChild(catDiv);
    }
  }

  async function init(): Promise<void> {
    try {
      const manifestUrl = new URL('docs/manifest.json', document.baseURI).href;
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch {
      if (loadingEl) {
        loadingEl.replaceChildren();
        const errSpan = document.createElement('span');
        errSpan.style.color = '#f87171';
        errSpan.textContent = 'Failed to load documentation manifest.';
        loadingEl.appendChild(errSpan);
      }
      return;
    }

    if (!manifest || !manifest.categories || manifest.categories.length === 0) {
      showNotFound();
      return;
    }

    buildNav(manifest);

    let docParam = getDocParam();
    const docParamRegex = /^[a-z0-9-]+\/[a-z0-9-]+$/;

    if (!docParam || !docParamRegex.test(docParam) || !isAllowedDoc(docParam.split('/')[0], docParam.split('/')[1], manifest)) {
      const firstCat = manifest.categories[0];
      const firstDoc = firstCat.docs[0];
      docParam = `${firstCat.id}/${firstDoc.id}`;
      const hash = window.location.hash || '';
      history.replaceState(null, '', `docs.html?doc=${docParam}${hash}`);
    }

    await loadDoc(docParam);
  }

  window.addEventListener('popstate', () => {
    const docParam = getDocParam();
    if (docParam && manifest && docParam.includes('/')) {
      const [cat, id] = docParam.split('/');
      if (isAllowedDoc(cat, id, manifest)) {
        loadDoc(docParam);
        return;
      }
    }
    if (manifest && manifest.categories[0]?.docs[0]) {
      const fallback = `${manifest.categories[0].id}/${manifest.categories[0].docs[0].id}`;
      loadDoc(fallback);
    }
  });

  init();
}
