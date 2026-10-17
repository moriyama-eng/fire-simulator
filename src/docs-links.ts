import { normalizeAndValidateUrl } from './url-utils.js';

export type DocLinkResult =
  | { type: 'external'; url: string }
  | { type: 'hash'; url: string }
  | { type: 'spa'; url: string }
  | { type: 'asset'; url: string }
  | { type: 'dangerous' };

const STATIC_ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.pdf', '.csv', '.json'
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'
]);

function getExtension(pathname: string): string {
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot === -1) return '';
  return pathname.slice(lastDot).toLowerCase();
}

export function resolveDocLink(
  rawHref: unknown,
  currentCategory: string,
  pageUrl: string | URL
): DocLinkResult {
  const cleanHref = normalizeAndValidateUrl(rawHref, {
    allowExternalHttp: true,
    allowLeadingSlash: false,
    allowParentTraversal: true,
  });

  if (!cleanHref) {
    return { type: 'dangerous' };
  }

  const lower = cleanHref.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('mailto:')) {
    return { type: 'external', url: cleanHref };
  }

  if (cleanHref.startsWith('#')) {
    return { type: 'hash', url: cleanHref };
  }

  try {
    const dirBase = new URL('docs/' + currentCategory + '/', pageUrl);
    const docsRootUrl = new URL('docs/', pageUrl);
    const targetUrl = new URL(cleanHref, dirBase);

    if (targetUrl.origin !== docsRootUrl.origin) {
      return { type: 'dangerous' };
    }

    if (!targetUrl.pathname.startsWith(docsRootUrl.pathname)) {
      return { type: 'dangerous' };
    }

    const relPath = targetUrl.pathname.slice(docsRootUrl.pathname.length);
    const segments = relPath.split('/').filter(Boolean);

    if (segments.some(seg => {
      const s = seg.toLowerCase();
      return (
        s === 'internal' ||
        s.startsWith('internal.') ||
        s.startsWith('internal:') ||
        s.startsWith('internal~') ||
        s.startsWith('internal;') ||
        s.includes(':')
      );
    })) {
      return { type: 'dangerous' };
    }

    const ext = getExtension(targetUrl.pathname);

    if (ext === '.md') {
      if (segments.length !== 2) {
        return { type: 'dangerous' };
      }
      const targetCategory = segments[0];
      const targetDoc = segments[1].slice(0, -3);
      if (!/^[a-z0-9-]+$/i.test(targetCategory) || !/^[a-z0-9-]+$/i.test(targetDoc)) {
        return { type: 'dangerous' };
      }
      const query = targetUrl.search || '';
      const hash = targetUrl.hash || '';
      return {
        type: 'spa',
        url: `docs.html?doc=${targetCategory}/${targetDoc}${query}${hash}`
      };
    }

    if (STATIC_ASSET_EXTENSIONS.has(ext)) {
      return {
        type: 'asset',
        url: targetUrl.pathname
      };
    }

    return { type: 'dangerous' };
  } catch {
    return { type: 'dangerous' };
  }
}

export function resolveDocImageSrc(
  rawSrc: unknown,
  currentCategory: string,
  pageUrl: string | URL
): string {
  const cleanSrc = normalizeAndValidateUrl(rawSrc, {
    allowExternalHttp: false,
    allowLeadingSlash: false,
    allowParentTraversal: true,
  });

  if (!cleanSrc) {
    return '';
  }

  try {
    const dirBase = new URL('docs/' + currentCategory + '/', pageUrl);
    const docsRootUrl = new URL('docs/', pageUrl);
    const targetUrl = new URL(cleanSrc, dirBase);

    if (targetUrl.origin !== docsRootUrl.origin) {
      return '';
    }

    if (!targetUrl.pathname.startsWith(docsRootUrl.pathname)) {
      return '';
    }

    const relPath = targetUrl.pathname.slice(docsRootUrl.pathname.length);
    const segments = relPath.split('/').filter(Boolean);

    if (segments.some(seg => {
      const s = seg.toLowerCase();
      return (
        s === 'internal' ||
        s.startsWith('internal.') ||
        s.startsWith('internal:') ||
        s.startsWith('internal~') ||
        s.startsWith('internal;') ||
        s.includes(':')
      );
    })) {
      return '';
    }

    const ext = getExtension(targetUrl.pathname);
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return '';
    }

    return targetUrl.pathname;
  } catch {
    return '';
  }
}
