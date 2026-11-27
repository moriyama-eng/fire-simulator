import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createDocsMiddleware } from '../../vite.config.js';

describe('createDocsMiddleware', () => {
  const docsRoot = path.resolve(process.cwd(), 'docs');
  const middleware = createDocsMiddleware(docsRoot);

  function createMockRes() {
    const stream = new PassThrough();
    const headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    let body = '';
    const done = new Promise<void>((resolve) => {
      stream.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
      });
      stream.on('end', () => {
        body = Buffer.concat(chunks).toString('utf-8');
        resolve();
      });
    });
    const origEnd = stream.end.bind(stream);
    const res = Object.assign(stream, {
      statusCode: 200,
      headers,
      done,
      setHeader: vi.fn((k: string, v: string) => { headers[k.toLowerCase()] = v; }),
      end: vi.fn((data?: string | Buffer) => {
        if (data !== undefined) {
          return origEnd(data);
        }
        return origEnd();
      })
    }) as PassThrough & {
      statusCode: number;
      headers: Record<string, string>;
      done: Promise<void>;
      readonly body: string;
      setHeader: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
    Object.defineProperty(res, 'body', { get: () => body });
    return res;
  }

  it('passes through non-docs requests via next()', () => {
    const req = { url: '/index.html' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('serves valid docs files with nosniff and correct MIME', async () => {
    const req = { url: '/docs/manifest.json' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    await res.done;
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    const parsed = JSON.parse(res.body);
    expect(Array.isArray(parsed.categories)).toBe(true);
  });

  it('serves subpath prefixed docs files under /fire-simulator/docs/', async () => {
    const req = { url: '/fire-simulator/docs/manifest.json' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    await res.done;
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    const parsed = JSON.parse(res.body);
    expect(Array.isArray(parsed.categories)).toBe(true);
  });

  it('returns 404 with nosniff on traversal attempt without calling next()', () => {
    const req = { url: '/docs/../package.json' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('returns 404 with nosniff on internal directory access without calling next()', () => {
    const req = { url: '/docs/internal/testing-guide.md' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('returns 404 with nosniff for non-allowlisted extension files', () => {
    const req = { url: '/docs/unallowed.exe' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('returns 404 with nosniff on NTFS alternate data streams and internal bypass attempts', () => {
    const req1 = { url: '/docs/internal::$INDEX_ALLOCATION/testing-guide.md' } as any;
    const res1 = createMockRes();
    const next1 = vi.fn();

    middleware(req1, res1 as any, next1);
    expect(next1).not.toHaveBeenCalled();
    expect(res1.statusCode).toBe(404);
    expect(res1.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');

    const req2 = { url: '/docs/guide/getting-started.md::$DATA' } as any;
    const res2 = createMockRes();
    const next2 = vi.fn();

    middleware(req2, res2 as any, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(404);
    expect(res2.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });
});
