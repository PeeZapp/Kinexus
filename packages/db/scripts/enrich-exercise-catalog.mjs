/**
 * Parse seeded exercise_catalog_01–04 SQL, enrich incomplete rows (rules only),
 * write a forward-only gap-fill migration + enrich-report.md.
 *
 * Usage:
 *   node packages/db/scripts/enrich-exercise-catalog.mjs
 *   node packages/db/scripts/enrich-exercise-catalog.mjs --dry-run
 */
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompleteIndexes,
  inferExerciseEnrichment,
  isBodyPartGap,
  isEmptyField,
} from './enrich-exercise-infer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const dryRun = process.argv.includes('--dry-run');

/** Keep each shard small enough for Supabase SQL editor / snippet save limits. */
const CHUNK_SIZE = 250;
const CHUNK_TS_BASE = 20261109150001;

const CATALOG_FILES = [
  '20261027120101_exercise_catalog_01.sql',
  '20261027120102_exercise_catalog_02.sql',
  '20261027120103_exercise_catalog_03.sql',
  '20261027120104_exercise_catalog_04.sql',
];

const ALLOWED_SOURCES = new Set(['exercisedb', 'wger', 'public_domain']);
const ENRICH_FILE_RE = /^\d{14}_enrich_exercise_catalog(?:_.+)?\.sql$/;

function unquote(v) {
  const s = String(v).trim();
  if (s === 'null') return null;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function parseInstructions(tuple) {
  if (/\{\}::text\[\]/.test(tuple)) return [];
  const arr = tuple.match(/ARRAY\[([\s\S]*?)\]::text\[\]/);
  if (!arr) return [];
  const items = [];
  const itemRe = /'((?:[^']|'')*)'/g;
  let im;
  while ((im = itemRe.exec(arr[1]))) items.push(im[1].replace(/''/g, "'"));
  return items;
}

