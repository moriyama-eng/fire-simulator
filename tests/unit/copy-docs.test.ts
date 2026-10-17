import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { copyDocs } from '../../scripts/copy-docs.mjs';

describe('copyDocs module', () => {
  it('prunes internal directories and non-allowlisted extensions before copying', async () => {
    const writtenFiles: Record<string, string> = {};
    const directories = new Set<string>();

    const mockFs = {
      existsSync: vi.fn((p: string) => {
        if (p.endsWith('docs')) return true;
        return false;
      }),
      lstatSync: vi.fn((p: string) => ({
        isSymbolicLink: () => p.includes('symlink'),
        isDirectory: () => !path.extname(p),
        isFile: () => !!path.extname(p)
      })),
      readdirSync: vi.fn((dir: string) => {
        if (dir.endsWith('docs')) {
          return [
            { name: 'guide', isDirectory: () => true, isFile: () => false },
            { name: 'internal', isDirectory: () => true, isFile: () => false },
            { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
            { name: 'malicious.js', isDirectory: () => false, isFile: () => true }
          ];
        }
        if (dir.endsWith('guide')) {
          return [
            { name: 'getting-started.md', isDirectory: () => true, isFile: () => true },
            { name: 'internal.draft.md', isDirectory: () => false, isFile: () => true }
          ];
        }
        return [];
      }),
      mkdirSync: vi.fn((dir: string) => { directories.add(dir); }),
      rmSync: vi.fn(),
      readFileSync: vi.fn((p: string) => '# Sample'),
      writeFileSync: vi.fn((p: string, content: string) => { writtenFiles[p] = content; }),
      copyFileSync: vi.fn((src: string, dest: string) => { writtenFiles[dest] = 'copied'; }),
      renameSync: vi.fn(),
      realpathSync: vi.fn((p: string) => p)
    };

    await copyDocs({
      projectRoot: '/mock-root',
      docsRoot: '/mock-root/docs',
      clientDist: '/mock-root/dist/client',
      fsImpl: mockFs
    });

    const copiedPaths = Object.keys(writtenFiles);

    // Allowed files were copied
    expect(copiedPaths.some(p => p.includes('getting-started.md'))).toBe(true);
    expect(copiedPaths.some(p => p.includes('manifest.json'))).toBe(true);

    // Pruned files were NOT copied
    expect(copiedPaths.some(p => p.includes('internal'))).toBe(false);
    expect(copiedPaths.some(p => p.includes('malicious.js'))).toBe(false);
  });

  it('retries rename upon EBUSY / EPERM and succeeds within retry cap', async () => {
    let renameAttempts = 0;
    const mockFs = {
      existsSync: vi.fn((p: string) => p.endsWith('docs')),
      lstatSync: vi.fn((p: string) => ({
        isSymbolicLink: () => false,
        isDirectory: () => !p.endsWith('.md'),
        isFile: () => p.endsWith('.md')
      })),
      readdirSync: vi.fn(() => []),
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
      renameSync: vi.fn(() => {
        renameAttempts++;
        if (renameAttempts < 3) {
          const err = new Error('EBUSY: resource locked');
          (err as unknown as { code: string }).code = 'EBUSY';
          throw err;
        }
      }),
      realpathSync: vi.fn((p: string) => p)
    };

    await copyDocs({
      projectRoot: '/mock-root',
      docsRoot: '/mock-root/docs',
      clientDist: '/mock-root/dist/client',
      fsImpl: mockFs
    });

    expect(renameAttempts).toBe(3);
  });

  it('throws and fails build if rename retries exhaust', async () => {
    const mockFs = {
      existsSync: vi.fn((p: string) => p.endsWith('docs')),
      lstatSync: vi.fn((p: string) => ({
        isSymbolicLink: () => false,
        isDirectory: () => !p.endsWith('.md'),
        isFile: () => p.endsWith('.md')
      })),
      readdirSync: vi.fn(() => []),
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
      renameSync: vi.fn(() => {
        const err = new Error('EPERM: operation not permitted');
        (err as unknown as { code: string }).code = 'EPERM';
        throw err;
      }),
      realpathSync: vi.fn((p: string) => p)
    };

    await expect(copyDocs({
      projectRoot: '/mock-root',
      docsRoot: '/mock-root/docs',
      clientDist: '/mock-root/dist/client',
      fsImpl: mockFs
    })).rejects.toThrow(/Failed to atomically rename/i);
  });
});
