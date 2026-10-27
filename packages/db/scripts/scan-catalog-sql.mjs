import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((name) => name.includes('exercise_catalog'));

for (const name of files) {
  const text = readFileSync(join(dir, name), 'utf8');
  let inString = false;
  let semisInside = 0;
  const samples = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'") {
      if (inString && text[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (char === ';' && inString) {
      semisInside += 1;
      if (samples.length < 3) samples.push(text.slice(Math.max(0, i - 50), i + 50).replaceAll('\n', ' '));
    }
    if (!inString && char === 'a' && /[\s,(]/.test(text[i - 1] ?? '') && /[\s,);]/.test(text[i + 1] ?? '')) {
      samples.push('BARE A: ' + text.slice(Math.max(0, i - 80), i + 80).replaceAll('\n', ' '));
    }
  }
  console.log(JSON.stringify({ name, semisInside, inStringAtEnd: inString, samples }));
}
