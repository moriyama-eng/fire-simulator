export interface UrlNormalizeOptions {
  allowExternalHttp?: boolean;
  allowLeadingSlash?: boolean;
  allowParentTraversal?: boolean;
}

export function normalizeAndValidateUrl(rawVal: unknown, options: UrlNormalizeOptions = {}): string | null {
  if (typeof rawVal !== 'string') return null;

  let val = rawVal;
  let prev = '';
  let iter = 0;
  const MAX_ITER = 10;

  while (val !== prev && iter < MAX_ITER) {
    prev = val;
    iter++;
    try {
      val = decodeURIComponent(val);
    } catch {
      return null; // Malformed percent-encoding: fail closed
    }
    let surrogateError = false;
    val = val.replace(/&#[xX]?([0-9a-fA-F]+);?/g, (_, code) => {
      const isHex = _.startsWith('&#x') || _.startsWith('&#X');
      const num = parseInt(code, isHex ? 16 : 10);
      if (isNaN(num) || num < 0 || num > 0x10FFFF) return '';
      if (num >= 0xD800 && num <= 0xDFFF) {
        surrogateError = true;
        return '';
      }
      try {
        return String.fromCodePoint(num);
      } catch {
        surrogateError = true;
        return '';
      }
    });
    if (surrogateError) {
      return null; // Surrogate RangeError: fail closed
    }
  }

  if (val !== prev && iter >= MAX_ITER) {
    return null; // Nested encoding overflow: fail closed
  }

  // If control characters (C0, DEL, C1) or surrogates remain after decoding, fail closed
  if (/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/.test(val)) {
    return null;
  }

  // Trim leading/trailing whitespace
  const trimmed = val.trim();

  // Normalize backslashes to forward slashes
  const normalized = trimmed.replace(/\\/g, '/');

  // Reject protocol-relative URLs (//)
  if (normalized.startsWith('//')) {
    return null;
  }

  // Reject root-absolute URLs (/foo) to prevent origin escaping on shared hosts
  if (normalized.startsWith('/') && !options.allowLeadingSlash) {
    return null;
  }

  // Reject traversal segments (..) unless allowParentTraversal is explicitly true (for markdown docs)
  if (!options.allowParentTraversal && normalized.split('/').includes('..')) {
    return null;
  }

  // Same-document fragment (#id): allow if valid
  if (normalized.startsWith('#')) {
    return normalized;
  }

  // Scheme detection: ^[a-zA-Z][a-zA-Z0-9+.-]*:
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    if (options.allowExternalHttp) {
      const lower = normalized.toLowerCase();
      if (lower.startsWith('https://') || lower.startsWith('mailto:')) {
        return normalized;
      }
    }
    // In SVG resource attributes or strict same-origin mode: reject all schemes!
    return null;
  }

  // Same-origin relative path: must not contain ':' before first '/'
  const firstSlash = normalized.indexOf('/');
  const colonIndex = normalized.indexOf(':');
  if (colonIndex !== -1 && (firstSlash === -1 || colonIndex < firstSlash)) {
    return null;
  }

  return normalized;
}
