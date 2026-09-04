import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'seeds', 'catalog-recipes.json');
const dest = join(root, 'supabase', 'migrations', '20260904141000_catalog_recipes.sql');

function uuidFromKey(key) {
  const bytes = Buffer.from(createHash('sha1').update(`kinexus.catalog.${key}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlStr(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value ?? []).replaceAll("'", "''")}'::jsonb`;
}

function sqlTextArray(values) {
  const list = (values ?? []).map((v) => `"${String(v).replaceAll('"', '\\"')}"`).join(',');
  return `'{${list}}'::text[]`;
}

function sqlNum(value) {
  if (value === null || value === undefined || value === '') return 'null';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : 'null';
}

function sqlBool(value) {
  return value ? 'true' : 'false';
}

const recipes = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(recipes) || recipes.length === 0) {
  throw new Error('catalog-recipes.json is empty');
}

const rows = recipes.map((r) => {
  const ingredients = (r.ingredients ?? []).map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    category: ing.category,
    baseRecipeId: ing.base_recipe_id,
  }));
  return `(
    '${uuidFromKey(r.id)}',
    ${sqlStr(r.id)},
    ${sqlStr(r.name)},
    ${sqlStr(r.emoji)},
    ${sqlStr(r.cuisine)},
    ${sqlNum(r.cook_time)},
    ${sqlNum(r.servings)},
    ${sqlNum(r.protein)},
    ${sqlNum(r.calories)},
    ${sqlNum(r.carbs)},
    ${sqlNum(r.fat)},
    ${sqlBool(Boolean(r.vegetarian))},
    ${sqlJson(ingredients)},
    ${sqlJson(r.method ?? [])},
    ${sqlStr(r.chef_tip)},
    ${sqlStr(r.notes)},
    ${sqlTextArray(r.meal_slots)},
    ${sqlBool(Boolean(r.is_component))},
    ${sqlBool(Boolean(r.excluded_from_auto))},
    ${sqlStr(r.source_url)},
    null,
    true
  )`;
});

const sql = `-- Catalog / system recipes copied from Huddle seed-recipes.json (read-only source).
-- household_id is null; clients may select but cannot insert/update catalog rows.

insert into public.recipes (
  id, catalog_key, name, emoji, cuisine, cook_time, servings,
  protein, calories, carbs, fat, vegetarian, ingredients, method,
  chef_tip, notes, meal_slots, is_component, excluded_from_auto, source_url,
  household_id, is_public
)
values
${rows.join(',\n')}
on conflict (catalog_key) do nothing;
`;

writeFileSync(dest, sql, 'utf8');
console.log(`Wrote ${recipes.length} catalog recipes to ${dest}`);
