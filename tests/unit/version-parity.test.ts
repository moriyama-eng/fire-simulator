import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('version parity across all 11 surfaces', () => {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'));
  const version: string = pkg.version;

  it('validates canonical version format in package.json', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('verifies version parity across package-lock.json top and packages[""]', () => {
    const lock = JSON.parse(fs.readFileSync(path.resolve(root, 'package-lock.json'), 'utf-8'));
    expect(lock.version).toBe(version);
    expect(lock.packages?.['']?.version).toBe(version);
  });

  it('verifies version parity in src/i18n.ts fallback', () => {
    const i18nContent = fs.readFileSync(path.resolve(root, 'src/i18n.ts'), 'utf-8');
    const match = i18nContent.match(/function getAppVersion\(\): string \{[\s\S]*?return\s+['"]([^'"]+)['"]/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in src/cli.ts fallback', () => {
    const cliContent = fs.readFileSync(path.resolve(root, 'src/cli.ts'), 'utf-8');
    const match = cliContent.match(/function getPackageVersion\(\): string \{[\s\S]*?return\s+['"]([^'"]+)['"]/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in index.html (meta, query, footer, url)', () => {
    const indexHtml = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8');
    const metaMatch = indexHtml.match(/<meta\s+name="app-version"\s+content="([^"]+)">/);
    expect(metaMatch?.[1]).toBe(version);

    expect(indexHtml).toContain(`css/tailwind.css?v=${version}`);
    expect(indexHtml).toContain(`css/style.css?v=${version}`);
    expect(indexHtml).toContain(`<span>v${version}</span>`);
    expect(indexHtml).toMatch(new RegExp(`id="capFooterUrl"[^>]*>[\\s\\S]*?\\|\\s*v${version.replace(/\./g, '\\.')}<\\/span>`));
  });

  it('verifies version parity in docs.html meta tag', () => {
    const docsHtml = fs.readFileSync(path.resolve(root, 'docs.html'), 'utf-8');
    const metaMatch = docsHtml.match(/<meta\s+name="app-version"\s+content="([^"]+)">/);
    expect(metaMatch?.[1]).toBe(version);
  });

  it('verifies version parity in README.md current release marker', () => {
    const readme = fs.readFileSync(path.resolve(root, 'README.md'), 'utf-8');
    const match = readme.match(/\*\*Current release:\s*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in README-ja.md current release marker', () => {
    const readmeJa = fs.readFileSync(path.resolve(root, 'README-ja.md'), 'utf-8');
    const match = readmeJa.match(/\*\*現行リリース:\s*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in CHANGELOG.md latest release heading', () => {
    const changelog = fs.readFileSync(path.resolve(root, 'CHANGELOG.md'), 'utf-8');
    const match = changelog.match(/##\s*\[v?([0-9]+\.[0-9]+\.[0-9]+)\]/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in CHANGELOG-ja.md latest release heading', () => {
    const changelogJa = fs.readFileSync(path.resolve(root, 'CHANGELOG-ja.md'), 'utf-8');
    const match = changelogJa.match(/##\s*\[v?([0-9]+\.[0-9]+\.[0-9]+)\]/);
    expect(match?.[1]).toBe(version);
  });

  it('verifies version parity in docs/internal/style-guide.md CSS query example', () => {
    const styleGuide = fs.readFileSync(path.resolve(root, 'docs/internal/style-guide.md'), 'utf-8');
    const twMatch = styleGuide.match(/css\/tailwind\.css\?v=([0-9]+\.[0-9]+\.[0-9]+)/);
    expect(twMatch?.[1]).toBe(version);
    const styleMatch = styleGuide.match(/css\/style\.css\?v=([0-9]+\.[0-9]+\.[0-9]+)/);
    expect(styleMatch?.[1]).toBe(version);
  });
});
