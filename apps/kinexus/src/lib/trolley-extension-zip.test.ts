import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const EXT = join(ROOT, 'extensions', 'trolley');
const ZIP = join(ROOT, 'apps', 'kinexus', 'public', 'kinexus-trolley.zip');
const FILES = ['manifest.json', 'fill.js', 'kinexus.js'] as const;

describe('kinexus-trolley.zip', () => {
  it('matches extensions/trolley (run node scripts/pack-trolley-extension.mjs)', () => {
    const unpacked = unzipSync(readFileSync(ZIP));
    const names = Object.keys(unpacked).sort();
    expect(names, 'run node scripts/pack-trolley-extension.mjs').toEqual([...FILES].sort());

    for (const name of FILES) {
      const fromZip = unpacked[name];
      expect(fromZip, `missing ${name} — run node scripts/pack-trolley-extension.mjs`).toBeTruthy();
      const expected = readFileSync(join(EXT, name));
      const actual = Buffer.from(fromZip!);
      expect(
        actual.equals(expected),
        `${name} differs from extensions/trolley — run node scripts/pack-trolley-extension.mjs`,
      ).toBe(true);
      // Keep strFromU8 referenced so empty-file regressions still surface clearly.
      expect(strFromU8(fromZip!).length).toBeGreaterThan(0);
    }
  });
});
