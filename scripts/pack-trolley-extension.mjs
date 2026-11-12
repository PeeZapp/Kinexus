/**
 * Packs extensions/trolley into apps/kinexus/public/kinexus-trolley.zip
 * (manifest.json, fill.js, kinexus.js, INSTALL.txt at the zip root).
 *
 * Usage: node scripts/pack-trolley-extension.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync, strToU8 } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'extensions', 'trolley');
const outZip = join(root, 'apps', 'kinexus', 'public', 'kinexus-trolley.zip');
const files = ['manifest.json', 'fill.js', 'kinexus.js'];

const installTxt = `Kinexus trolley — install (Chrome or Edge)

1. Right-click this zip → Extract All… (opening the zip is not enough).
2. Open chrome://extensions or edge://extensions
3. Turn on Developer mode
4. Click “Load unpacked”
5. Select the extracted folder that contains manifest.json
   (there is no installer file — that folder is the extension)
6. Go back to Kinexus shopping and refresh
`;

const entries = {
  'INSTALL.txt': strToU8(installTxt),
};
for (const name of files) {
  entries[name] = readFileSync(join(srcDir, name));
}

writeFileSync(outZip, zipSync(entries, { level: 6 }));
console.log(`Wrote ${outZip}`);
