import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'supabase', 'migrations', '20261027120100_exercise_catalog.sql');
const tmp = tmpdir();

const phrases = [
  [/abdominal rollers?/g, 'abwheel'],
  [/ab rollers?/g, 'abwheel'],
  [/abdominal wheels?/g, 'abwheel'],
  [/ab wheels?/g, 'abwheel'],
  [/exercise balls?/g, 'stabilityball'],
  [/swiss balls?/g, 'stabilityball'],
  [/stability balls?/g, 'stabilityball'],
  [/ez bars?/g, 'ezbar'],
  [/smith machines?/g, 'smith'],
  [/romanian deadlifts?/g, 'romaniandeadlift'],
  [/\brdls?\b/g, 'romaniandeadlift'],
  [/pull ?ups?/g, 'pullup'],
  [/chin ?ups?/g, 'chinup'],
  [/press ?ups?/g, 'pushup'],
  [/push ?ups?/g, 'pushup'],
  [/close grips?/g, 'closegrip'],
  [/narrow grips?/g, 'closegrip'],
  [/wide grips?/g, 'widegrip'],
  [/underhands?/g, 'undergrip'],
  [/single arms?/g, 'singlearm'],
  [/one arms?/g, 'singlearm'],
  [/single legs?/g, 'singleleg'],
  [/one legs?/g, 'singleleg'],
  [/one handed/g, 'singlearm'],
  [/two handed/g, ''],
  [/2 handed/g, ''],
  [/bent over/g, 'bentover'],
  [/pull ?downs?/g, 'pulldown'],
  [/push ?downs?/g, 'pushdown'],
];

const tokenMap = {
  dumbbells: 'dumbbell', dumbell: 'dumbbell', db: 'dumbbell',
  barbells: 'barbell', kettlebells: 'kettlebell', kb: 'kettlebell',
  crunches: 'crunch', curls: 'curl', raises: 'raise',
  flys: 'fly', flies: 'fly', alternating: 'alternate',
  presses: 'press', rows: 'row', squats: 'squat', deadlifts: 'deadlift',
};

const noise = new Set('a an the with using on for to of and or in at from into your medium normal standard regular basic traditional classic style hd version exercise movement proper strict flat full grip hands hand two both'.split(' '));

function canon(name) {
  let s = String(name).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ');
  for (const [re, to] of phrases) s = s.replace(re, ` ${to} `);
  const tokens = [];
  for (const raw of s.split(/\s+/)) {
    if (!raw || noise.has(raw)) continue;
    const token = tokenMap[raw] || raw;
    if (!noise.has(token) && !tokens.includes(token)) tokens.push(token);
  }
  return tokens.sort().join(' ');
}

function region(body, target) {
  const text = `${body} ${target}`.toLowerCase();
  if (/bicep|curl/.test(text) && !/leg curl|hamstring/.test(text)) return 'biceps';
  if (/tricep|pushdown|push down/.test(text)) return 'triceps';
  if (/pectoral|chest|bench|fly/.test(text)) return 'chest';
  if (/delt|shoulder|lateral raise/.test(text)) return 'shoulders';
  if (/abs|waist|core|abdominal|crunch|plank|sit-up|sit up/.test(text)) return 'core';
  if (/quad|hamstring|glute|calf|adduct|abduct|leg|squat|lunge|deadlift/.test(text)) return 'legs';
  if (/lat|back|trap|row|pull-up|pull up|pulldown/.test(text)) return 'back';
  if (/forearm|lower arm|wrist/.test(text)) return 'forearms';
  if (/cardio|run|bike|burpee/.test(text)) return 'cardio';
  if (text.includes('neck')) return 'neck';
  return 'other';
}

