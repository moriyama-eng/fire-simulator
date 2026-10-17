import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { MIME_MAP } from './lib/confinement.mjs';

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  return MIME_MAP[ext] || 'application/octet-stream';
}

function httpGetRaw(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: reqPath,
      headers: { Host: `127.0.0.1:${port}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: {
          get: (k) => res.headers[k.toLowerCase()]
        },
        text: () => Promise.resolve(data)
      }));
    });
    req.on('error', reject);
  });
}

export async function runSubpathSmoke(clientDist = path.resolve(process.cwd(), 'dist', 'client')) {
  console.log('Starting ephemeral subpath smoke server...');

  if (!fs.existsSync(clientDist)) {
    throw new Error(`Client build directory does not exist: ${clientDist}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
  const version = pkg.version;

  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '';
    const [pathname] = rawUrl.split('?');

    if (pathname === '/fire-simulator') {
      res.writeHead(301, { Location: '/fire-simulator/' });
      res.end();
      return;
    }

    if (!pathname.startsWith('/fire-simulator/')) {
      res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
      res.end('Not Found');
      return;
    }

    // Fixed-point decode for traversal inspection
    let decodedPath = pathname;
    let prev = '';
    let iter = 0;
    while (decodedPath !== prev && iter < 10) {
      prev = decodedPath;
      iter++;
      try {
        decodedPath = decodeURIComponent(decodedPath);
      } catch {
        res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
        res.end('Not Found');
        return;
      }
    }

    const subPath = decodedPath.slice('/fire-simulator/'.length);

    // Negative confinement check on request path
    const segments = subPath.split(/[\\/]/);
    for (const seg of segments) {
      const segLower = seg.toLowerCase();
      if (seg === '..' || /^[A-Za-z]:/.test(seg) || segLower === 'internal' || segLower.startsWith('internal.')) {
        res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
        res.end('Not Found');
        return;
      }
    }

    // Docs security: no HTML or script files allowed under docs/
    if (subPath.startsWith('docs/')) {
      const docsRel = subPath.slice('docs/'.length);
      const ext = path.extname(docsRel).toLowerCase();
      if (!MIME_MAP[ext]) {
        res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
        res.end('Not Found');
        return;
      }
    }

    let filePath;
    if (subPath === '' || subPath === 'index.html') {
      filePath = path.resolve(clientDist, 'index.html');
    } else {
      filePath = path.resolve(clientDist, subPath);
    }

    if (!filePath.startsWith(clientDist) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
      res.end('Not Found');
      return;
    }

    const mime = getMime(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/fire-simulator`;

  try {
    console.log(`Subpath server listening at ${baseUrl}/`);

    // 1. Root redirect check
    const r1 = await fetch(baseUrl, { redirect: 'manual' });
    if (r1.status !== 301 || r1.headers.get('location') !== '/fire-simulator/') {
      throw new Error(`Expected redirect 301 to /fire-simulator/, got ${r1.status}`);
    }
    console.log('✓ Redirect check passed');

    // 2. Root HTML check
    const r2 = await fetch(`${baseUrl}/`);
    if (r2.status !== 200) throw new Error(`Root HTML failed: ${r2.status}`);
    const htmlText = await r2.text();
    if (!htmlText.includes(`<meta name="app-version" content="${version}">`)) {
      throw new Error('Root HTML missing version meta tag');
    }
    console.log('✓ Root HTML check passed');

    // Dynamically parse index.html script and stylesheet paths
    const cssMatch = htmlText.match(/href=["'](\.\/assets\/[^"']+\.css)["']/);
    if (!cssMatch) throw new Error('Could not find stylesheet link in index.html');
    const scriptMatch = htmlText.match(/src=["'](\.\/assets\/[^"']+\.js)["']/);
    if (!scriptMatch) throw new Error('Could not find script tag in index.html');

    const cssUrl = `${baseUrl}/${cssMatch[1].replace(/^\.\//, '')}`;
    const scriptUrl = `${baseUrl}/${scriptMatch[1].replace(/^\.\//, '')}`;

    // 3. Stylesheet check
    const rCss = await fetch(cssUrl);
    if (rCss.status !== 200 || !rCss.headers.get('content-type')?.includes('text/css')) {
      throw new Error(`Stylesheet fetch failed: status ${rCss.status}`);
    }
    console.log('✓ Stylesheet check passed');

    // 4. Main script check
    const rScript = await fetch(scriptUrl);
    if (rScript.status !== 200 || !rScript.headers.get('content-type')?.includes('javascript')) {
      throw new Error(`Main script fetch failed: status ${rScript.status}`);
    }
    const scriptContent = await rScript.text();
    console.log('✓ Main script check passed');

    // 5. Worker check (dynamic resolution from script body)
    const workerMatch = scriptContent.match(/new\s+URL\(["']([^"']+)["'],\s*import\.meta\.url\)/);
    if (workerMatch) {
      const workerRel = workerMatch[1];
      if (workerRel.includes('assets/assets/')) {
        throw new Error(`Worker specifier has duplicated assets path: ${workerRel}`);
      }
      const workerUrl = new URL(workerRel, scriptUrl).href;
      const rWorker = await fetch(workerUrl);
      if (rWorker.status !== 200 || !rWorker.headers.get('content-type')?.includes('javascript')) {
        throw new Error(`Worker fetch failed: status ${rWorker.status}`);
      }
      console.log('✓ Worker dynamic resolution check passed');
    }

    // 6. Docs HTML check
    const rDocs = await fetch(`${baseUrl}/docs.html`);
    if (rDocs.status !== 200) throw new Error(`Docs HTML failed: ${rDocs.status}`);
    const docsHtmlText = await rDocs.text();
    if (!docsHtmlText.includes(`<meta name="app-version" content="${version}">`)) {
      throw new Error('Docs HTML missing version meta tag');
    }
    console.log('✓ Docs HTML check passed');

    // 7. Docs manifest check
    const rManifest = await fetch(`${baseUrl}/docs/manifest.json`);
    if (rManifest.status !== 200) throw new Error(`Manifest failed: ${rManifest.status}`);
    const manifestJson = await rManifest.json();
    if (!manifestJson.categories || !Array.isArray(manifestJson.categories)) {
      throw new Error('Manifest json is invalid');
    }
    console.log('✓ Docs manifest check passed');

    // 8. Docs markdown check
    const rMd = await fetch(`${baseUrl}/docs/guide/getting-started.md`);
    if (rMd.status !== 200) throw new Error(`Markdown failed: ${rMd.status}`);
    const mdText = await rMd.text();
    if (!mdText.includes('# Getting Started')) {
      throw new Error('Getting started markdown missing expected title');
    }
    console.log('✓ Docs markdown check passed');

    // 9. Docs image check
    const rImg = await fetch(`${baseUrl}/docs/assets/readme/fire-simulator-overview.png`);
    if (rImg.status !== 200 || !rImg.headers.get('content-type')?.includes('image/png')) {
      throw new Error(`Image check failed: ${rImg.status}`);
    }
    console.log('✓ Docs image check passed');

    // 10. Traversal security checks (must be 404 with nosniff)
    const testCases404 = [
      '/fire-simulator/docs/../index.html',
      '/fire-simulator/docs/%2e%2e/index.html',
      '/fire-simulator/docs/internal/testing-guide.md',
      '/fire-simulator/docs/C:/boot.ini'
    ];
    for (const testPath of testCases404) {
      const res = await httpGetRaw(port, testPath);
      if (res.status !== 404 || res.headers.get('x-content-type-options') !== 'nosniff') {
        throw new Error(`Expected 404 with nosniff for ${testPath}, got ${res.status}`);
      }
    }
    console.log('✓ Traversal security checks passed');

    // 11. Staged test.html security check
    const stagedFile = path.resolve(clientDist, 'docs', 'test.html');
    fs.writeFileSync(stagedFile, '<html><body>danger</body></html>', 'utf-8');
    try {
      const resStaged = await fetch(`${baseUrl}/docs/test.html`);
      if (resStaged.status !== 404 || resStaged.headers.get('x-content-type-options') !== 'nosniff') {
        throw new Error(`Expected 404 with nosniff for staged docs/test.html, got ${resStaged.status}`);
      }
      console.log('✓ Staged HTML refusal check passed');
    } finally {
      if (fs.existsSync(stagedFile)) {
        fs.unlinkSync(stagedFile);
      }
    }

    console.log('✓ All subpath smoke checks passed successfully!');
  } finally {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
);

if (isDirectRun) {
  runSubpathSmoke()
    .catch((err) => {
      console.error('✗ smoke-subpath-server failed:', err);
      process.exit(1);
    });
}