function parseCatalogSql(sql) {
  const rows = [];
  const tupleStartRe =
    /\(\s*'([0-9a-f-]{36})'\s*,\s*((?:'(?:[^']|'')*'|null))\s*,\s*((?:'(?:[^']|'')*'|null))\s*,\s*((?:'(?:[^']|'')*'|null))\s*,\s*((?:'(?:[^']|'')*'|null))\s*,\s*((?:'(?:[^']|'')*'|null))\s*,/gis;
  let m;
  while ((m = tupleStartRe.exec(sql))) {
    const start = m.index;
    let depth = 0;
    let end = start;
    for (let i = start; i < sql.length; i += 1) {
      const ch = sql[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const tuple = sql.slice(start, end + 1);
    const sourceMatch = tuple.match(/'(exercisedb|wger|public_domain|user|creator)'/);
    rows.push({
      id: m[1],
      canonicalKey: unquote(m[2]),
      name: unquote(m[3]) ?? '',
      bodyPart: unquote(m[4]) ?? '',
      equipment: unquote(m[5]) ?? '',
      targetMuscle: unquote(m[6]) ?? '',
      instructions: parseInstructions(tuple),
      source: sourceMatch?.[1] ?? '',
      category: null,
      isCompound: null,
    });
  }
  return rows;
}

function sqlStr(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function removePriorEnrichMigrations() {
  for (const name of readdirSync(migrationsDir)) {
    if (!ENRICH_FILE_RE.test(name)) continue;
    unlinkSync(join(migrationsDir, name));
  }
}

function chunkUpdates(updates, size) {
  const chunks = [];
  for (let i = 0; i < updates.length; i += size) chunks.push(updates.slice(i, i + size));
  return chunks;
}

function chunkMigrationName(index, total) {
  const pad = String(index + 1).padStart(2, '0');
  const ts = String(CHUNK_TS_BASE + index);
  return `${ts}_enrich_exercise_catalog_${pad}_of_${String(total).padStart(2, '0')}.sql`;
}

function buildChunkSql(chunk, index, total) {
  const header = [
    `-- Enrich incomplete catalogue metadata (rules-only gap fill).`,
    `-- Shard ${index + 1}/${total} (${chunk.length} rows).`,
    `-- Only fills body_part/equipment/target_muscle when empty or body_part=other;`,
    `-- only sets category/is_compound when null. Never overwrites good data.`,
    `-- Touches source in (exercisedb, wger, public_domain) only.`,
    `-- Idempotent: safe to re-run.`,
    '',
  ];
  const bulk = buildBulkUpdateSql(chunk);
  const parts = [...header];
  if (bulk) parts.push(bulk, '');
  if (index === total - 1) parts.push(`notify pgrst, 'reload schema';`, '');
  return parts.join('\n');
}

function countGaps(rows) {
  let bodyPart = 0;
  let equipment = 0;
  let targetMuscle = 0;
  let category = 0;
  let isCompound = 0;
  for (const r of rows) {
    if (!ALLOWED_SOURCES.has(r.source)) continue;
    if (isBodyPartGap(r.bodyPart)) bodyPart += 1;
    if (isEmptyField(r.equipment)) equipment += 1;
    if (isEmptyField(r.targetMuscle)) targetMuscle += 1;
    if (r.category == null || r.category === '') category += 1;
    if (r.isCompound == null) isCompound += 1;
  }
  return { bodyPart, equipment, targetMuscle, category, isCompound };
}

function applyPatch(row, patch) {
  const next = { ...row };
  if (patch.bodyPart != null && isBodyPartGap(next.bodyPart)) next.bodyPart = patch.bodyPart;
  if (patch.equipment != null && isEmptyField(next.equipment)) next.equipment = patch.equipment;
  if (patch.targetMuscle != null && isEmptyField(next.targetMuscle)) next.targetMuscle = patch.targetMuscle;
  if (patch.category != null && (next.category == null || next.category === '')) next.category = patch.category;
  if (patch.isCompound != null && next.isCompound == null) next.isCompound = patch.isCompound;
  return next;
}

function sqlTextOrNull(value) {
  return value == null ? 'null::text' : `${sqlStr(value)}::text`;
}

function sqlBoolOrNull(value) {
  if (value == null) return 'null::boolean';
  return `${value ? 'true' : 'false'}::boolean`;
}

function buildValuesRow(id, patch) {
  return `  (${sqlStr(id)}::uuid, ${sqlTextOrNull(patch.bodyPart)}, ${sqlTextOrNull(patch.equipment)}, ${sqlTextOrNull(patch.targetMuscle)}, ${sqlTextOrNull(patch.category)}, ${sqlBoolOrNull(patch.isCompound)})`;
}

/** Compact idempotent bulk update (safe to re-run). */
function buildBulkUpdateSql(updates) {
  if (!updates.length) return null;
  const values = updates.map((u) => buildValuesRow(u.id, u.patch)).join(',\n');
  return `update public.exercises as e
set
  body_part = case
    when v.body_part is not null and coalesce(e.body_part, '') in ('', 'other') then v.body_part
    else e.body_part
  end,
  equipment = case
    when v.equipment is not null and coalesce(e.equipment, '') = '' then v.equipment
    else e.equipment
  end,
  target_muscle = case
    when v.target_muscle is not null and coalesce(e.target_muscle, '') = '' then v.target_muscle
    else e.target_muscle
  end,
  category = case
    when v.category is not null and e.category is null then v.category
    else e.category
  end,
  is_compound = case
    when v.is_compound is not null and e.is_compound is null then v.is_compound
    else e.is_compound
  end
from (values
${values}
) as v(id, body_part, equipment, target_muscle, category, is_compound)
where e.id = v.id
  and e.source in ('exercisedb', 'wger', 'public_domain');`;
}

function main() {
  const allRows = [];
  for (const name of CATALOG_FILES) {
    const path = join(migrationsDir, name);
    const rows = parseCatalogSql(readFileSync(path, 'utf8'));
    allRows.push(...rows);
  }

  const before = countGaps(allRows);
  const indexes = buildCompleteIndexes(allRows.filter((r) => ALLOWED_SOURCES.has(r.source)));

  const ruleHits = {
    same_exercise: 0,
    keyword_name: 0,
    keyword_instructions: 0,
    derived_category: 0,
    compound_rule: 0,
  };

  const updates = [];
  const enriched = allRows.map((row) => {
    if (!ALLOWED_SOURCES.has(row.source)) return row;
    const { patch, sources, changed } = inferExerciseEnrichment(row, indexes);
    if (!changed) return row;
    for (const src of Object.values(sources)) {
      if (ruleHits[src] != null) ruleHits[src] += 1;
    }
    updates.push({ id: row.id, name: row.name, patch, sources });
    return applyPatch(row, patch);
  });

  const after = countGaps(enriched);

  const stillUnresolved = enriched.filter((r) => {
    if (!ALLOWED_SOURCES.has(r.source)) return false;
    return isBodyPartGap(r.bodyPart) || isEmptyField(r.equipment) || isEmptyField(r.targetMuscle);
  });

  const chunks = chunkUpdates(updates, CHUNK_SIZE);
  const migrationNames = chunks.map((_, i) => chunkMigrationName(i, chunks.length));

  const sampleNames = stillUnresolved.slice(0, 30).map((r) => `- ${r.name} (${r.source})`);

  const report = [
    '# Exercise catalogue enrichment report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Migrations:`,
    ...migrationNames.map((n) => `- \`${n}\``),
    `Rows parsed: ${allRows.length}`,
    `Rows with at least one update: ${updates.length}`,
    `Chunk size: ${CHUNK_SIZE}`,
    '',
    '## Gap counts (allowed sources)',
    '',
    '| Field | Before | After | Filled |',
    '| --- | ---: | ---: | ---: |',
    `| body_part empty/other | ${before.bodyPart} | ${after.bodyPart} | ${before.bodyPart - after.bodyPart} |`,
    `| equipment empty | ${before.equipment} | ${after.equipment} | ${before.equipment - after.equipment} |`,
    `| target_muscle empty | ${before.targetMuscle} | ${after.targetMuscle} | ${before.targetMuscle - after.targetMuscle} |`,
    `| category null | ${before.category} | ${after.category} | ${before.category - after.category} |`,
    `| is_compound null | ${before.isCompound} | ${after.isCompound} | ${before.isCompound - after.isCompound} |`,
    '',
    '## Rule hit counts (field-level)',
    '',
    '| Rule | Hits |',
    '| --- | ---: |',
    ...Object.entries(ruleHits).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `## Remaining unresolved (body/equipment/target): ${stillUnresolved.length}`,
    '',
    'Sample names:',
    ...sampleNames,
    '',
  ].join('\n');

  const reportPath = join(__dirname, 'enrich-report.md');

  console.log(
    JSON.stringify(
      {
        dryRun,
        parsed: allRows.length,
        updates: updates.length,
        chunks: chunks.length,
        chunkSize: CHUNK_SIZE,
        before,
        after,
        unresolved: stillUnresolved.length,
        migrations: dryRun ? null : migrationNames,
        ruleHits,
      },
      null,
      2,
    ),
  );

  if (!dryRun) {
    removePriorEnrichMigrations();
    for (let i = 0; i < chunks.length; i += 1) {
      const name = migrationNames[i];
      const path = join(migrationsDir, name);
      writeFileSync(path, buildChunkSql(chunks[i], i, chunks.length));
      console.error(`wrote ${path}`);
    }
    writeFileSync(reportPath, report);
    console.error(`wrote ${reportPath}`);
  } else {
    writeFileSync(reportPath, report);
    console.error(`dry-run: skipped migrations; wrote ${reportPath}`);
  }
}

main();
