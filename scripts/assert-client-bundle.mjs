import fs from 'node:fs';
import path from 'node:path';

export function assertClientBundle(clientDist = path.resolve(process.cwd(), 'dist', 'client')) {
  console.log('Asserting client bundle integrity in', clientDist);

  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
  const version = pkg.version;

  // 1. Check index.html and docs.html exist
  const indexPath = path.resolve(clientDist, 'index.html');
  const docsPath = path.resolve(clientDist, 'docs.html');
  if (!fs.existsSync(indexPath)) throw new Error('Missing dist/client/index.html');
  if (!fs.existsSync(docsPath)) throw new Error('Missing dist/client/docs.html');

  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  const docsHtml = fs.readFileSync(docsPath, 'utf-8');

  // 2. Version tag gate in index.html and docs.html
  const versionMetaTag = `<meta name="app-version" content="${version}">`;
  if (!indexHtml.includes(versionMetaTag)) {
    throw new Error(`index.html is missing version meta tag: ${versionMetaTag}`);
  }
  if (!docsHtml.includes(versionMetaTag)) {
    throw new Error(`docs.html is missing version meta tag: ${versionMetaTag}`);
  }

  // 3. Single controller assert on docs.html
  const moduleScripts = docsHtml.match(/<script[^>]+type=["']module["'][^>]*>/gi) || [];
  if (moduleScripts.length !== 1) {
    throw new Error(`docs.html must have exactly 1 module script, found ${moduleScripts.length}`);
  }
  const inlineScripts = docsHtml.match(/<script(?![^>]+src=)[^>]*>[\s\S]*?<\/script>/gi) || [];
  if (inlineScripts.length > 0) {
    throw new Error(`docs.html contains forbidden inline script controllers: ${inlineScripts.length}`);
  }

  // 4. Stylesheet gate: index.html and docs.html have stylesheet link to ./assets/*.css, size > 0
  const indexCssMatch = indexHtml.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](\.\/assets\/[^"']+\.css)["']/i) ||
                        indexHtml.match(/<link[^>]+href=["'](\.\/assets\/[^"']+\.css)["'][^>]+rel=["']stylesheet["']/i);
  if (!indexCssMatch) throw new Error('index.html is missing stylesheet link pointing to ./assets/*.css');
  const indexCssFile = path.resolve(clientDist, indexCssMatch[1].replace(/^\.\//, ''));
  if (!fs.existsSync(indexCssFile) || fs.statSync(indexCssFile).size === 0) {
    throw new Error(`Stylesheet referenced by index.html does not exist or is empty: ${indexCssFile}`);
  }

  const docsCssMatch = docsHtml.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](\.\/assets\/[^"']+\.css)["']/i) ||
                       docsHtml.match(/<link[^>]+href=["'](\.\/assets\/[^"']+\.css)["'][^>]+rel=["']stylesheet["']/i);
  if (!docsCssMatch) throw new Error('docs.html is missing stylesheet link pointing to ./assets/*.css');
  const docsCssFile = path.resolve(clientDist, docsCssMatch[1].replace(/^\.\//, ''));
  if (!fs.existsSync(docsCssFile) || fs.statSync(docsCssFile).size === 0) {
    throw new Error(`Stylesheet referenced by docs.html does not exist or is empty: ${docsCssFile}`);
  }

  // 5. SRI integrity gate in index.html
  const sriExpected = [
    { url: 'html2canvas', hash: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H' },
    { url: 'Sortable.min.js', hash: 'sha384-BSxuMLxX+FCbTdYec3TbXlnMGEEM2QXTFdtDaveen71o+jswm2J36+xFqp8k4VHM' },
    { url: 'chart.umd.min.js', hash: 'sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4' }
  ];
  for (const { url, hash } of sriExpected) {
    if (!indexHtml.includes(hash)) {
      throw new Error(`index.html is missing SRI hash ${hash} for ${url}`);
    }
  }

  // 5b. SRI integrity gate in docs.html
  const docsSriExpected = [
    { url: 'katex.min.css', hash: 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+' },
    { url: 'katex.min.js', hash: 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg' },
    { url: 'auto-render.min.js', hash: 'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk' }
  ];
  for (const { url, hash } of docsSriExpected) {
    if (!docsHtml.includes(hash)) {
      throw new Error(`docs.html is missing SRI hash ${hash} for ${url}`);
    }
  }

  // 6. Positive docs asset assertions
  const positiveDocsFiles = [
    'docs/manifest.json',
    'docs/guide/getting-started.md',
    'docs/assets/readme/fire-simulator-overview.png'
  ];
  for (const rel of positiveDocsFiles) {
    const p = path.resolve(clientDist, rel);
    if (!fs.existsSync(p)) throw new Error(`Positive docs asset missing: ${rel}`);
    if (fs.statSync(p).size === 0) throw new Error(`Positive docs asset is empty: ${rel}`);
  }

  // 7. Negative docs asset assertions
  const docsDistDir = path.resolve(clientDist, 'docs');
  const FORBIDDEN_EXTS = new Set(['.html', '.htm', '.xhtml', '.js', '.mjs', '.svgz', '.shtml', '.xsl']);

  function scanDocs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryNameLc = entry.name.toLowerCase();
      if (entryNameLc === 'internal' || entryNameLc.startsWith('internal.')) {
        throw new Error(`Forbidden internal segment found in client docs: ${path.join(dir, entry.name)}`);
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDocs(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (FORBIDDEN_EXTS.has(ext)) {
          throw new Error(`Forbidden extension file found in client docs: ${fullPath}`);
        }

        if (ext === '.svg') {
          const svgContent = fs.readFileSync(fullPath, 'utf-8');
          if (/<script\b/i.test(svgContent)) {
            throw new Error(`SVG contains script tag: ${fullPath}`);
          }
          if (/\bon[a-z]+\s*=/i.test(svgContent)) {
            throw new Error(`SVG contains inline event handler: ${fullPath}`);
          }
          if (/javascript:/i.test(svgContent)) {
            throw new Error(`SVG contains javascript: URI: ${fullPath}`);
          }
          if (/<foreignObject\b/i.test(svgContent)) {
            throw new Error(`SVG contains foreignObject tag: ${fullPath}`);
          }
          const hrefMatches = svgContent.match(/\b(?:href|xlink:href)\s*=\s*["']([^"']*)["']/gi) || [];
          for (const match of hrefMatches) {
            const val = match.replace(/^[^=]+=\s*["']/, '').replace(/["']$/, '').trim();
            if (val && !val.startsWith('#')) {
              throw new Error(`SVG contains external href: ${fullPath} (${match})`);
            }
          }
        }
      }
    }
  }
  scanDocs(docsDistDir);

  // 8. Dependency isolation assert in dist/client/assets/*.js
  const assetsDir = path.resolve(clientDist, 'assets');
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8');
    if (content.includes('node:fs') || content.includes('@xmldom/xmldom') || content.includes('from"fs"') || content.includes('from "fs"')) {
      throw new Error(`Client JS chunk ${jsFile} improperly imports server dependency node:fs or @xmldom/xmldom`);
    }
  }

  // 9. Dynamic worker resolution: entry chunk references worker chunk correctly, no assets/assets/
  const entryMatch = indexHtml.match(/<script[^>]+type=["']module["'][^>]+src=["'](\.\/assets\/[^"']+\.js)["']/i) ||
                     indexHtml.match(/<script[^>]+src=["'](\.\/assets\/[^"']+\.js)["'][^>]+type=["']module["']/i);
  if (!entryMatch) throw new Error('index.html is missing module entry script pointing to ./assets/*.js');
  const entryJsFile = path.resolve(clientDist, entryMatch[1].replace(/^\.\//, ''));
  const entryContent = fs.readFileSync(entryJsFile, 'utf-8');

  // Look for worker constructor new Worker(new URL("...", import.meta.url))
  const workerUrlMatch = entryContent.match(/new\s+URL\(["']([^"']+)["'],\s*import\.meta\.url\)/);
  if (workerUrlMatch) {
    const workerRel = workerUrlMatch[1];
    if (workerRel.includes('assets/assets/')) {
      throw new Error(`Duplicated assets path in worker specifier: ${workerRel}`);
    }
    const resolvedWorker = path.resolve(path.dirname(entryJsFile), workerRel);
    if (!fs.existsSync(resolvedWorker)) {
      throw new Error(`Worker chunk does not exist: ${resolvedWorker}`);
    }
  }

  console.log('✓ All client bundle assertions passed successfully.');
}

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
);

if (isDirectRun) {
  try {
    assertClientBundle();
    process.exit(0);
  } catch (err) {
    console.error('✗ assert-client-bundle failed:', err);
    process.exit(1);
  }
}
