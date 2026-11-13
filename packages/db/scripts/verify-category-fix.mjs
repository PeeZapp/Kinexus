/**
 * Simulate 20261113055100 category fixes against seed+enrich+cleanup baseline.
 * Run: node packages/db/scripts/verify-category-fix.mjs
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

function emptyish(v, set) {
  return set.includes(String(v ?? ''));
}

function applyFixes(rows) {
  const touched = [];
  const mark = (r, cat) => {
    if (r.category !== cat) {
      touched.push({ from: r.category, to: cat, name: r.name, body: r.body_part });
      r.category = cat;
    }
  };

  for (const r of rows) {
    const n = r.name;
    const cat = r.category ?? '';

    if (
      ['Chest', ''].includes(cat) &&
      /(reverse.*flye?s?|rear[\s-]*(delt[\s-]*)?flye?s?|rear[\s-]*fly|back[\s-]*flye?s?)/i.test(n)
    ) {
      mark(r, 'Shoulders');
      if (emptyish(r.body_part, ['', 'other', 'chest'])) r.body_part = 'shoulders';
      continue;
    }
    if (['Chest', ''].includes(cat) && /rear[\s-]*delt/i.test(n) && !/(row|stretch)/i.test(n)) {
      mark(r, 'Shoulders');
      continue;
    }
    if (cat === 'Chest' && /((lateral|front|side)[\s-]+raises?|side[\s-]+laterals?)/i.test(n)) {
      mark(r, 'Shoulders');
      continue;
    }
    if (
      cat === 'Chest' &&
      r.body_part === 'shoulders' &&
      !/(bench[\s-]*press|chest[\s-]*press|push-?ups?)/i.test(n)
    ) {
      mark(r, 'Shoulders');
      continue;
    }
    if (
      cat === 'Chest' &&
      /\b(overhead|military|push|seated|standing|arnold|bradford|rocky|scott|cuban|landmine|anti[\s-]*gravity|w-?press|para[\s-]*press|seesaw|iron[\s-]*cross)\b/i.test(
        n,
      ) &&
      /\bpress(es)?\b/i.test(n) &&
      !/(bench[\s-]*press|chest[\s-]*press|french[\s-]*press|jm[\s-]*|tate[\s-]*press|triceps?)/i.test(n)
    ) {
      mark(r, 'Shoulders');
      continue;
    }
    if (/face[\s-]*pulls?/i.test(n) && ['Chest', 'Back', ''].includes(cat)) {
      mark(r, 'Shoulders');
      continue;
    }
    if (
      /pull[\s-]*aparts?/i.test(n) &&
      ['Chest', 'Back', ''].includes(cat) &&
      !/(mobility|stretch|external[\s-]*rotation)/i.test(n)
    ) {
      mark(r, 'Shoulders');
      continue;
    }
    if (cat === 'Chest' && /handstand[\s-]*push/i.test(n)) {
      mark(r, 'Shoulders');
      continue;
    }
    if (/upright[\s-]+row/i.test(n) && cat === 'Back') {
      mark(r, 'Shoulders');
      continue;
    }
    if (
      ['Chest', ''].includes(cat) &&
      (/triceps?/i.test(n) ||
        /(french[\s-]*press|jm[\s-]*(bench[\s-]*)?press|tate[\s-]*press|skull|elbow[\s-]*press)/i.test(n) ||
        /(bench[\s-]*dips?|close[\s-]*grip|diamond[\s-]*push|narrow[\s-]*push)/i.test(n) ||
        (r.body_part === 'triceps' && /(extension|pushdowns?|push-?downs?|kickbacks?|dips?)/i.test(n))) &&
      !/(chest[\s-]*dip|dips?[\s-]*-?[\s-]*chest)/i.test(n)
    ) {
      mark(r, 'Triceps');
      continue;
    }
    if (
      cat === 'Chest' &&
      r.body_part === 'biceps' &&
      /\bcurls?\b/i.test(n) &&
      !/(leg[\s-]*curl|hamstring|wrist)/i.test(n)
    ) {
      mark(r, 'Biceps');
      continue;
    }
    if (
      cat === 'Chest' &&
      (/(hyperextension|muscle[\s-]*ups?|bench[\s-]*pull|incline[\s-]*bench[\s-]*pull|bench[\s-]*pull-?ups?)/i.test(n) ||
        (/pullover/i.test(n) && (r.body_part === 'back' || /lat/i.test(r.target_muscle ?? ''))))
    ) {
      mark(r, 'Back');
      continue;
    }
    if (
      cat === 'Triceps' &&
      r.body_part === 'legs' &&
      /glute/i.test(r.target_muscle ?? '') &&
      /kickback/i.test(n)
    ) {
      mark(r, 'Glutes');
      continue;
    }
    if (/shoulder[\s-]*shrug/i.test(n) && cat === 'Legs') {
      mark(r, 'Back');
      continue;
    }
    if (cat === 'Chest' && /(sit[\s-]*ups?|crunches?|butterfly[\s-]*sit)/i.test(n)) {
      mark(r, 'Core');
    }
  }
  return touched;
}

const byId = parseSeed();
parseEnrich(byId);
applyCleanup(byId);
const rows = [...byId.values()].filter((r) => r.name && r.name !== '?');
const touched = applyFixes(rows);

const byTo = {};
for (const t of touched) {
  byTo[t.to] = (byTo[t.to] || 0) + 1;
}
console.log('fixed', touched.length, byTo);

const remaining = {
  'shoulders+Chest': rows.filter((r) => r.category === 'Chest' && r.body_part === 'shoulders').map((r) => r.name),
  'triceps+Chest isolations': rows
    .filter(
      (r) =>
        r.category === 'Chest' &&
        (r.body_part === 'triceps' || /triceps?|french|jm |tate|skull|bench dip/i.test(r.name)),
    )
    .map((r) => r.name),
  'biceps+Chest': rows.filter((r) => r.category === 'Chest' && r.body_part === 'biceps').map((r) => r.name),
  'back+Chest': rows.filter((r) => r.category === 'Chest' && r.body_part === 'back').map((r) => r.name),
  'reverse fly still Chest': rows
    .filter((r) => r.category === 'Chest' && /reverse.*fly|rear.*fly|back fly/i.test(r.name))
    .map((r) => r.name),
  'face/upright/pull-apart wrong': rows
    .filter(
      (r) =>
        (/face[\s-]*pull/i.test(r.name) || /upright[\s-]+row/i.test(r.name) || /pull[\s-]*apart/i.test(r.name)) &&
        !['Shoulders'].includes(r.category),
    )
    .map((r) => `${r.category}: ${r.name}`),
};

console.log('\nremaining after fix:');
for (const [k, v] of Object.entries(remaining)) {
  console.log(`\n${k} (${v.length})`);
  for (const name of v.slice(0, 30)) console.log(' -', name);
}
