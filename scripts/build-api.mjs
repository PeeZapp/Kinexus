/**
 * Bundle the Hono API for Vercel. Workspace package `@kinexus/domain` exports
 * raw TypeScript, which Node cannot load in the serverless runtime — so we
 * inline first-party code and leave native/optional scrape deps external.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'api', '_handler.mjs');

mkdirSync(dirname(outfile), { recursive: true });

const external = [
  'impit',
  // CJS deps pulled via @kinexus/domain list import; must stay out of the ESM bundle
  // or Node fails at cold start with: Dynamic require of "url" is not supported.
  'mammoth',
  'playwright-core',
  'playwright-extra',
  'puppeteer-extra-plugin-stealth',
];

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'packages', 'api', 'src', 'vercel.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  logLevel: 'info',
  external,
  // Keep dynamic import('impit'|'playwright-*') as runtime requires.
  packages: 'bundle',
});

console.log(`Wrote ${outfile}`);
