import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIME_MAP, verifyConfinedPath, sanitizeSvgContent } from './lib/confinement.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function copyDocs(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const docsRoot = options.docsRoot || path.resolve(projectRoot, 'docs');
  const clientDist = options.clientDist || path.resolve(projectRoot, 'dist', 'client');
  const targetDocs = path.resolve(clientDist, 'docs');
  const tempDocs = path.resolve(clientDist, '.docs_temp');
  const fsImpl = options.fsImpl || fs;

  if (!fsImpl.existsSync(docsRoot)) {
    throw new Error(`Source docs directory does not exist: ${docsRoot}`);
  }

  // Verify docsRoot itself is not a symlink
  const rootStat = fsImpl.lstatSync(docsRoot);
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Source docs root is a symbolic link: ${docsRoot}`);
  }

  // Clean temp directory if it exists
  if (fsImpl.existsSync(tempDocs)) {
    fsImpl.rmSync(tempDocs, { recursive: true, force: true });
  }
  fsImpl.mkdirSync(tempDocs, { recursive: true });

  function walkAndCopy(currentDir) {
    const entries = fsImpl.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryNameLc = entry.name.toLowerCase();

      // Prune before confinement: internal directory or file segment
      if (entryNameLc === 'internal' || entryNameLc.startsWith('internal.')) {
        continue;
      }

      const fullSourcePath = path.resolve(currentDir, entry.name);
      const relToDocs = path.relative(docsRoot, fullSourcePath);

      // Check for symbolic link
      const stat = fsImpl.lstatSync(fullSourcePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are forbidden: ${fullSourcePath}`);
      }

      if (stat.isDirectory()) {
        // Validate confined path before descending
        verifyConfinedPath(docsRoot, relToDocs, {
          refuseSymlinks: true,
          denyInternal: true,
          fsImpl
        });

        const targetSubDir = path.resolve(tempDocs, relToDocs);
        fsImpl.mkdirSync(targetSubDir, { recursive: true });
        walkAndCopy(fullSourcePath);
      } else if (stat.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Prune before confinement: non-allowlisted extension
        if (!(ext in MIME_MAP)) {
          continue;
        }

        // Validate confined path for allowed file
        verifyConfinedPath(docsRoot, relToDocs, {
          refuseSymlinks: true,
          denyInternal: true,
          fsImpl
        });

        const targetFilePath = path.resolve(tempDocs, relToDocs);
        const targetFileDir = path.dirname(targetFilePath);
        fsImpl.mkdirSync(targetFileDir, { recursive: true });

        if (ext === '.svg') {
          const rawSvg = fsImpl.readFileSync(fullSourcePath, 'utf-8');
          const sanitized = sanitizeSvgContent(rawSvg);
          fsImpl.writeFileSync(targetFilePath, sanitized, 'utf-8');
        } else {
          fsImpl.copyFileSync(fullSourcePath, targetFilePath);
        }
      }
    }
  }

  walkAndCopy(docsRoot);

  // Clean target destination if exists
  if (fsImpl.existsSync(targetDocs)) {
    fsImpl.rmSync(targetDocs, { recursive: true, force: true });
  }

  // Atomic rename with capped retry (5 attempts, backoff: 100, 200, 400, 800, 1600ms)
  const maxRetries = 5;
  const backoff = [100, 200, 400, 800, 1600];
  let renamed = false;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      fsImpl.renameSync(tempDocs, targetDocs);
      renamed = true;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await sleep(backoff[attempt]);
      }
    }
  }

  if (!renamed) {
    throw new Error(`Failed to atomically rename ${tempDocs} to ${targetDocs} after ${maxRetries} attempts: ${lastError?.message}`);
  }
}

// Auto-run when executed directly
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isDirectRun) {
  copyDocs()
    .then(() => {
      console.log('✓ Successfully copied documentation assets to dist/client/docs/');
    })
    .catch((err) => {
      console.error('✗ copy-docs failed:', err);
      process.exit(1);
    });
}