function uuidFrom(key) {
  const bytes = Buffer.from(createHash('sha1').update(`kinexus.exercise.${key}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sanitize(value) {
  return String(value ?? '').replaceAll(';', ',');
}

function sqlStr(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${sanitize(value).replaceAll("'", "''")}'`;
}

function sqlText(value) {
  return `'${sanitize(value).replaceAll("'", "''")}'`;
}

function sqlArray(values) {
  const items = (values ?? []).map((value) => sanitize(value).replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (items.length === 0) return `'{}'::text[]`;
  return `ARRAY[${items.map((value) => sqlStr(value)).join(', ')}]::text[]`;
}

async function getJson(url) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }
  throw new Error(`rate limited ${url}`);
}

async function loadExerciseDb() {
  const cache = join(tmp, 'edb-exercises.json');
  if (existsSync(cache)) {
    const cached = JSON.parse(readFileSync(cache, 'utf8'));
    if (Array.isArray(cached) && cached.length >= 1500) return cached;
  }
  const rows = [];
  let after = '';
  for (;;) {
    const url = `https://oss.exercisedb.dev/api/v1/exercises?limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const page = await getJson(url);
    rows.push(...page.data);
    process.stderr.write(`edb ${rows.length}\n`);
    if (!page.meta?.hasNextPage) break;
    after = page.meta.nextCursor;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  writeFileSync(cache, JSON.stringify(rows));
  return rows;
}

function loadPublicDomain() {
  const file = join(tmp, 'pd-exercises.json');
  if (!existsSync(file)) throw new Error('Missing public-domain exercise cache');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function loadWger() {
  const dir = join(tmp, 'wger-pages');
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const file of readdirSync(dir)) {
    const page = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const row of page.results ?? []) {
      if (row.language != null && row.language !== 2) continue;
      rows.push(row);
    }
  }
  return rows;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<li>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const priority = { exercisedb: 0, public_domain: 1, wger: 2 };
const chosen = new Map();

function keep(row) {
  const key = canon(row.name);
  if (!key) return;
  const current = chosen.get(key);
  if (!current || priority[row.source] < priority[current.source]) chosen.set(key, { ...row, canonical_key: key });
}

const edb = await loadExerciseDb();
for (const row of edb) {
  const target = row.targetMuscles?.[0] ?? '';
  const body = row.bodyParts?.[0] ?? '';
  keep({
    source: 'exercisedb',
    sourceId: row.exerciseId,
    name: row.name,
    body_part: region(body, target),
    equipment: row.equipments?.[0] ?? '',
    target_muscle: target,
    secondary_muscles: row.secondaryMuscles ?? [],
    instructions: row.instructions ?? [],
    media_url: row.gifUrl ?? null,
    media_urls: row.gifUrl ? [row.gifUrl] : [],
    media_kind: row.gifUrl ? 'gif' : null,
    license: 'AscendAPI ExerciseDB free tier, non-commercial',
    license_author: 'AscendAPI',
  });
}

for (const row of loadPublicDomain()) {
  const target = row.primaryMuscles?.[0] ?? '';
  const images = (row.images ?? []).filter(Boolean);
  const mediaUrls = images.map((image) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${image}`);
  keep({
    source: 'public_domain',
    sourceId: row.id,
    name: row.name,
    body_part: region(target, row.category ?? ''),
    equipment: row.equipment ?? '',
    target_muscle: target,
    secondary_muscles: row.secondaryMuscles ?? [],
    instructions: row.instructions ?? [],
    media_url: mediaUrls[0] ?? null,
    media_urls: mediaUrls,
    media_kind: mediaUrls.length ? 'image' : null,
    license: 'Unlicense',
    license_author: null,
  });
}

for (const row of loadWger()) {
  keep({
    source: 'wger',
    sourceId: String(row.id),
    name: row.name,
    body_part: 'other',
    equipment: '',
    target_muscle: '',
    secondary_muscles: [],
    instructions: stripHtml(row.description_source || row.description),
    media_url: null,
    media_urls: [],
    media_kind: null,
    license: 'CC-BY-SA-4.0',
    license_author: row.license_author || 'wger',
  });
}

const rows = [...chosen.values()].sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(dirname(dest), { recursive: true });
const values = rows.map((row) => `(
  '${uuidFrom(`${row.source}:${row.sourceId}`)}',
  ${sqlStr(row.canonical_key)},
  ${sqlStr(row.name)},
  ${sqlText(row.body_part)},
  ${sqlText(row.equipment)},
  ${sqlText(row.target_muscle)},
  ${sqlArray(row.secondary_muscles)},
  ${sqlArray(row.instructions)},
  ${sqlStr(row.media_url)},
  ${sqlArray(row.media_urls)},
  ${sqlStr(row.media_kind)},
  ${sqlStr(row.source)},
  ${sqlStr(row.license)},
  ${sqlStr(row.license_author)}
)`);

const header = `insert into public.exercises (
  id, canonical_key, name, body_part, equipment, target_muscle, secondary_muscles,
  instructions, media_url, media_urls, media_kind, source, license, license_author
) values`;
const statements = [];
for (let i = 0; i < values.length; i += 40) {
  statements.push(`${header}\n${values.slice(i, i + 40).join(',\n')}\non conflict (id) do nothing;`);
}
const sql = `-- Combined exercise catalog. ExerciseDB wins, then the public-domain set, then wger.
-- ExerciseDB media and text are for non-commercial use and need an AscendAPI credit in the app.
${statements.join('\n\n')}

notify pgrst, 'reload schema';
`;
writeFileSync(dest, sql);
const counts = { exercisedb: 0, public_domain: 0, wger: 0 };
for (const row of rows) counts[row.source] += 1;
console.log(JSON.stringify({ total: rows.length, counts, bytes: sql.length }));
