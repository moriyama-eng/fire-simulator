import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function collectMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function extractAnchors(content: string): Set<string> {
  const anchors = new Set<string>();

  // 1. Headings: # Heading
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    const clean = raw.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').trim();
    const lower = clean.toLowerCase();
    const slug = lower.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
    anchors.add(slug);
    anchors.add(encodeURIComponent(slug));
    anchors.add(decodeURIComponent(slug).toLowerCase());

    // Also support slugs preserving dot separators (e.g. 1.1-test-target)
    const slugWithDots = lower.replace(/[^\p{L}\p{N}\s.-]/gu, '').trim().replace(/\s+/g, '-');
    anchors.add(slugWithDots);
    anchors.add(encodeURIComponent(slugWithDots));
    anchors.add(decodeURIComponent(slugWithDots).toLowerCase());
  }

  // 2. Explicit HTML name or id attributes (e.g. <a name="foo"></a>)
  const tagRegex = /<(?:a|div|span|h[1-6])[^>]*(?:name|id)=['"]([^'"]+)['"][^>]*>/gi;
  while ((match = tagRegex.exec(content)) !== null) {
    const id = match[1].trim();
    anchors.add(id);
    anchors.add(id.toLowerCase());
    anchors.add(encodeURIComponent(id));
    anchors.add(decodeURIComponent(id).toLowerCase());
  }

  return anchors;
}

describe('doc-links-integrity: markdown links and anchors resolution', () => {
  const root = process.cwd();
  const mdFiles = [
    path.resolve(root, 'README.md'),
    path.resolve(root, 'README-ja.md'),
    ...collectMarkdownFiles(path.resolve(root, 'docs'))
  ];

  it('scans all repository markdown files and verifies that relative links and anchors resolve', () => {
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    const failures: string[] = [];

    for (const file of mdFiles) {
      const relFile = path.relative(root, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      // Strip fenced code blocks and inline code to prevent false positives from code snippets
      const scannedContent = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');

      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(scannedContent)) !== null) {
        const rawTarget = m[2].trim();
        // Ignore external protocols or empty targets
        if (
          !rawTarget ||
          rawTarget.startsWith('http://') ||
          rawTarget.startsWith('https://') ||
          rawTarget.startsWith('mailto:') ||
          rawTarget.startsWith('data:')
        ) {
          continue;
        }

        const [pathAndQuery, hash] = rawTarget.split('#');
        const [filePath] = pathAndQuery.split('?');
        let targetFilePath = file;

        if (filePath) {
          targetFilePath = path.resolve(path.dirname(file), filePath);
          if (!fs.existsSync(targetFilePath)) {
            failures.push(`[Missing File] in ${relFile}: target "${rawTarget}" points to nonexistent path: ${targetFilePath}`);
            continue;
          }
        }

        if (hash !== undefined && hash.length > 0) {
          const targetContent = fs.readFileSync(targetFilePath, 'utf-8');
          const anchors = extractAnchors(targetContent);
          const normalizedHash = decodeURIComponent(hash).toLowerCase();
          const matches = anchors.has(hash) || anchors.has(normalizedHash) || anchors.has(encodeURIComponent(hash));

          if (!matches) {
            const relTarget = path.relative(root, targetFilePath).replace(/\\/g, '/');
            failures.push(`[Missing Anchor] in ${relFile}: link "${rawTarget}" target anchor "#${hash}" not found in ${relTarget}`);
          }
        }
      }
    }

    expect(failures, `Markdown link integrity failures:\n${failures.join('\n')}`).toEqual([]);
  });
});
