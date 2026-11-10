/**
 * Builds the ChatGPT plugin ZIP required by OpenAI's submission portal.
 * Does not upload or submit — packaging only.
 *
 * Usage: node scripts/package-chatgpt-plugin.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'docs', 'connectors', 'chatgpt-plugin');
const outDir = join(root, 'dist', 'chatgpt-plugin');
const stagingDir = join(outDir, 'kinexus');
const outZip = join(outDir, 'kinexus-chatgpt-plugin.zip');

function main() {
  if (!existsSync(join(sourceDir, 'plugin.json')) || !existsSync(join(sourceDir, 'mcp.json'))) {
    throw new Error('Missing plugin.json or mcp.json under docs/connectors/chatgpt-plugin');
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  cpSync(sourceDir, stagingDir, {
    recursive: true,
    filter: (src) => !src.endsWith(`${join('assets', 'README.md')}`) && !src.endsWith('README.md'),
  });

  // Tiny 1×1 PNG so the ZIP validates; replace with a real 512×512 brand mark before submit.
  const logoPath = join(stagingDir, 'assets', 'logo.png');
  if (!existsSync(logoPath)) {
    mkdirSync(join(stagingDir, 'assets'), { recursive: true });
    writeFileSync(
      logoPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
  }

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${stagingDir.replace(/'/g, "''")}' -DestinationPath '${outZip.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('zip', ['-r', outZip, 'kinexus'], { cwd: outDir, stdio: 'inherit' });
  }

  console.log(`Wrote ${outZip}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
