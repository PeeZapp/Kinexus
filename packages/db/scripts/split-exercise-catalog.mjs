import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const src = join(dir, '20261027120100_exercise_catalog.sql');
const text = readFileSync(src, 'utf8').replace(/^\uFEFF/, '');
const chunks = text.split(/\n(?=insert into public\.exercises )/).filter((part) => part.includes('insert into public.exercises'));
const limit = 700_000;
const header = `insert into public.exercises (
  id, canonical_key, name, body_part, equipment, target_muscle, secondary_muscles,
  instructions, media_url, media_urls, media_kind, source, license, license_author
) values`;
const files = [];
let tuples = [];
let size = Buffer.byteLength(header) + 40;

function tuplesOf(chunk) {
  const marker = ') values\n';
  const start = chunk.indexOf(marker);
  const end = chunk.lastIndexOf('\non conflict (id) do nothing;');
  if (start < 0 || end < 0) throw new Error('catalog insert is not in the expected shape');
  return chunk.slice(start + marker.length, end).trim();
}

function flush() {
  if (tuples.length === 0) return;
  const n = String(files.length + 1).padStart(2, '0');
  const name = `202610271201${n}_exercise_catalog_${n}.sql`;
  const body = `${header}\n${tuples.join(',\n')}\non conflict (id) do nothing;\n`;
  const semis = body.split(';').length - 1;
  if (semis !== 1) throw new Error(`${name} has ${semis} semicolons`);
  writeFileSync(join(dir, name), body);
  files.push({ name, bytes: Buffer.byteLength(body), statements: 1 });
  tuples = [];
  size = Buffer.byteLength(header) + 40;
}

for (const name of readdirSync(dir)) {
  if (/^202610271201\d+_exercise_catalog_\d+\.sql$/.test(name)) unlinkSync(join(dir, name));
}

for (const chunk of chunks) {
  const rows = tuplesOf(chunk);
  const bytes = Buffer.byteLength(rows) + 2;
  if (tuples.length > 0 && size + bytes > limit) flush();
  tuples.push(rows);
  size += bytes;
}
flush();
unlinkSync(src);
console.log(JSON.stringify(files, null, 2));
