import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveAndValidateSegments, verifyConfinedPath } from '../../scripts/lib/confinement.mjs';

describe('confinement module', () => {
  describe('resolveAndValidateSegments', () => {
    it('preserves ..foo and foo.. segments', () => {
      const segs = resolveAndValidateSegments('..foo/bar../baz');
      expect(segs).toEqual(['..foo', 'bar..', 'baz']);
    });

    it('rejects parent traversal .. segments', () => {
      expect(() => resolveAndValidateSegments('../evil')).toThrow(/traversal/i);
      expect(() => resolveAndValidateSegments('foo/../bar')).toThrow(/traversal/i);
      expect(() => resolveAndValidateSegments('foo/..')).toThrow(/traversal/i);
    });

    it('rejects Windows drive-letter prefixes', () => {
      expect(() => resolveAndValidateSegments('C:/boot.ini')).toThrow(/drive/i);
      expect(() => resolveAndValidateSegments('d:/foo/bar')).toThrow(/drive/i);
    });

    it('rejects internal directory and file segments by default', () => {
      expect(() => resolveAndValidateSegments('internal/doc.md')).toThrow(/internal/i);
      expect(() => resolveAndValidateSegments('Internal/doc.md')).toThrow(/internal/i);
      expect(() => resolveAndValidateSegments('guide/internal.test.md')).toThrow(/internal/i);
      expect(() => resolveAndValidateSegments('guide/internal/foo.md')).toThrow(/internal/i);
    });

    it('rejects colons and NTFS alternate data streams', () => {
      expect(() => resolveAndValidateSegments('guide/getting-started.md::$DATA')).toThrow(/colon/i);
      expect(() => resolveAndValidateSegments('internal::$INDEX_ALLOCATION/doc.md')).toThrow(/colon/i);
      expect(() => resolveAndValidateSegments('foo:bar.md')).toThrow(/colon/i);
    });

    it('rejects Windows reserved device names', () => {
      expect(() => resolveAndValidateSegments('con')).toThrow(/reserved device/i);
      expect(() => resolveAndValidateSegments('aux.md')).toThrow(/reserved device/i);
      expect(() => resolveAndValidateSegments('guide/nul/doc.md')).toThrow(/reserved device/i);
      expect(() => resolveAndValidateSegments('com1.txt')).toThrow(/reserved device/i);
    });

    it('allows internal segments when denyInternal is false', () => {
      const segs = resolveAndValidateSegments('internal/doc.md', false);
      expect(segs).toEqual(['internal', 'doc.md']);
    });
  });

  describe('verifyConfinedPath', () => {
    const mockFs = {
      lstatSync: (p: string) => ({
        isSymbolicLink: () => p.includes('symlink'),
        isDirectory: () => !p.endsWith('.md'),
        isFile: () => p.endsWith('.md')
      }),
      realpathSync: (p: string) => p
    };

    it('validates legitimate relative subpaths within root', () => {
      const res = verifyConfinedPath('/app/docs', 'guide/getting-started.md', {
        fsImpl: mockFs,
        skipRealpath: true,
        pathImpl: path.posix
      });
      expect(res).toBe('/app/docs/guide/getting-started.md');
    });

    it('works across Windows path implementation with path.win32', () => {
      const res = verifyConfinedPath('C:\\app\\docs', 'guide\\getting-started.md', {
        fsImpl: mockFs,
        skipRealpath: true,
        pathImpl: path.win32
      });
      expect(res).toBe('C:\\app\\docs\\guide\\getting-started.md');
    });

    it('throws when root is a symbolic link and refuseSymlinks is true', () => {
      expect(() => {
        verifyConfinedPath('/app/symlink-docs', 'guide/doc.md', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/symbolic link/i);
    });

    it('throws when target path is a symbolic link', () => {
      expect(() => {
        verifyConfinedPath('/app/docs', 'guide/symlink.md', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/symlinks are forbidden/i);
    });

    it('throws on percent-encoded traversal and nested overflow', () => {
      expect(() => {
        verifyConfinedPath('/app/docs', '%2e%2e/secret.txt', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/traversal/i);

      let overflow = 'a/b';
      for (let i = 0; i < 11; i++) overflow = encodeURIComponent(overflow);
      expect(() => {
        verifyConfinedPath('/app/docs', overflow, {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/nested encoding overflow/i);
    });

    it('throws on null bytes and control/surrogate characters', () => {
      expect(() => {
        verifyConfinedPath('/app/docs', 'guide/getting-started%00.md', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/control or surrogate/i);

      expect(() => {
        verifyConfinedPath('/app/docs', 'guide/\uD800doc.md', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/control or surrogate/i);
    });

    it('rejects NTFS alternate data streams and internal ADS bypasses', () => {
      expect(() => {
        verifyConfinedPath('/app/docs', 'internal::$INDEX_ALLOCATION/doc.md', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/colon/i);

      expect(() => {
        verifyConfinedPath('/app/docs', 'guide/doc.md::$DATA', {
          fsImpl: mockFs,
          skipRealpath: true,
          pathImpl: path.posix
        });
      }).toThrow(/colon/i);
    });
  });
});
