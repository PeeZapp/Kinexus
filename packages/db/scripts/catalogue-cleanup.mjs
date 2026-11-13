/**
 * Rules-only cleanup of the global exercise catalogue.
 * Reads seed catalogue SQL (+ enrich inference to approximate live gaps),
 * writes a forward-only guarded migration + catalogue-cleanup-report.md.
 * Does NOT apply SQL.
 *
 * Usage:
 *   node packages/db/scripts/catalogue-cleanup.mjs
 *   node packages/db/scripts/catalogue-cleanup.mjs --dry-run
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompleteIndexes,
  canonicalizeEquipment,
  inferExerciseEnrichment,
  isEmptyField,
} from './enrich-exercise-infer.mjs';
import {
  ALL_NAME_FIXES,
  buildCleanupIndexes,
  inferCatalogueCleanup,
  RESCUE_OVERRIDES_BY_NAME,
  SPECIFIC_FIXES_BY_NAME,
} from './catalogue-cleanup-infer.mjs';

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
const MIGRATION_STAMP = '20261112103000';
const MIGRATION_NAME = `${MIGRATION_STAMP}_exercise_catalog_cleanup.sql`;

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

/** Parse raw seed equipment (do not canonicalize — cleanup owns synonym rewrites). */
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
      status: 'active',
    });
  }
  return rows;
}

