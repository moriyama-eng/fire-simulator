import fs from 'node:fs';
import path from 'node:path';

export function assertBuildArtifacts(projectRoot = process.cwd()) {
  console.log('Asserting build artifacts in', projectRoot);

  const cliPath = path.resolve(projectRoot, 'dist', 'cli.js');
  if (!fs.existsSync(cliPath)) {
    throw new Error(`Missing CLI artifact: ${cliPath}`);
  }
  const cliStat = fs.statSync(cliPath);
  if (cliStat.size === 0) {
    throw new Error(`CLI artifact is empty: ${cliPath}`);
  }
  const cliContent = fs.readFileSync(cliPath, 'utf-8');
  if (!cliContent.startsWith('#!/usr/bin/env node')) {
    throw new Error(`CLI artifact is missing shebang: ${cliPath}`);
  }

  const clientIndexPath = path.resolve(projectRoot, 'dist', 'client', 'index.html');
  if (!fs.existsSync(clientIndexPath)) {
    throw new Error(`Missing client index.html artifact: ${clientIndexPath}`);
  }
  const clientIndexStat = fs.statSync(clientIndexPath);
  if (clientIndexStat.size === 0) {
    throw new Error(`Client index.html artifact is empty: ${clientIndexPath}`);
  }

  console.log('✓ Build artifacts verified (dist/cli.js and dist/client/index.html).');
}

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
);

if (isDirectRun) {
  try {
    assertBuildArtifacts();
    process.exit(0);
  } catch (err) {
    console.error('✗ assert-build-artifacts failed:', err);
    process.exit(1);
  }
}
