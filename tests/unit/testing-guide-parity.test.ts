import { describe, it, expect } from 'vitest';
import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('testing-guide parity verification', { timeout: 30000 }, () => {
  const root = process.cwd();
  const guidePath = path.resolve(root, 'docs/internal/testing-guide.md');

  it('verifies test file and case counts in testing-guide.md match live vitest list', () => {
    // Fast skip in watch mode to avoid spawning nested vitest runners
    if (process.env.VITEST_WATCH || process.env.WATCH) {
      return;
    }

    const env = { ...process.env };
    delete env.VITEST;
    delete env.VITEST_WORKER_ID;

    const vitestMjs = path.resolve(root, 'node_modules/vitest/vitest.mjs');
    const res = child_process.spawnSync(process.execPath, [vitestMjs, 'list', '--json'], {
      cwd: root,
      env,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });

    if (res.error) {
      throw new Error(`Failed to spawn vitest list: ${res.error.message}`);
    }

    expect(res.status, `vitest list failed with code ${res.status}: ${res.stderr}`).toBe(0);

    interface VitestItem {
      name: string;
      file: string;
    }

    const list: VitestItem[] = JSON.parse(res.stdout);

    let actualUnitCases = 0;
    let actualIntegrationCases = 0;
    const actualUnitFiles = new Set<string>();
    const actualIntegrationFiles = new Set<string>();
    const unexpectedFiles = new Set<string>();

    for (const item of list) {
      const norm = item.file.replace(/\\/g, '/');
      if (norm.includes('/tests/unit/')) {
        actualUnitCases++;
        actualUnitFiles.add(norm);
      } else if (norm.includes('/tests/integration/')) {
        actualIntegrationCases++;
        actualIntegrationFiles.add(norm);
      } else {
        unexpectedFiles.add(norm);
      }
    }

    const actualTotalFiles = actualUnitFiles.size + actualIntegrationFiles.size;
    const actualTotalCases = actualUnitCases + actualIntegrationCases;

    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    // Extract intro header count (around line 13)
    const introMatch = guideContent.match(/across\s+(\d+)\s+TypeScript test files/);
    const docIntroTotalFiles = introMatch ? parseInt(introMatch[1], 10) : null;

    // Extract table rows (lines 17-19)
    const unitRowMatch = guideContent.match(/\|\s*Unit tests\s*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+)\s*files\s*\((\d+)\s*test cases\)\s*\|/);
    const intRowMatch = guideContent.match(/\|\s*Integration tests\s*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+)\s*files\s*\((\d+)\s*test cases\)\s*\|/);
    const totalRowMatch = guideContent.match(/\|\s*\*\*Total\*\*\s*\|[^|]*\|[^|]*\|[^|]*\|\s*\*\*(\d+)\s*files\s*\((\d+)\s*test cases\)\*\*\s*\|/);

    const docUnitFiles = unitRowMatch ? parseInt(unitRowMatch[1], 10) : null;
    const docUnitCases = unitRowMatch ? parseInt(unitRowMatch[2], 10) : null;
    const docIntFiles = intRowMatch ? parseInt(intRowMatch[1], 10) : null;
    const docIntCases = intRowMatch ? parseInt(intRowMatch[2], 10) : null;
    const docTotalFiles = totalRowMatch ? parseInt(totalRowMatch[1], 10) : null;
    const docTotalCases = totalRowMatch ? parseInt(totalRowMatch[2], 10) : null;

    const diagnostic = `
[DIAGNOSTIC] Test counts in docs/internal/testing-guide.md lines 17-19 need updating to match live test suite!
Documented in guide:
  - Intro total files: ${docIntroTotalFiles}
  - Unit: ${docUnitFiles} files (${docUnitCases} test cases)
  - Integration: ${docIntFiles} files (${docIntCases} test cases)
  - Total: ${docTotalFiles} files (${docTotalCases} test cases)
Actual live counts:
  - Unit: ${actualUnitFiles.size} files (${actualUnitCases} test cases)
  - Integration: ${actualIntegrationFiles.size} files (${actualIntegrationCases} test cases)
  - Total: ${actualTotalFiles} files (${actualTotalCases} test cases)
`;

    const errors: string[] = [];
    if (unexpectedFiles.size > 0) {
      errors.push(`Found test files outside tests/unit/ and tests/integration/: ${[...unexpectedFiles].join(', ')}`);
    }
    if (docIntroTotalFiles !== actualTotalFiles) {
      errors.push(`Intro header file count mismatch: documented ${docIntroTotalFiles}, live ${actualTotalFiles}`);
    }
    if (docUnitFiles !== actualUnitFiles.size) {
      errors.push(`Unit files count mismatch (line 17): documented ${docUnitFiles}, live ${actualUnitFiles.size}`);
    }
    if (docUnitCases !== actualUnitCases) {
      errors.push(`Unit test cases count mismatch (line 17): documented ${docUnitCases}, live ${actualUnitCases}`);
    }
    if (docIntFiles !== actualIntegrationFiles.size) {
      errors.push(`Integration files count mismatch (line 18): documented ${docIntFiles}, live ${actualIntegrationFiles.size}`);
    }
    if (docIntCases !== actualIntegrationCases) {
      errors.push(`Integration test cases count mismatch (line 18): documented ${docIntCases}, live ${actualIntegrationCases}`);
    }
    if (docTotalFiles !== actualTotalFiles) {
      errors.push(`Total files count mismatch (line 19): documented ${docTotalFiles}, live ${actualTotalFiles}`);
    }
    if (docTotalCases !== actualTotalCases) {
      errors.push(`Total test cases count mismatch (line 19): documented ${docTotalCases}, live ${actualTotalCases}`);
    }

    expect(errors, `${diagnostic}\n${errors.join('\n')}`).toEqual([]);
  }, 30000);

  it('verifies bidirectional parity between Section 1.1 module map and disk test files', () => {
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    const startSection11 = guideContent.indexOf('### 1.1 Test Target Module Map');
    expect(startSection11, 'Section 1.1 not found').toBeGreaterThan(-1);

    const endSection11 = guideContent.indexOf('### 1.2 Coverage Targets', startSection11);
    expect(endSection11, 'Section 1.2 not found').toBeGreaterThan(startSection11);

    const section11Text = guideContent.slice(startSection11, endSection11);

    // Extract all test files referenced in Section 1.1
    const testFileMatches = section11Text.match(/tests\/(?:unit|integration)\/[a-zA-Z0-9_-]+\.test\.ts/g) || [];
    const mappedFiles = new Set(testFileMatches.map(f => f.replace(/\\/g, '/')));

    // 1. Verify all test files mentioned in Section 1.1 exist on disk
    const missingOnDisk: string[] = [];
    for (const mapped of mappedFiles) {
      if (!fs.existsSync(path.resolve(root, mapped))) {
        missingOnDisk.push(mapped);
      }
    }
    expect(
      missingOnDisk,
      `Test files mentioned in Section 1.1 that do not exist on disk: ${missingOnDisk.join(', ')}`
    ).toEqual([]);

    // 2. Discover all test files on disk recursively under tests/
    function collectAllTestFiles(dir: string): string[] {
      let results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(collectAllTestFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          results.push(path.relative(root, full).replace(/\\/g, '/'));
        }
      }
      return results;
    }

    const diskFiles = collectAllTestFiles(path.resolve(root, 'tests'));

    // Verify all test files reside strictly in tests/unit/ or tests/integration/
    const misplacedTests = diskFiles.filter(f => !f.startsWith('tests/unit/') && !f.startsWith('tests/integration/'));
    expect(
      misplacedTests,
      `Test files located outside tests/unit/ and tests/integration/: ${misplacedTests.join(', ')}`
    ).toEqual([]);

    // Verify all test files on disk are mapped in Section 1.1
    const unmappedOnDisk: string[] = [];
    for (const diskFile of diskFiles) {
      if (!mappedFiles.has(diskFile)) {
        unmappedOnDisk.push(diskFile);
      }
    }
    expect(
      unmappedOnDisk,
      `Test files on disk missing from Section 1.1 module map: ${unmappedOnDisk.join(', ')}`
    ).toEqual([]);
  });

  it('verifies all target modules in Section 1.1 and all tests/helpers and tests/fixtures paths in testing-guide.md exist on disk', () => {
    const guideContent = fs.readFileSync(guidePath, 'utf-8');

    const startSection11 = guideContent.indexOf('### 1.1 Test Target Module Map');
    expect(startSection11, 'Section 1.1 not found').toBeGreaterThan(-1);

    const endSection11 = guideContent.indexOf('### 1.2 Coverage Targets', startSection11);
    expect(endSection11, 'Section 1.2 not found').toBeGreaterThan(startSection11);

    const section11Text = guideContent.slice(startSection11, endSection11);
    const lines = section11Text.split(/\r?\n/);

    let activePrefix: string | null = null;
    const missingTargets: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (
        trimmed === 'src/core/' ||
        trimmed === 'src/app/' ||
        trimmed === 'src/' ||
        trimmed === 'tests/helpers/'
      ) {
        activePrefix = trimmed;
        continue;
      }
      if (trimmed === 'scripts/ & build/') {
        activePrefix = '';
        continue;
      }
      if (trimmed === 'Documentation & Repository Parity') {
        activePrefix = null;
        continue;
      }

      if (activePrefix !== null) {
        const treeMatch = trimmed.match(/^[├└]──\s+(.+?)\s+→/);
        if (treeMatch) {
          const rawTarget = treeMatch[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
          const resolvedRel = activePrefix + rawTarget;
          if (!fs.existsSync(path.resolve(root, resolvedRel))) {
            missingTargets.push(resolvedRel);
          }
        }
      }
    }

    expect(
      missingTargets,
      `Target modules in Section 1.1 that do not exist on disk: ${missingTargets.join(', ')}`
    ).toEqual([]);

    const helperFixtureMatches =
      guideContent.match(/\btests\/(?:helpers|fixtures)\/[a-zA-Z0-9_.-]+\.(?:ts|js|json|html)\b/g) || [];
    const missingHelperFixtures: string[] = [];
    for (const relPath of new Set(helperFixtureMatches)) {
      if (!fs.existsSync(path.resolve(root, relPath))) {
        missingHelperFixtures.push(relPath);
      }
    }

    expect(
      missingHelperFixtures,
      `tests/helpers or tests/fixtures paths in testing-guide.md that do not exist on disk: ${missingHelperFixtures.join(', ')}`
    ).toEqual([]);
  });
});
