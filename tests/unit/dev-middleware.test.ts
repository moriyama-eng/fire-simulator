import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createDocsMiddleware } from '../../vite.config.js';

describe('createDocsMiddleware', () => {
  const docsRoot = path.resolve(process.cwd(), 'docs');
  const middleware = createDocsMiddleware(docsRoot);

  function createMockRes() {
    const headers: Record<string, string> = {};
    let body = '';
    return {
      statusCode: 200,
      headers,
      get body() { return body; },
      setHeader: vi.fn((k: string, v: string) => { headers[k.toLowerCase()] = v; }),
      end: vi.fn((data?: string) => { if (data) body += data; })
    };
  }

  it('passes through non-docs requests via next()', () => {
    const req = { url: '/index.html' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('serves valid docs files with nosniff and correct MIME', () => {
    const req = { url: '/docs/manifest.json' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('serves subpath prefixed docs files under /fire-simulator/docs/', () => {
    const req = { url: '/fire-simulator/docs/manifest.json' } as any;
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
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