function sqlStr(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlTextOrNull(value) {
  return value == null ? 'null::text' : `${sqlStr(value)}::text`;
}

function applyEnrichPatch(row, patch) {
  const next = { ...row };
  if (patch.bodyPart != null && (!next.bodyPart || next.bodyPart === 'other')) next.bodyPart = patch.bodyPart;
  if (patch.equipment != null && isEmptyField(next.equipment)) {
    next.equipment = canonicalizeEquipment(patch.equipment);
  }
  if (patch.targetMuscle != null && isEmptyField(next.targetMuscle)) next.targetMuscle = patch.targetMuscle;
  if (patch.category != null && (next.category == null || next.category === '')) next.category = patch.category;
  if (patch.isCompound != null && next.isCompound == null) next.isCompound = patch.isCompound;
  return next;
}

function applyCleanupPatch(row, patch) {
  const next = { ...row };
  if (patch.equipment != null) next.equipment = patch.equipment;
  if (patch.category !== undefined) next.category = patch.category;
  return next;
}

function countStats(rows) {
  let nullCategory = 0;
  let emptyEquipment = 0;
  const equipmentValues = new Set();
  for (const r of rows) {
    if (!ALLOWED_SOURCES.has(r.source)) continue;
    if (r.status === 'hidden') continue;
    if (r.category == null || r.category === '') nullCategory += 1;
    if (isEmptyField(r.equipment)) emptyEquipment += 1;
    else equipmentValues.add(r.equipment);
  }
  return { nullCategory, emptyEquipment, distinctEquipment: equipmentValues.size, equipmentValues };
}

function buildIdUpdateSql(updates) {
  if (!updates.length) return null;
  const values = updates
    .map((u) => {
      const equip = u.patch.equipment != null ? sqlTextOrNull(u.patch.equipment) : 'null::text';
      const fromEquip =
        u.patch.equipment != null ? sqlTextOrNull(u.from.equipment ?? '') : 'null::text';
      const cat = u.patch.category !== undefined ? sqlTextOrNull(u.patch.category) : 'null::text';
      const fromCat =
        u.patch.category !== undefined ? sqlTextOrNull(u.from.category ?? null) : 'null::text';
      const hasEquip = u.patch.equipment != null ? 'true' : 'false';
      const hasCat = u.patch.category !== undefined ? 'true' : 'false';
      return `  (${sqlStr(u.id)}::uuid, ${equip}, ${fromEquip}, ${cat}, ${fromCat}, ${hasEquip}::boolean, ${hasCat}::boolean)`;
    })
    .join(',\n');

  return `update public.exercises as e
set
  equipment = case
    when v.has_equipment
      and e.equipment is not distinct from v.from_equipment
      then v.equipment
    else e.equipment
  end,
  category = case
    when v.has_category
      and e.category is not distinct from v.from_category
      then v.category
    else e.category
  end
from (values
${values}
) as v(id, equipment, from_equipment, category, from_category, has_equipment, has_category)
where e.id = v.id
  and e.scope = 'global'
  and e.status = 'active'
  and e.merged_into is null;`;
}

function buildNameFixSql(fix) {
  const parts = [];
  if (fix.equipment != null && fix.fromEquipment != null) {
    parts.push(`-- ${fix.name}: equipment ${fix.fromEquipment || '∅'} → ${fix.equipment}
update public.exercises
set equipment = ${sqlStr(fix.equipment)}
where name = ${sqlStr(fix.name)}
  and scope = 'global'
  and status = 'active'
  and merged_into is null
  and equipment is not distinct from ${sqlStr(fix.fromEquipment)};`);
  }
  if (fix.category !== undefined && Object.prototype.hasOwnProperty.call(fix, 'fromCategory')) {
    parts.push(`-- ${fix.name}: category ${fix.fromCategory ?? 'null'} → ${fix.category}
update public.exercises
set category = ${sqlStr(fix.category)}
where name = ${sqlStr(fix.name)}
  and scope = 'global'
  and status = 'active'
  and merged_into is null
  and category is not distinct from null;`);
  }
  return parts.join('\n\n');
}

function buildHideSql(ids) {
  if (!ids.length) return null;
  const values = ids.map((id) => `  (${sqlStr(id)}::uuid)`).join(',\n');
  return `-- Round 2: hide rows still missing BOTH category and equipment (stay in DB, leave library/plan pools).
update public.exercises as e
set status = 'hidden'
from (values
${values}
) as v(id)
where e.id = v.id
  and e.scope = 'global'
  and e.status = 'active'
  and e.merged_into is null
  and e.category is null
  and coalesce(e.equipment, '') = '';`;
}

function latestMigrationStamp() {
  const names = readdirSync(migrationsDir)
    .filter((n) => /^\d{14}_.+\.sql$/.test(n))
    .sort();
  return names.at(-1) ?? '(none)';
}

function main() {
  const allRows = [];
  for (const name of CATALOG_FILES) {
    allRows.push(...parseCatalogSql(readFileSync(join(migrationsDir, name), 'utf8')));
  }

  const allowed = allRows.filter((r) => ALLOWED_SOURCES.has(r.source));
  const enrichIndexes = buildCompleteIndexes(allowed);
  const afterEnrich = allowed.map((row) => {
    const { patch } = inferExerciseEnrichment(row, enrichIndexes);
    return applyEnrichPatch(row, patch);
  });

  const before = countStats(afterEnrich);
  const cleanupIndexes = buildCleanupIndexes(afterEnrich);

  const ruleHits = {
    equipment_synonym: 0,
    specific_fix: 0,
    name_equipment_mismatch: 0,
    empty_equipment_peer: 0,
    empty_equipment_name: 0,
    empty_equipment_bodyweight: 0,
    category_contradiction: 0,
    null_category_peer: 0,
    null_category_keyword: 0,
  };

  const idUpdates = [];
  const contradictions = [];
  const nameFixIds = new Set();
  for (const fix of ALL_NAME_FIXES) {
    const row = afterEnrich.find((r) => r.name.toLowerCase() === fix.name.toLowerCase());
    if (row) nameFixIds.add(row.id);
  }

  const afterCleanup = afterEnrich.map((row) => {
    const { patch, from, rules, changed } = inferCatalogueCleanup(row, cleanupIndexes);
    if (!changed) return row;
    for (const rule of rules) {
      if (ruleHits[rule] != null) ruleHits[rule] += 1;
    }
    if (rules.includes('category_contradiction') && patch.category != null) {
      contradictions.push({
        id: row.id,
        name: row.name,
        from: from.category,
        to: patch.category,
      });
    }
    if (nameFixIds.has(row.id) && rules.includes('specific_fix')) {
      return applyCleanupPatch(row, patch);
    }
    idUpdates.push({ id: row.id, name: row.name, patch, from, rules });
    return applyCleanupPatch(row, patch);
  });

  // Hide rows still missing BOTH category and equipment (existing status=hidden flag).
  const hideIds = [];
  const afterHide = afterCleanup.map((row) => {
    if ((row.category == null || row.category === '') && isEmptyField(row.equipment)) {
      hideIds.push(row.id);
      return { ...row, status: 'hidden' };
    }
    return row;
  });

  const after = countStats(afterHide);

  const unresolved = afterHide.filter((r) => {
    if (r.status === 'hidden') return false;
    return (r.category == null || r.category === '') || isEmptyField(r.equipment);
  });

  const unresolvedIncludingHidden = afterCleanup.filter((r) => {
    return (r.category == null || r.category === '') || isEmptyField(r.equipment);
  });

  const header = [
    `-- Global exercise catalogue cleanup (rules-only).`,
    `-- Synonym normalize, known wrong rows, name/equipment mismatches, gap fills, round-2 no-kit/kit/category rules.`,
    `-- Scope: scope='global', status='active', merged_into is null.`,
    `-- Idempotent: each change applies only when the row still has the old value.`,
    `-- Generated by packages/db/scripts/catalogue-cleanup.mjs — do not hand-edit.`,
    `-- Latest migration at generation: ${latestMigrationStamp()}`,
    '',
  ];

  const nameSql = ALL_NAME_FIXES.map(buildNameFixSql).filter(Boolean).join('\n\n');

  const filteredIdUpdates = idUpdates.filter((u) => {
    if (!nameFixIds.has(u.id)) return true;
    const nonSpecific = u.rules.filter((r) => r !== 'specific_fix');
    return nonSpecific.length > 0;
  });

  const bulk = buildIdUpdateSql(filteredIdUpdates);
  const hideSql = buildHideSql(hideIds);
  const parts = [...header];
  if (nameSql) {
    parts.push('-- Part 2: name-resolved specific fixes', '', nameSql, '');
  }
  if (bulk) {
    parts.push('-- Parts 1–3 + round 2: id-guarded bulk updates', '', bulk, '');
  }
  if (hideSql) {
    parts.push(hideSql, '');
  }
  parts.push(`notify pgrst, 'reload schema';`, '');
  const sql = parts.join('\n');

  const sample = unresolvedIncludingHidden
    .slice(0, 40)
    .map((r) => {
      const both = (r.category == null || r.category === '') && isEmptyField(r.equipment);
      const tag = both ? ' [hidden]' : '';
      return `- ${r.name}${tag} (equipment=${r.equipment || '∅'}, category=${r.category ?? 'null'})`;
    });

  const contradictionLines = contradictions.length
    ? contradictions.map((c) => `- ${c.name}: ${c.from} → ${c.to}`)
    : ['- (none)'];

  const report = [
    '# Exercise catalogue cleanup report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Migration: [\`${MIGRATION_NAME}\`](../supabase/migrations/${MIGRATION_NAME})`,
    `Rows (allowed sources): ${allowed.length}`,
    `Id-guarded updates: ${filteredIdUpdates.length}`,
    `Name-resolved Part 2 fixes: ${SPECIFIC_FIXES_BY_NAME.length}`,
    `Name-keyed rescues (avoid hide): ${RESCUE_OVERRIDES_BY_NAME.length}`,
    `Hidden (status=hidden, both null category + empty equipment): ${hideIds.length}`,
    '',
    'Live DB (verified earlier): null category 141, empty equipment 406.',
    'Simulated baseline below = seed catalogue + enrich inference.',
    '',
    '## Before / after (post-enrich baseline → cleanup round 2)',
    '',
    '| Metric | Before | After (active only) |',
    '| --- | ---: | ---: |',
    `| null category | ${before.nullCategory} | ${after.nullCategory} |`,
    `| empty equipment | ${before.emptyEquipment} | ${after.emptyEquipment} |`,
    `| distinct equipment values | ${before.distinctEquipment} | ${after.distinctEquipment} |`,
    '',
    '## Rule hits',
    '',
    '| Rule | Hits |',
    '| --- | ---: |',
    ...Object.entries(ruleHits).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `## Category contradictions fixed: ${contradictions.length}`,
    '',
    ...contradictionLines,
    '',
    `## Still unresolved before hide: ${unresolvedIncludingHidden.length}`,
    `## Still unresolved after hide (active rows only): ${unresolved.length}`,
    '',
    'Unresolved names ( `[hidden]` = both gaps → status=hidden ):',
    ...sample,
    unresolvedIncludingHidden.length > 40
      ? `- … and ${unresolvedIncludingHidden.length - 40} more`
      : '',
    '',
    '## Distinct equipment after (active rows)',
    '',
    [...after.equipmentValues].sort().map((v) => `- ${v}`).join('\n'),
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const migrationPath = join(migrationsDir, MIGRATION_NAME);
  const reportPath = join(__dirname, 'catalogue-cleanup-report.md');

  console.log(
    JSON.stringify(
      {
        dryRun,
        parsed: allowed.length,
        idUpdates: filteredIdUpdates.length,
        before,
        after,
        unresolvedActive: unresolved.length,
        unresolvedBeforeHide: unresolvedIncludingHidden.length,
        hidden: hideIds.length,
        contradictions: contradictions.length,
        migration: dryRun ? null : MIGRATION_NAME,
        ruleHits,
      },
      null,
      2,
    ),
  );

  writeFileSync(reportPath, report + '\n');
  console.error(`wrote ${reportPath}`);
  if (!dryRun) {
    writeFileSync(migrationPath, sql);
    console.error(`wrote ${migrationPath}`);
  }
}

main();
