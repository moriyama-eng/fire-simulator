import path from 'node:path';
import fs from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const MIME_MAP = {
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8'
};

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function resolveAndValidateSegments(cleanTarget, denyInternal = true) {
  const rawSegments = cleanTarget.split(/[\\/]/);
  const segments = [];
  for (const seg of rawSegments) {
    if (!seg || seg === '.') continue;
    const segLower = seg.toLowerCase();
    if (
      seg === '..' ||
      seg.includes(':') ||
      WINDOWS_RESERVED_NAMES.test(seg) ||
      (denyInternal && (
        segLower === 'internal' ||
        segLower.startsWith('internal.') ||
        segLower.startsWith('internal:') ||
        segLower.startsWith('internal~') ||
        segLower.startsWith('internal;')
      ))
    ) {
      throw new Error(`Invalid traversal, internal segment, drive prefix, colon, or reserved device name in path: ${cleanTarget}`);
    }
    segments.push(seg);
  }
  return segments;
}

export function verifyConfinedPath(rootPath, targetPath, options = {}) {
  if (typeof targetPath !== 'string') throw new TypeError('targetPath must be a string');

  const pathImpl = options.pathImpl || path;
  const fsImpl = options.fsImpl || fs;
  const refuseSymlinks = options.refuseSymlinks ?? true;
  const denyInternal = options.denyInternal ?? true;

  if (refuseSymlinks) {
    const rootStat = fsImpl.lstatSync(rootPath);
    if (rootStat.isSymbolicLink()) throw new Error(`Root directory is a symbolic link: ${rootPath}`);
  }

  // Fixed-point decode of targetPath before segment validation
  let decodedTarget = targetPath;
  let prevTarget = '';
  let decIter = 0;
  while (decodedTarget !== prevTarget && decIter < 10) {
    prevTarget = decodedTarget;
    decIter++;
    try {
      decodedTarget = decodeURIComponent(decodedTarget);
    } catch {
      throw new Error(`Malformed URI encoding in path: ${targetPath}`);
    }
  }
  if (decodedTarget !== prevTarget && decIter >= 10) {
    throw new Error(`Nested encoding overflow in path: ${targetPath}`);
  }

  if (/[\u0000-\u001F\u007F-\u009F\uD800-\uDFFF]/.test(decodedTarget)) {
    throw new Error(`Invalid control or surrogate character in path: ${targetPath}`);
  }

  let cleanTarget = decodedTarget.replace(/^[\\/]+/, '');
  const segments = resolveAndValidateSegments(cleanTarget, denyInternal);

  const resolvedRoot = pathImpl.resolve(rootPath);
  const resolvedTarget = pathImpl.resolve(resolvedRoot, segments.join(pathImpl.sep));

  const rel = pathImpl.relative(resolvedRoot, resolvedTarget);
  if (rel === '..' || rel.startsWith('..' + pathImpl.sep) || pathImpl.isAbsolute(rel)) {
    throw new Error(`Path escapes root confinement: ${targetPath}`);
  }

  if (refuseSymlinks) {
    try {
      const targetStat = fsImpl.lstatSync(resolvedTarget);
      if (targetStat.isSymbolicLink()) throw new Error(`Symlinks are forbidden: ${targetPath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  if (!options.skipRealpath) {
    let realTarget;
    try {
      realTarget = fsImpl.realpathSync(resolvedTarget);
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (denyInternal) {
          const relSegments = pathImpl.relative(resolvedRoot, resolvedTarget).split(pathImpl.sep).map(s => s.toLowerCase());
          if (
            relSegments.includes('internal') ||
            relSegments.some(s => s.startsWith('internal.') || s.startsWith('internal:') || s.startsWith('internal~'))
          ) {
            throw new Error(`Path escapes root confinement: ${targetPath}`);
          }
        }
        return resolvedTarget;
      }
      throw err;
    }

    const realRoot = fsImpl.realpathSync(resolvedRoot);
    const realRel = pathImpl.relative(realRoot, realTarget);
    const relSegments = realRel.split(pathImpl.sep).map(s => s.toLowerCase());

    if (
      realRel === '..' ||
      realRel.startsWith('..' + pathImpl.sep) ||
      pathImpl.isAbsolute(realRel) ||
      (denyInternal && (
        relSegments.includes('internal') ||
        relSegments.some(s => s.startsWith('internal.') || s.startsWith('internal:') || s.startsWith('internal~'))
      ))
    ) {
      throw new Error(`Path escapes root confinement: ${targetPath}`);
    }
    return realTarget;
  }

  return resolvedTarget;
}

export function sanitizeSvgContent(rawSvg) {
  if (typeof rawSvg !== 'string') throw new TypeError('rawSvg must be a string');

  if (/<!DOCTYPE\b/i.test(rawSvg) || /<!ENTITY\b/i.test(rawSvg)) {
    throw new Error('SVG contains disallowed DOCTYPE or ENTITY declaration');
  }

  const xmlDeclMatch = rawSvg.match(/^\s*<\?xml\b([^>]*)\?>/i);
  if (xmlDeclMatch) {
    const decl = xmlDeclMatch[1];
    const encodingMatch = decl.match(/\bencoding\s*=\s*["']([^"']+)["']/i);
    if (encodingMatch && encodingMatch[1].trim().toLowerCase() !== 'utf-8') {
      throw new Error('SVG specifies non-UTF-8 encoding');
    }
  }

  let parseError = null;
  const parser = new DOMParser({
    onError: (level, msg) => {
      if (level === 'error' || level === 'fatalError' || /entity|doctype/i.test(msg)) {
        parseError = msg;
      }
    }
  });

  const doc = parser.parseFromString(rawSvg, 'application/xml');
  if (parseError || !doc.documentElement || doc.documentElement.tagName.toLowerCase() !== 'svg') {
    throw new Error(`XML parse error: ${parseError || 'Root element is not svg'}`);
  }

  // Reject if document contains doctype or entity declarations
  if (doc.doctype) {
    throw new Error('SVG contains disallowed DOCTYPE node');
  }

  for (let i = doc.childNodes.length - 1; i >= 0; i--) {
    const child = doc.childNodes[i];
    if (child.nodeType !== 1) doc.removeChild(child);
  }

  const ALLOWED_ELEMENTS_LC = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'clippath', 'lineargradient', 'radialgradient', 'stop',
    'pattern', 'mask', 'image', 'use', 'symbol', 'marker', 'title', 'desc', 'filter',
    'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'femerge', 'femergenode'
  ]);

  const ALLOWED_ATTRIBUTES_LC = new Set([
    'id', 'class', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'transform',
    'transform-origin', 'clip-path', 'mask', 'filter', 'font-family', 'font-size', 'font-weight',
    'font-style', 'text-anchor', 'dominant-baseline', 'dx', 'dy', 'gradientunits',
    'gradienttransform', 'spreadmethod', 'stop-color', 'stop-opacity', 'offset',
    'patternunits', 'patterncontentunits', 'preserveaspectratio', 'xmlns', 'xmlns:xlink',
    'version', 'xml:space', 'href', 'xlink:href', 'orient', 'markerwidth', 'markerheight',
    'refx', 'refy', 'markerunits', 'in', 'in2', 'mode', 'stddeviation', 'result'
  ]);

  const ALLOWED_NAMESPACES = new Set([
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1999/xlink'
  ]);

  function sanitizeElement(el) {
    const tagNameLc = el.tagName.toLowerCase();
    if (!ALLOWED_ELEMENTS_LC.has(tagNameLc)) {
      el.parentNode.removeChild(el);
      return;
    }

    const attrs = Array.from(el.attributes || []);
    for (const attr of attrs) {
      const attrNameLc = attr.name.toLowerCase();
      const attrVal = attr.value;

      // Check allowlist first: any non-allowlisted attribute (including event handlers onclick, onload, etc.) is dropped
      if (attrNameLc.startsWith('xmlns:')) {
        if (!ALLOWED_NAMESPACES.has(attrVal.trim())) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (attrNameLc === 'xmlns') {
        if (attrVal.trim() !== 'http://www.w3.org/2000/svg') {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      if (!ALLOWED_ATTRIBUTES_LC.has(attrNameLc)) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (['fill', 'stroke', 'clip-path', 'mask', 'filter'].includes(attrNameLc)) {
        if (/url\(/i.test(attrVal)) {
          if (!/^url\(\s*["']?#[a-zA-Z0-9_-]+["']?\s*\)$/.test(attrVal.trim())) {
            el.removeAttribute(attr.name);
            continue;
          }
        }
      }

      // SVG href and xlink:href policy: Strictly restrict to same-document fragments (^#[a-zA-Z0-9_-]+$)
      if (attrNameLc === 'href' || attrNameLc === 'xlink:href') {
        const trimmed = attrVal.trim();
        if (/^#[a-zA-Z0-9_-]+$/.test(trimmed)) {
          el.setAttribute(attr.name, trimmed);
        } else {
          el.removeAttribute(attr.name);
        }
        continue;
      }
    }

    const children = Array.from(el.childNodes || []);
    for (const child of children) {
      if (child.nodeType === 1) {
        sanitizeElement(child);
      } else if (child.nodeType !== 3) {
        child.parentNode.removeChild(child);
      }
    }
  }

  sanitizeElement(doc.documentElement);

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(doc);

  // Re-parse check to guarantee round-trip validity
  let reparseError = null;
  const reparser = new DOMParser({
    onError: (level, m) => {
      if (level === 'error' || level === 'fatalError') {
        reparseError = m;
      }
    }
  });
  const reDoc = reparser.parseFromString(serialized, 'application/xml');
  if (reparseError || !reDoc.documentElement) {
    throw new Error(`Sanitized SVG failed round-trip parse check: ${reparseError}`);
  }

  return serialized;
}
