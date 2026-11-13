/**
 * One-off audit: seed + enrich (+ cleanup contradictions) → remaining category mismatches.
 * Run: node packages/db/scripts/audit-category-mismatches.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY_CONTRADICTIONS, SPECIFIC_FIXES_BY_ID } from './catalogue-cleanup-infer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mig = path.join(__dirname, '../supabase/migrations');

function parseSeed() {
  const byId = new Map();
  for (const f of fs.readdirSync(mig).filter((x) => /2026102712010[123]_exercise_catalog/.test(x))) {
    const text = fs.readFileSync(path.join(mig, f), 'utf8');
    const blocks = text.split(/\n\(\n\s*'/).slice(1);
    for (const block of blocks) {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const head = lines.slice(0, 12).join('\n');
      const m = head.match(
        /^([0-9a-f-]{36})',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)'/s,
      );
      if (!m) continue;
      byId.set(m[1], {
        id: m[1],
        name: m[3].replace(/\\'/g, "'"),
        body_part: m[4],
        equipment: m[5],
        target_muscle: m[6],
        category: null,
        is_compound: null,
      });
    }
  }
  return byId;
}

function parseEnrich(byId) {
  const re =
    /\('([0-9a-f-]{36})'::uuid,\s*(null|'[^']*')::text,\s*(null|'[^']*')::text,\s*(null|'[^']*')::text,\s*(null|'[^']*')::text,\s*(null|true|false)::boolean\)/g;
  for (const f of fs.readdirSync(mig).filter((x) => /enrich_exercise_catalog_.*\.sql$/.test(x))) {
    const text = fs.readFileSync(path.join(mig, f), 'utf8');
    let m;
    while ((m = re.exec(text))) {
      const clean = (v) => (v === 'null' ? null : v.slice(1, -1));
      const row = byId.get(m[1]) || {
        id: m[1],
        name: '?',
        body_part: '',
        equipment: '',
        target_muscle: '',
        category: null,
        is_compound: null,
      };
      const bp = clean(m[2]);
      const eq = clean(m[3]);
      const tm = clean(m[4]);
      const cat = clean(m[5]);
      const compound = m[6] === 'null' ? null : m[6] === 'true';
      if (bp && (!row.body_part || row.body_part === 'other')) row.body_part = bp;
      if (eq && !row.equipment) row.equipment = eq;
      if (tm && !row.target_muscle) row.target_muscle = tm;
      if (cat && row.category == null) row.category = cat;
      if (compound != null && row.is_compound == null) row.is_compound = compound;
      byId.set(m[1], row);
    }
  }
}

function applyCleanup(byId) {
  for (const [id, fix] of Object.entries(SPECIFIC_FIXES_BY_ID)) {
    const row = byId.get(id);
    if (!row) continue;
    if (fix.category != null) {
      if (fix.fromCategory === undefined || row.category === fix.fromCategory) row.category = fix.category;
    }
  }
  for (const row of byId.values()) {
    for (const rule of CATEGORY_CONTRADICTIONS) {
      if (!rule.onlyFrom.includes(row.category)) continue;
      if (!rule.test.test(row.name)) continue;
      if (rule.neg && rule.neg.test(row.name)) continue;
      row.category = rule.category;
      break;
    }
  }
}

function group(title, rows) {
  console.log(`\n## ${title} (${rows.length})`);
  for (const r of rows.slice(0, 40)) {
    console.log(`- [${r.category}|${r.body_part}|${r.target_muscle}] ${r.name}`);
  }
  if (rows.length > 40) console.log(`  … +${rows.length - 40} more`);
}

const byId = parseSeed();
parseEnrich(byId);
applyCleanup(byId);
const all = [...byId.values()].filter((r) => r.name && r.name !== '?');

const chest = all.filter((r) => r.category === 'Chest');

group(
  'shoulders body_part + Chest category',
  chest.filter((r) => r.body_part === 'shoulders'),
);
group(
  'Chest named reverse/rear/back fly',
  chest.filter((r) =>
    /(reverse.*flye?s?|rear[\s-]*(delt[\s-]*)?flye?s?|rear[\s-]*fly|back[\s-]*flye?s?)/i.test(r.name),
  ),
);
group(
  'Chest named rear delt (non-row)',
  chest.filter((r) => /rear[\s-]*delt/i.test(r.name) && !/row|stretch/i.test(r.name)),
);
group(
  'Chest named lateral/front/side raise',
  chest.filter((r) => /(lateral|front|side)[\s-]+raises?|side[\s-]+laterals?/i.test(r.name)),
);
group(
  'Chest + triceps cues (french/jm/tate/skull/elbow press/bench dip)',
  chest.filter((r) =>
    /triceps?|french[\s-]*press|jm[\s-]*(bench[\s-]*)?press|tate[\s-]*press|skull|elbow[\s-]*press|bench[\s-]*dips?/i.test(
      r.name,
    ),
  ),
);
group(
  'triceps body_part + Chest category',
  chest.filter((r) => r.body_part === 'triceps'),
);
group(
  'biceps body_part + Chest category',
  chest.filter((r) => r.body_part === 'biceps' || (/\bcurls?\b/i.test(r.name) && !/leg[\s-]*curl|hamstring/i.test(r.name))),
);
group(
  'back body_part + Chest category',
  chest.filter((r) => r.body_part === 'back'),
);
group(
  'Chest named hyperextension / muscle-up / bench pull / pullover',
  chest.filter((r) =>
    /hyperextension|muscle[\s-]*up|bench[\s-]*pull|incline[\s-]*bench[\s-]*pull|pullover/i.test(r.name),
  ),
);
group(
  'Chest named face pull / pull-apart / upright row',
  all.filter((r) =>
    (/face[\s-]*pulls?/i.test(r.name) || /pull[\s-]*aparts?/i.test(r.name) || /upright[\s-]+row/i.test(r.name)) &&
    ['Chest', 'Back'].includes(r.category),
  ),
);
group(
  'Triceps category + glute kickback',
  all.filter((r) => r.category === 'Triceps' && /kickback/i.test(r.name) && /glute|legs/i.test(`${r.body_part} ${r.target_muscle} ${r.name}`)),
);
group(
  'Legs category + shoulder shrug',
  all.filter((r) => r.category === 'Legs' && /shrug/i.test(r.name)),
);
group(
  'Chest + sit-up/crunch leftovers',
  chest.filter((r) => /sit[\s-]*up|crunch|butterfly\s+sit/i.test(r.name)),
);
group(
  'Chest + overhead/military/push/seated/standing press (no bench/chest/push-up)',
  chest.filter(
    (r) =>
      /\b(overhead|military|push|seated|standing|arnold|bradford|scott|landmine|cuban)\b.*\bpress|\bpress\b.*\b(overhead|military|seated|standing)/i.test(
        r.name,
      ) && !/bench[\s-]*press|chest[\s-]*press|push-?up/i.test(r.name),
  ),
);

console.log('\n## totals');
console.log('exercises', all.length);
console.log(
  'Chest total',
  chest.length,
  'shoulders+Chest',
  chest.filter((r) => r.body_part === 'shoulders').length,
  'triceps+Chest',
  chest.filter((r) => r.body_part === 'triceps').length,
  'back+Chest',
  chest.filter((r) => r.body_part === 'back').length,
  'biceps+Chest',
  chest.filter((r) => r.body_part === 'biceps').length,
);
