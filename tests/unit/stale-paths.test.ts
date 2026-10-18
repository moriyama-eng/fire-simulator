import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('stale v2 path sweep', () => {
  const stalePaths = [
    'node cli.js',
    'js/app.js',
    'js/i18n.js',
    'js/headless.js',
    'js/analysis-runner.js',
    'js/analysis-ui.js',
    'js/comparison-runner.js',
    'js/comparison-ui.js',
    'js/comparison-state.js',
    'js/lang-detect.js',
    'js/core/aggregation.js',
    'js/core/factors.js',
    'js/core/format.js',
    'js/core/headless-params.js',
    'js/core/params.js',
    'js/core/percentile.js',
    'js/core/random.js',
    'js/core/simulation.js',
    'js/core/state.js',
    'js/core/url.js',
    'js/app/charts.js'
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

  it('confirms absence of obsolete v2 paths across docs/ (excluding only historic release-checklist.md)', () => {
    scanDirectory(path.resolve(process.cwd(), 'docs'), (name, full) => {
      // Exclude only the historic working release checklist
      const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
      if (rel === 'docs/internal/release-checklist.md') return false;
      return name.endsWith('.md');
    });
  });

  it('confirms absence of obsolete .test.js references across docs/ and READMEs', () => {
    const docsDir = path.resolve(process.cwd(), 'docs');
    const docFiles = [
      path.resolve(process.cwd(), 'README.md'),
      path.resolve(process.cwd(), 'README-ja.md')
    ];

    function collectMd(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectMd(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
          if (rel !== 'docs/internal/release-checklist.md') {
            docFiles.push(full);
          }
        }
      }
    }
    collectMd(docsDir);

    for (const file of docFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content, `File ${file} contains obsolete .test.js reference`).not.toMatch(/[a-zA-Z0-9_-]+\.test\.js\b/);
    }
  });

  it('confirms absence of local agent paths (.agent/, .agents/, AGENTS.md) across public codebase and tests', () => {
    const internalPaths = ['.' + 'agent/', '.' + 'agents/', 'AGENTS' + '.md'];
    const publicDirs = ['src', 'tests', 'docs', 'scripts'];

    for (const file of checkFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const p of internalPaths) {
        expect(content, `Public file ${file} contains internal path ${p}`).not.toContain(p);
      }
    }

    const scanForInternal = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanForInternal(full);
        } else if (entry.isFile() && !full.endsWith('stale-paths.test.ts')) {
          if (full.endsWith('.ts') || full.endsWith('.js') || full.endsWith('.mjs') || full.endsWith('.md') || full.endsWith('.html') || full.endsWith('.css')) {
            const content = fs.readFileSync(full, 'utf-8');
            for (const p of internalPaths) {
              expect(content, `File ${full} contains leaked internal path ${p}`).not.toContain(p);
            }
          }
        }
      }
    };

    for (const dirName of publicDirs) {
      scanForInternal(path.resolve(process.cwd(), dirName));
    }
  });
});

