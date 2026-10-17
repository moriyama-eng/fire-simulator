import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('stale v2 path sweep', () => {
  const stalePaths = [
    'js/app.js',
    'js/i18n.js',
    'js/headless.js',
    'js/core/headless-params.js',
    'js/analysis-runner.js',
    'js/analysis-ui.js'
  ];

  const checkFiles = [
    path.resolve(process.cwd(), 'index.html'),
    path.resolve(process.cwd(), 'docs.html'),
    path.resolve(process.cwd(), 'README.md'),
    path.resolve(process.cwd(), 'README-ja.md')
  ];

  it('confirms absence of obsolete v2 paths in entry HTML and READMEs', () => {
    for (const file of checkFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const stale of stalePaths) {
        expect(content).not.toContain(stale);
      }
    }
  });

  function scanDirectory(dir: string, fileFilter: (name: string, fullPath: string) => boolean) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(full, fileFilter);
      } else if (entry.isFile() && fileFilter(entry.name, full)) {
        const content = fs.readFileSync(full, 'utf-8');
        for (const stale of stalePaths) {
          expect(content, `File ${full} contains stale path ${stale}`).not.toContain(stale);
        }
      }
    }
  }

  it('confirms absence of obsolete v2 paths across all src/ TypeScript files', () => {
    scanDirectory(path.resolve(process.cwd(), 'src'), (name) => name.endsWith('.ts') || name.endsWith('.js'));
  });

  it('confirms absence of obsolete v2 paths across scripts/, tests/, and .github/', () => {
    // Scripts
    scanDirectory(path.resolve(process.cwd(), 'scripts'), (name) => name.endsWith('.mjs') || name.endsWith('.js'));
    // Tests (exclude this file itself)
    scanDirectory(path.resolve(process.cwd(), 'tests'), (name, full) => {
      if (full.endsWith('stale-paths.test.ts')) return false;
      return name.endsWith('.ts') || name.endsWith('.js');
    });
    // .github workflows
    scanDirectory(path.resolve(process.cwd(), '.github'), (name) => name.endsWith('.yml') || name.endsWith('.yaml'));
  });

  it('confirms absence of obsolete v2 paths across public docs/', () => {
    scanDirectory(path.resolve(process.cwd(), 'docs'), (name, full) => {
      // Exclude internal release documentation which contains historical checklists
      const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
      if (rel.startsWith('docs/internal/')) return false;
      return name.endsWith('.md');
    });
  });
});
