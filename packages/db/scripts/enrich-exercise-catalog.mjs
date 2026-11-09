/**
 * Parse seeded exercise_catalog_01–04 SQL, enrich incomplete rows (rules only),
 * write a forward-only gap-fill migration + enrich-report.md.
 *
 * Usage:
 *   node packages/db/scripts/enrich-exercise-catalog.mjs
 *   node packages/db/scripts/enrich-exercise-catalog.mjs --dry-run
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const CATALOG_FILES = [
  '20261027120101_exercise_catalog_01.sql',
  '20261027120102_exercise_catalog_02.sql',
  '20261027120103_exercise_catalog_03.sql',
  '20261027120104_exercise_catalog_04.sql',
];

const ALLOWED_SOURCES = new Set(['exercisedb', 'wger', 'public_domain']);

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

function nextMigrationName() {
  const preferred = '20261109150000_enrich_exercise_catalog.sql';
  const files = readdirSync(migrationsDir).filter((f) => /^\d{14}_.+\.sql$/.test(f));
  // Idempotent regenerate: overwrite our own enrich migration when present.
  if (files.includes(preferred) || !files.some((f) => f.includes('enrich_exercise_catalog'))) {
    return preferred;
  }
  const latest = files.sort().at(-1);
  const latestTs = latest.slice(0, 14);
  let ts = String(Number(latestTs) + 10000);
  while (files.some((f) => f.startsWith(ts))) ts = String(Number(ts) + 1);
  return `${ts}_enrich_exercise_catalog.sql`;
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

function buildUpdateSql(id, patch) {
  const sets = [];
  if (patch.bodyPart != null) {
    sets.push(
      `body_part = case when coalesce(body_part, '') in ('', 'other') then ${sqlStr(patch.bodyPart)} else body_part end`,
    );
  }
  if (patch.equipment != null) {
    sets.push(
      `equipment = case when coalesce(equipment, '') = '' then ${sqlStr(patch.equipment)} else equipment end`,
    );
  }
  if (patch.targetMuscle != null) {
    sets.push(
      `target_muscle = case when coalesce(target_muscle, '') = '' then ${sqlStr(patch.targetMuscle)} else target_muscle end`,
    );
  }
  if (patch.category != null) {
    sets.push(`category = case when category is null then ${sqlStr(patch.category)} else category end`);
  }
  if (patch.isCompound != null) {
    sets.push(
      `is_compound = case when is_compound is null then ${patch.isCompound ? 'true' : 'false'} else is_compound end`,
    );
  }
  if (!sets.length) return null;
  return `update public.exercises\nset\n  ${sets.join(',\n  ')}\nwhere id = ${sqlStr(id)}\n  and source in ('exercisedb', 'wger', 'public_domain');`;
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

  const migrationName = nextMigrationName();
  const migrationPath = join(migrationsDir, migrationName);

  const sqlParts = [
    '-- Enrich incomplete catalogue metadata (rules-only gap fill).',
    '-- Only fills body_part/equipment/target_muscle when empty or body_part=other;',
    '-- only sets category/is_compound when null. Never overwrites good data.',
    '-- Touches source in (exercisedb, wger, public_domain) only.',
    '',
  ];
  for (const u of updates) {
    const stmt = buildUpdateSql(u.id, u.patch);
    if (stmt) sqlParts.push(stmt, '');
  }
  sqlParts.push(`notify pgrst, 'reload schema';`, '');

  const sampleNames = stillUnresolved.slice(0, 30).map((r) => `- ${r.name} (${r.source})`);

  const report = [
    '# Exercise catalogue enrichment report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Migration: \`${migrationName}\``,
    `Rows parsed: ${allRows.length}`,
    `Rows with at least one update: ${updates.length}`,
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
        before,
        after,
        unresolved: stillUnresolved.length,
        migration: dryRun ? null : migrationName,
        ruleHits,
      },
      null,
      2,
    ),
  );

  if (!dryRun) {
    writeFileSync(migrationPath, sqlParts.join('\n'));
    writeFileSync(reportPath, report);
    console.error(`wrote ${migrationPath}`);
    console.error(`wrote ${reportPath}`);
  } else {
    writeFileSync(reportPath, report);
    console.error(`dry-run: skipped migration; wrote ${reportPath}`);
  }
}

main();
