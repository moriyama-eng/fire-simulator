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
});
