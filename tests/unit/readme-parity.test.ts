import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CANONICAL_MAPPING: [string, string][] = [
  ['## Overview', '## 概要'],
  ['## Screenshot', '## スクリーンショット'],
  ['## Simulation Model', '## シミュレーションモデル'],
  ['## Ways to Use It', '## 使い方'],
  ['## Features', '## 主な機能'],
  ['## Privacy', '## プライバシー'],
  ['## Deliberate Scope', '## 意図的なスコープ制限'],
  ['## Documentation', '## ドキュメント'],
  ['## Version / Update History', '## バージョン / 更新履歴'],
  ['## CLI', '## CLI'],
  ['## Disclaimer', '## 免責事項'],
  ['## License', '## ライセンス']
];

const REQUIRED_ANCHORS = [
  'Node.js >= 22',
  'npm install',
  'npm run dev',
  'localhost:5173',
  'npm run watch:css',
  'npm run typecheck',
  'npm test',
  'npm run build',
  'npm run preview',
  'localhost:4173',
  'scripts/smoke-subpath-server.mjs',
  'node dist/cli.js'
];

describe('README pairwise parity and section structure', () => {
  const enReadme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf-8');
  const jaReadme = fs.readFileSync(path.resolve(process.cwd(), 'README-ja.md'), 'utf-8');

  it('contains exactly 12 H2 headings in both README files', () => {
    // Regex /^## [^#]/m strictly matches H2 and rejects H3 (###)
    const enH2 = (enReadme.match(/^## [^#\r\n]+/gm) || []).map(s => s.trim());
    const jaH2 = (jaReadme.match(/^## [^#\r\n]+/gm) || []).map(s => s.trim());

    expect(enH2.length).toBe(12);
    expect(jaH2.length).toBe(12);

    for (let i = 0; i < CANONICAL_MAPPING.length; i++) {
      expect(enH2[i]).toBe(CANONICAL_MAPPING[i][0]);
      expect(jaH2[i]).toBe(CANONICAL_MAPPING[i][1]);
    }
  });

  it('contains all 12 literal technical anchors within ### Local Development in README.md', () => {
    const startIdx = enReadme.indexOf('### Local Development');
    expect(startIdx).toBeGreaterThan(-1);

    const nextH2 = enReadme.indexOf('## Features', startIdx);
    expect(nextH2).toBeGreaterThan(startIdx);

    const slice = enReadme.slice(startIdx, nextH2);

    for (const anchor of REQUIRED_ANCHORS) {
      expect(slice).toContain(anchor);
    }
  });

  it('contains all 12 literal technical anchors within ### ローカル開発 in README-ja.md', () => {
    const startIdx = jaReadme.indexOf('### ローカル開発');
    expect(startIdx).toBeGreaterThan(-1);

    const nextH2 = jaReadme.indexOf('## 主な機能', startIdx);
    expect(nextH2).toBeGreaterThan(startIdx);

    const slice = jaReadme.slice(startIdx, nextH2);

    for (const anchor of REQUIRED_ANCHORS) {
      expect(slice).toContain(anchor);
    }
  });

  it('confirms Simulation Model contains exactly 7 concepts in both READMEs', () => {
    const enStart = enReadme.indexOf('## Simulation Model');
    const enEnd = enReadme.indexOf('## Ways to Use It', enStart);
    const enSlice = enReadme.slice(enStart, enEnd);
    const enConcepts = enSlice.match(/^- \*\*[^*]+\*\*/gm) || [];
    expect(enConcepts.length).toBe(7);

    const jaStart = jaReadme.indexOf('## シミュレーションモデル');
    const jaEnd = jaReadme.indexOf('## 使い方', jaStart);
    const jaSlice = jaReadme.slice(jaStart, jaEnd);
    const jaConcepts = jaSlice.match(/^- \*\*[^*]+\*\*/gm) || [];
    expect(jaConcepts.length).toBe(7);
  });

  it('confirms Features contains exactly 8 fixed items in both READMEs', () => {
    const enStart = enReadme.indexOf('## Features');
    const enEnd = enReadme.indexOf('## Privacy', enStart);
    const enSlice = enReadme.slice(enStart, enEnd);
    const enFeatures = enSlice.match(/^\d+\.\s+\*\*[^*]+\*\*/gm) || [];
    expect(enFeatures.length).toBe(8);

    const jaStart = jaReadme.indexOf('## 主な機能');
    const jaEnd = jaReadme.indexOf('## プライバシー', jaStart);
    const jaSlice = jaReadme.slice(jaStart, jaEnd);
    const jaFeatures = jaSlice.match(/^\d+\.\s+\*\*[^*]+\*\*/gm) || [];
    expect(jaFeatures.length).toBe(8);
  });

  it('confirms Privacy contains exactly 4 semantic sections in both READMEs', () => {
    const enStart = enReadme.indexOf('## Privacy');
    const enEnd = enReadme.indexOf('## Deliberate Scope', enStart);
    const enSlice = enReadme.slice(enStart, enEnd);
    const enSections = (enSlice.match(/^###\s+[^\r\n]+/gm) || []).map(s => s.trim());
    expect(enSections).toEqual([
      '### Local Processing',
      '### External Resources',
      '### Explicit Sharing',
      '### Automatic Transmission'
    ]);

    const jaStart = jaReadme.indexOf('## プライバシー');
    const jaEnd = jaReadme.indexOf('## 意図的なスコープ制限', jaStart);
    const jaSlice = jaReadme.slice(jaStart, jaEnd);
    const jaSections = (jaSlice.match(/^###\s+[^\r\n]+/gm) || []).map(s => s.trim());
    expect(jaSections).toEqual([
      '### ローカル処理',
      '### 外部リソース',
      '### 明示的な共有',
      '### 自動送信'
    ]);
  });

  it('confirms Deliberate Scope contains exactly 3 intentional limitations in both READMEs', () => {
    const enStart = enReadme.indexOf('## Deliberate Scope');
    const enEnd = enReadme.indexOf('## Documentation', enStart);
    const enSlice = enReadme.slice(enStart, enEnd);
    const enLimits = enSlice.match(/^- \*\*[^*]+\*\*/gm) || [];
    expect(enLimits.length).toBe(3);

    const jaStart = jaReadme.indexOf('## 意図的なスコープ制限');
    const jaEnd = jaReadme.indexOf('## ドキュメント', jaStart);
    const jaSlice = jaReadme.slice(jaStart, jaEnd);
    const jaLimits = jaSlice.match(/^- \*\*[^*]+\*\*/gm) || [];
    expect(jaLimits.length).toBe(3);
  });

  it('confirms screenshot asset exists on disk and is referenced in both READMEs', () => {
    const assetRelPath = 'docs/assets/readme/fire-simulator-overview.png';
    const assetFullPath = path.resolve(process.cwd(), assetRelPath);
    expect(fs.existsSync(assetFullPath)).toBe(true);
    expect(enReadme).toContain(`./${assetRelPath}`);
    expect(jaReadme).toContain(`./${assetRelPath}`);
  });

  it('confirms #currency-semantics anchor resolves in both READMEs', () => {
    const anchorToken = '<a name="currency-semantics"></a>';
    expect(enReadme).toContain(anchorToken);
    expect(jaReadme).toContain(anchorToken);
  });

  it('confirms docs/guide/overview.md content consistency with README source sections', () => {
    const overviewPath = path.resolve(process.cwd(), 'docs/guide/overview.md');
    expect(fs.existsSync(overviewPath)).toBe(true);
    const overview = fs.readFileSync(overviewPath, 'utf-8');

    const normOverview = overview.replace(/\r\n/g, '\n');
    const normEnReadme = enReadme.replace(/\r\n/g, '\n');

    // Overview intro paragraphs
    const overviewIntro = 'FIRE Monte Carlo Simulator is a browser-based tool that runs Monte Carlo simulations to explore retirement asset sustainability under user-defined financial assumptions.';
    expect(normOverview).toContain(overviewIntro);
    expect(normEnReadme).toContain(overviewIntro);

    // Psychological Load paragraph
    const psychStart = normEnReadme.indexOf('### Psychological Load');
    const psychEnd = normEnReadme.indexOf('---', psychStart);
    const psychText = normEnReadme.slice(psychStart, psychEnd).trim();
    expect(normOverview).toContain(psychText);

    // Privacy sections
    expect(normOverview).toContain('### Local Processing');
    expect(normOverview).toContain('### External Resources');
    expect(normOverview).toContain('### Explicit Sharing');
    expect(normOverview).toContain('### Automatic Transmission');

    // Deliberate Scope limitations
    expect(normOverview).toContain('**Taxation**');
    expect(normOverview).toContain('**Variable foreign-exchange modeling**');
    expect(normOverview).toContain('**Social security / pension systems**');

    // Disclaimer paragraph
    const discStart = normEnReadme.indexOf('## Disclaimer');
    const discEnd = normEnReadme.indexOf('## License', discStart);
    const discSlice = normEnReadme.slice(discStart, discEnd);
    const discParagraph = discSlice.replace(/## Disclaimer\s+/, '').replace(/---\s*$/, '').trim();
    expect(normOverview).toContain(discParagraph);
  });
});
