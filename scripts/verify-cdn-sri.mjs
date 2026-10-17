import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_TARGETS = [
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    hash: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H',
    file: 'index.html',
    tag: 'script'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
    hash: 'sha384-BSxuMLxX+FCbTdYec3TbXlnMGEEM2QXTFdtDaveen71o+jswm2J36+xFqp8k4VHM',
    file: 'index.html',
    tag: 'script'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    hash: 'sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4',
    file: 'index.html',
    tag: 'script'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
    hash: 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+',
    file: 'docs.html',
    tag: 'link'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    hash: 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg',
    file: 'docs.html',
    tag: 'script'
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js',
    hash: 'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk',
    file: 'docs.html',
    tag: 'script'
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts: ${lastErr?.message}`);
}

export async function verifyCdnSri() {
  console.log('Verifying CDN script integrity (SRI)...');

  // Verify downloaded bytes match expected SRI hashes
  for (const target of EXPECTED_TARGETS) {
    console.log(`Fetching ${target.url}...`);
    const buffer = await fetchWithRetry(target.url);
    const computedHash = 'sha384-' + crypto.createHash('sha384').update(buffer).digest('base64');
    if (computedHash !== target.hash) {
      throw new Error(`Hash mismatch for ${target.url}!\n  Expected: ${target.hash}\n  Computed: ${computedHash}`);
    }
    console.log(`✓ Hash verified: ${target.url}`);
  }

  // Verify source files contain exact SRI attributes and crossorigin="anonymous"
  const fileCache = new Map();
  function getFileContent(rel) {
    if (!fileCache.has(rel)) {
      fileCache.set(rel, fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8'));
    }
    return fileCache.get(rel);
  }

  for (const target of EXPECTED_TARGETS) {
    const html = getFileContent(target.file);
    const escapedUrl = target.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = target.tag === 'link'
      ? new RegExp(`<link[^>]+href=["']${escapedUrl}["'][^>]*>`, 'i')
      : new RegExp(`<script[^>]+src=["']${escapedUrl}["'][^>]*>`, 'i');

    const match = html.match(pattern);
    if (!match) {
      throw new Error(`Missing ${target.tag} tag for ${target.url} in ${target.file}`);
    }

    const tagStr = match[0];
    if (!tagStr.includes(`integrity="${target.hash}"`)) {
      throw new Error(`Missing or mismatched integrity attribute for ${target.url} in ${target.file}: ${tagStr}`);
    }
    if (!tagStr.includes('crossorigin="anonymous"')) {
      throw new Error(`Missing crossorigin="anonymous" attribute for ${target.url} in ${target.file}: ${tagStr}`);
    }
  }

  console.log('✓ All CDN resources and HTML SRI attributes successfully verified.');
}

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
);

if (isDirectRun) {
  verifyCdnSri()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ verify-cdn-sri failed:', err);
      process.exit(1);
    });
}
