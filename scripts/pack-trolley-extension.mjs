/**
 * Packs extensions/trolley into apps/kinexus/public/kinexus-trolley.zip
 * (manifest.json, fill.js, kinexus.js at the zip root).
 *
 * Usage: node scripts/pack-trolley-extension.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'extensions', 'trolley');
const outZip = join(root, 'apps', 'kinexus', 'public', 'kinexus-trolley.zip');
const files = ['manifest.json', 'fill.js', 'kinexus.js'];

const entries = {};
for (const name of files) {
  entries[name] = readFileSync(join(srcDir, name));
}

writeFileSync(outZip, zipSync(entries, { level: 6 }));
console.log(`Wrote ${outZip}`);
