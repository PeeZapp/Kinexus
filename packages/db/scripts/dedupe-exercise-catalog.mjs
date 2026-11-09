/**
 * Near-dedupe catalogue exercises (exercisedb | wger | public_domain).
 * Writes a forward-only migration + dedupe-report.md. Does not apply SQL.
 *
 * Usage:
 *   node packages/db/scripts/dedupe-exercise-catalog.mjs
 *   node packages/db/scripts/dedupe-exercise-catalog.mjs --dry-run
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
import {
  groupNearDuplicates,
  mergeFieldPayload,
  pickCanonical,
} from './dedupe-exercise-infer.mjs';

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
const MIGRATION_NAME = '20261109180000_exercise_catalog_dedupe.sql';

function unquote(v) {
  const s = String(v).trim();
  if (s === 'null') return null;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function parseTextArray(fragment) {
  if (!fragment || /\{\}::text\[\]/.test(fragment)) return [];
  const arr = fragment.match(/ARRAY\[([\s\S]*?)\]::text\[\]/);
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
    // secondary_muscles then instructions then media_url, media_kind
    const afterTarget = tuple.slice(m[0].length);
    const secondaryMatch = afterTarget.match(/^(\{\}::text\[\]|ARRAY\[[\s\S]*?\]::text\[])\s*,/);
    const secondaryMuscles = secondaryMatch ? parseTextArray(secondaryMatch[1]) : [];
    const afterSecondary = secondaryMatch ? afterTarget.slice(secondaryMatch[0].length) : afterTarget;
    const instructionsMatch = afterSecondary.match(/^(\{\}::text\[\]|ARRAY\[[\s\S]*?\]::text\[])\s*,/);
    const instructions = instructionsMatch ? parseTextArray(instructionsMatch[1]) : [];
    const afterInstructions = instructionsMatch
      ? afterSecondary.slice(instructionsMatch[0].length)
      : afterSecondary;
    const mediaMatch = afterInstructions.match(/^((?:'(?:[^']|'')*'|null))\s*,\s*((?:'(?:[^']|'')*'|null))/);
    const mediaUrl = mediaMatch ? unquote(mediaMatch[1]) : null;
    const mediaKind = mediaMatch ? unquote(mediaMatch[2]) : null;

    rows.push({
      id: m[1],
      canonicalKey: unquote(m[2]),
      name: unquote(m[3]) ?? '',
      bodyPart: unquote(m[4]) ?? '',
      equipment: unquote(m[5]) ?? '',
      targetMuscle: unquote(m[6]) ?? '',
      secondaryMuscles,
      instructions,
      mediaUrl,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      mediaKind,
      source: sourceMatch?.[1] ?? '',
      category: null,
      isCompound: null,
    });
  }
  return rows;
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlTextArray(values) {
  const items = (values ?? []).map((v) => String(v).replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (items.length === 0) return `'{}'::text[]`;
  return `ARRAY[${items.map((v) => sqlStr(v)).join(', ')}]::text[]`;
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

function buildCanonicalUpdate(canonical, payload) {
  const sets = [
    `aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ${sqlTextArray(payload.aliases)}) as a)`,
  ];
  if (payload.mediaUrl) {
    sets.push(`media_url = coalesce(nullif(media_url, ''), ${sqlStr(payload.mediaUrl)})`);
  }
  if (payload.mediaKind) {
    sets.push(`media_kind = coalesce(media_kind, ${sqlStr(payload.mediaKind)})`);
  }
  if (payload.mediaUrls.length) {
    sets.push(
      `media_urls = case when coalesce(array_length(media_urls, 1), 0) = 0 then ${sqlTextArray(payload.mediaUrls)} else (select array_agg(distinct u) from unnest(media_urls || ${sqlTextArray(payload.mediaUrls)}) as u) end`,
    );
  }
  if (payload.instructions.length) {
    sets.push(
      `instructions = case when coalesce(array_length(instructions, 1), 0) = 0 then ${sqlTextArray(payload.instructions)} else instructions end`,
    );
  }
  if (payload.secondary.length) {
    sets.push(
      `secondary_muscles = (select array_agg(distinct m) from unnest(coalesce(secondary_muscles, '{}'::text[]) || ${sqlTextArray(payload.secondary)}) as m)`,
    );
  }
  return `update public.exercises\nset\n  ${sets.join(',\n  ')}\nwhere id = ${sqlStr(canonical.id)}\n  and source in ('exercisedb', 'wger', 'public_domain');`;
}

function buildHideUpdate(hidden, canonicalId) {
  return `update public.exercises\nset\n  merged_into = ${sqlStr(canonicalId)},\n  status = 'hidden'\nwhere id = ${sqlStr(hidden.id)}\n  and source in ('exercisedb', 'wger', 'public_domain')\n  and merged_into is null;`;
}

function main() {
  const allRows = [];
  for (const name of CATALOG_FILES) {
    const path = join(migrationsDir, name);
    allRows.push(...parseCatalogSql(readFileSync(path, 'utf8')));
  }

  const allowed = allRows.filter((r) => ALLOWED_SOURCES.has(r.source));
  const indexes = buildCompleteIndexes(allowed);
  const enriched = allowed.map((row) => {
    const { patch, changed } = inferExerciseEnrichment(row, indexes);
    return changed ? applyPatch(row, patch) : row;
  });

  const groups = groupNearDuplicates(enriched);
  const plans = [];
  for (const group of groups) {
    const canonical = pickCanonical(group);
    const hidden = group.filter((r) => r.id !== canonical.id);
    const payload = mergeFieldPayload(canonical, hidden);
    plans.push({ canonical, hidden, payload });
  }

  const rowsHidden = plans.reduce((n, p) => n + p.hidden.length, 0);

  const sqlParts = [
    '-- Near-dedupe catalogue exercises: keep one visible row per movement+equipment+target.',
    '-- Non-canonical rows get merged_into + status=hidden (never deleted).',
    '-- Missing media / instructions / secondary muscles copy onto the canonical row;',
    '-- hidden names become aliases for search.',
    '',
    'alter table public.exercises',
    '  add column if not exists merged_into uuid references public.exercises (id),',
    "  add column if not exists aliases text[] not null default '{}';",
    '',
    'create index if not exists exercises_merged_into_idx',
    '  on public.exercises (merged_into)',
    '  where merged_into is not null;',
    '',
    'create index if not exists exercises_aliases_gin_idx',
    '  on public.exercises using gin (aliases);',
    '',
  ];

  for (const plan of plans) {
    sqlParts.push(buildCanonicalUpdate(plan.canonical, plan.payload), '');
    for (const hidden of plan.hidden) {
      sqlParts.push(buildHideUpdate(hidden, plan.canonical.id), '');
    }
  }

  sqlParts.push(`notify pgrst, 'reload schema';`, '');

  const sample = plans.slice(0, 40).map((plan) => {
    const hiddenNames = plan.hidden.map((h) => h.name).join(' · ');
    return `- **${plan.canonical.name}** ← ${hiddenNames}`;
  });

  const risky = plans
    .map((plan) => {
      const eqs = new Set(plan.hidden.map((h) => h.equipment || '(empty)').concat(plan.canonical.equipment || '(empty)'));
      const targets = new Set(
        plan.hidden.map((h) => h.targetMuscle || '(empty)').concat(plan.canonical.targetMuscle || '(empty)'),
      );
      const names = [plan.canonical, ...plan.hidden].map((r) => r.name);
      const angleHit = names.some((n) => /\b(incline|decline|flat)\b/i.test(n));
      const equipSpread = [...eqs].filter((e) => e !== '(empty)').length > 1;
      const risk =
        (equipSpread ? 3 : 0) +
        (angleHit ? 3 : 0) +
        (targets.size > 2 ? 1 : 0) +
        Math.min(3, plan.hidden.length) +
        (names.some((n) => /\b(press|row|curl|squat)\b/i.test(n)) ? 1 : 0);
      return { plan, risk, eqs, targets };
    })
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5);

  const report = [
    '# Exercise catalogue near-dedupe report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Migration: \`${MIGRATION_NAME}\``,
    `Catalogue rows considered: ${enriched.length}`,
    `Groups found: ${plans.length}`,
    `Rows hidden: ${rowsHidden}`,
    '',
    '## Riskiest merges (spot-check)',
    '',
    ...risky.map(
      (item, i) =>
        `${i + 1}. **${item.plan.canonical.name}** ← ${item.plan.hidden.map((h) => h.name).join(' · ')} _(eq: ${[...item.eqs].join(', ')}; target: ${[...item.targets].join(', ')})_`,
    ),
    '',
    '## Sample groups (40)',
    '',
    ...sample,
    '',
  ].join('\n');

  const migrationPath = join(migrationsDir, MIGRATION_NAME);
  const reportPath = join(__dirname, 'dedupe-report.md');

  console.log(
    JSON.stringify(
      {
        dryRun,
        considered: enriched.length,
        groups: plans.length,
        rowsHidden,
        migration: dryRun ? null : MIGRATION_NAME,
        riskiest: risky.map((r) => ({
          canonical: r.plan.canonical.name,
          hidden: r.plan.hidden.map((h) => h.name),
        })),
      },
      null,
      2,
    ),
  );

  writeFileSync(reportPath, report);
  console.error(`wrote ${reportPath}`);
  if (!dryRun) {
    writeFileSync(migrationPath, sqlParts.join('\n'));
    console.error(`wrote ${migrationPath}`);
  }
}

main();
