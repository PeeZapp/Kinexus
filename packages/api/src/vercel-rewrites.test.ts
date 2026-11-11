import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { app } from './app.js';

type Rewrite = { source: string; destination: string };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Page routes / clients that intentionally hit `/api/...` instead of bare paths. */
const EXCLUDED_API_PATHS = new Set([
  '/u/:key',
  '/recipes/:id',
  '/recipes/import',
  '/recipes/import/work',
]);

function loadApiRewrites(): Rewrite[] {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    rewrites?: Rewrite[];
  };
  return (vercel.rewrites ?? []).filter((r) => r.destination.startsWith('/api'));
}

/** Convert a Vercel rewrite `source` (Express-style) into a full-path RegExp. */
function vercelSourceToRegex(source: string): RegExp {
  let pattern = '';
  let i = 0;
  while (i < source.length) {
    // `/:param*` → optional remainder (Vercel/Express splat)
    if (source[i] === '/' && source[i + 1] === ':') {
      let j = i + 2;
      while (/[A-Za-z0-9_]/.test(source[j] ?? '')) j += 1;
      if (j > i + 2 && source[j] === '*') {
        pattern += '(?:\\/.*)?';
        i = j + 1;
        continue;
      }
    }
    const ch = source[i]!;
    if (ch === ':' && /[A-Za-z_]/.test(source[i + 1] ?? '')) {
      i += 1;
      while (/[A-Za-z0-9_]/.test(source[i] ?? '')) i += 1;
      if (source[i] === '*') {
        i += 1;
        pattern += '.*';
      } else {
        pattern += '[^/]+';
      }
      continue;
    }
    if (ch === '(') {
      const end = source.indexOf(')', i);
      if (end === -1) throw new Error(`Unclosed group in rewrite source: ${source}`);
      pattern += source.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if ('\\.[]{}()+-^$|'.includes(ch)) pattern += `\\${ch}`;
    else if (ch === '*') pattern += '.*';
    else pattern += ch;
    i += 1;
  }
  return new RegExp(`^${pattern}$`);
}

function examplePath(routePath: string): string {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, 'x');
}

function registeredBareApiPaths(): string[] {
  const paths = new Set<string>();
  for (const route of app.routes) {
    const path = route.path;
    if (!path || path === '/*' || path === '*') continue;
    if (path.startsWith('/api/') || path === '/api') continue;
    if (EXCLUDED_API_PATHS.has(path)) continue;
    paths.add(path);
  }
  return [...paths].sort();
}

describe('vercel.json API rewrites', () => {
  it('covers every registered API route (except page /api-prefixed clients)', () => {
    const rewrites = loadApiRewrites();
    const matchers = rewrites.map((r) => ({
      source: r.source,
      re: vercelSourceToRegex(r.source),
    }));

    const missing: string[] = [];
    for (const routePath of registeredBareApiPaths()) {
      const sample = examplePath(routePath);
      const hit = matchers.some((m) => m.re.test(sample));
      if (!hit) missing.push(routePath);
    }

    expect(missing, `Missing vercel.json API rewrites for: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not rewrite /kinexus-trolley.zip so the static public file is served', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
      rewrites?: Rewrite[];
    };
    const path = '/kinexus-trolley.zip';
    const hit = (vercel.rewrites ?? []).find((r) => vercelSourceToRegex(r.source).test(path));
    expect(hit, `rewrite must not catch ${path}: ${hit?.source ?? ''}`).toBeUndefined();
  });

  it('keeps API rewrites before SPA catch-alls that would shadow them', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
      rewrites?: Rewrite[];
    };
    const rewrites = vercel.rewrites ?? [];
    const firstSpa = rewrites.findIndex(
      (r) =>
        r.source.startsWith('/invite') ||
        r.source.startsWith('/share/') ||
        r.source === '/u/:key' ||
        (r.source.startsWith('/recipes') && !r.destination.startsWith('/api')) ||
        r.source.startsWith('/http'),
    );
    expect(firstSpa).toBeGreaterThan(0);

    const requiredBeforeSpa = [
      '/books/:path*',
      '/readlist/:path*',
      '/ai/status',
      '/ai/keys',
      '/ai/keys/:path*',
      '/lists/import/:path*',
      '/train/import/:path*',
      '/watchlist/import/:path*',
      '/creators/verify-links',
      '/quotes/:path*',
    ];
    for (const source of requiredBeforeSpa) {
      const idx = rewrites.findIndex((r) => r.source === source);
      expect(idx, `rewrite ${source} missing`).toBeGreaterThanOrEqual(0);
      expect(idx, `rewrite ${source} must precede SPA catch-alls`).toBeLessThan(firstSpa);
      expect(rewrites[idx]!.destination).toBe(`/api?__path=${source}`);
    }
  });
});
