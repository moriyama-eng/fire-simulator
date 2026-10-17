import { defineConfig, type Plugin, type IndexHtmlTransformResult } from 'vite';
import { resolve, extname } from 'node:path';
import { readFileSync, createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MIME_MAP, verifyConfinedPath, sanitizeSvgContent } from './scripts/lib/confinement.mjs';

export function createDocsMiddleware(docsRoot: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0].split('#')[0];

    let matchPrefix = '';
    if (pathname.startsWith('/fire-simulator/docs/')) {
      matchPrefix = '/fire-simulator/docs/';
    } else if (pathname.startsWith('/docs/')) {
      matchPrefix = '/docs/';
    } else if (pathname === '/fire-simulator/docs' || pathname === '/docs') {
      res.statusCode = 301;
      res.setHeader('Location', pathname + '/');
      res.end();
      return;
    } else {
      return next();
    }

    const relPath = pathname.slice(matchPrefix.length);

    try {
      const ext = extname(relPath).toLowerCase();
      if (!MIME_MAP[ext]) {
        res.statusCode = 404;
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end('Not Found');
        return;
      }

      const filePath = verifyConfinedPath(docsRoot, relPath, {
        refuseSymlinks: true,
        denyInternal: true
      });

      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end('Not Found');
        return;
      }

      res.setHeader('Content-Type', MIME_MAP[ext]);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (ext === '.svg') {
        const rawSvg = readFileSync(filePath, 'utf-8');
        const sanitized = sanitizeSvgContent(rawSvg);
        res.end(sanitized);
        return;
      }

      createReadStream(filePath).pipe(res);
    } catch {
      res.statusCode = 404;
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end('Not Found');
    }
  };
}

export function htmlTransformPlugin(command: string): Plugin {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
  const version = pkg.version;
  if (typeof version !== 'string' || !/^[0-9A-Za-z.+-]+$/.test(version)) {
    throw new Error(`Invalid package version: ${version}`);
  }

  return {
    name: 'html-transform-version-csp',
    transformIndexHtml(html: string): IndexHtmlTransformResult {
      const cleaned = html.replace(/<meta\s+name=["']app-version["'][^>]*>\s*/gi, '');

      const tags: IndexHtmlTransformResult = [
        {
          tag: 'meta',
          attrs: { name: 'app-version', content: version },
          injectTo: 'head-prepend'
        }
      ];

      if (command === 'build') {
        tags.push({
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: "default-src 'self'; script-src 'self' 'sha256-GQVYFOw6u1x5mwe4EAhceFRpn+DfKJ+I4FnT+QsBvwo=' https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self';"
          },
          injectTo: 'head-prepend'
        });
      }

      return {
        html: cleaned,
        tags
      };
    }
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: (command === 'build' || isPreview) ? './' : '/',
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        docs: resolve(process.cwd(), 'docs.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false
  },
  preview: {
    port: 4173,
    strictPort: true,
    open: false
  },
  plugins: [
    htmlTransformPlugin(command),
    {
      name: 'docs-dev-middleware',
      configureServer(server) {
        const docsRoot = resolve(process.cwd(), 'docs');
        server.middlewares.use(createDocsMiddleware(docsRoot));
      }
    }
  ]
}));
