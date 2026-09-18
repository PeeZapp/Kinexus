/**
 * Import TheMealDB meals into the Kinexus catalog via official API endpoints.
 *
 * Development (now): uses test key `1`.
 * Production / App Store: set THEMEALDB_API_KEY to the lifetime premium key, then:
 *   pnpm --filter @kinexus/db import-themealdb
 *   pnpm db:push
 *
 * Attribution: Recipe data and imagery from TheMealDB (https://www.themealdb.com/).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const existingPath = join(root, 'seeds', 'catalog-recipes.json');
const outJson = join(root, 'seeds', 'catalog-recipes-themealdb.json');
const outSql = join(root, 'supabase', 'migrations', '20260904153000_catalog_themealdb_recipes.sql');

const API_KEY = process.env.THEMEALDB_API_KEY?.trim() || '1';
const BASE = `https://www.themealdb.com/api/json/v1/${API_KEY}`;
const UA = 'KinexusCatalog/1.0 (https://github.com/PeeZapp/Kinexus; official TheMealDB API import)';

const STOP = new Set([
  'with', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'from', 'or',
  'style', 'classic', 'crispy', 'creamy', 'spiced', 'herbed', 'fresh', 'homemade',
  'loaded', 'perfect', 'fluffy', 'traditional', 'rustic', 'golden', 'hearty',
  'inspired', 'simple', 'easy', 'quick', 'best', 'basic',
]);

const SYNONYM = {
  aubergine: 'eggplant',
  prawn: 'shrimp',
  prawns: 'shrimp',
  chilli: 'chili',
  chile: 'chili',
  coriander: 'cilantro',
  mince: 'beef',
  fillet: 'fish',
  noodles: 'noodle',
  potatoes: 'potato',
  tomatoes: 'tomato',
  onions: 'onion',
  eggs: 'egg',
};

const MEAT = /\b(chicken|beef|pork|lamb|turkey|bacon|ham|sausage|chorizo|duck|veal|goat|prosciutto|salami|mince|steak|ribs?)\b/i;
const SEAFOOD = /\b(fish|salmon|tuna|shrimp|prawn|cod|trout|crab|lobster|anchovy|sardine|mussel|clam|oyster|squid)\b/i;

const AREA_CUISINE = {
  american: 'American',
  'united states': 'American',
  british: 'British',
  irish: 'British',
  french: 'French',
  france: 'French',
  italian: 'Italian',
  mexican: 'Mexican',
  indian: 'Indian',
  india: 'Indian',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  greek: 'Greek',
  spanish: 'Spanish',
  turkish: 'Turkish',
  moroccan: 'North African',
  algerian: 'North African',
  tunisian: 'North African',
  egyptian: 'North African',
  lebanese: 'Middle Eastern',
  syrian: 'Middle Eastern',
  'saudi arabian': 'Middle Eastern',
  canadian: 'American',
  australian: 'Australian',
  polish: 'European',
  dutch: 'European',
  netherlands: 'European',
  portuguese: 'European',
  croatian: 'European',
  russian: 'European',
  ukrainian: 'European',
  slovak: 'European',
  slovakia: 'European',
  norwegian: 'Scandinavian',
  norway: 'Scandinavian',
  jamaican: 'Caribbean',
  filipino: 'Asian',
  malaysian: 'Asian',
  kenyan: 'African',
  argentinian: 'Latin American',
  argentina: 'Latin American',
  venezuelan: 'Latin American',
  venezuela: 'Latin American',
  uruguayan: 'Latin American',
};

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
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : 'null';
}

function sqlBool(value) {
  return value ? 'true' : 'false';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => SYNONYM[w] ?? w)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jaccard(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function containedDish(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size < 2 || B.size < 2) return false;
  const [small, large] = A.size <= B.size ? [A, B] : [B, A];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter += 1;
  return inter === small.size && small.size / large.size >= 0.55;
}

function ingredientOverlap(a, b) {
  const names = (list) =>
    new Set(
      (list ?? [])
        .map((ing) => String(ing.name ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/)[0])
        .filter((w) => w && w.length > 2 && !STOP.has(w)),
    );
  const A = names(a);
  const B = names(b);
  if (A.size < 4 || B.size < 4) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / Math.min(A.size, B.size);
}

function isNearDuplicate(candidate, existing) {
  if (jaccard(candidate.name, existing.name) >= 0.72) return true;
  if (containedDish(candidate.name, existing.name)) return true;
  if (
    jaccard(candidate.name, existing.name) >= 0.48 &&
    ingredientOverlap(candidate.ingredients, existing.ingredients) >= 0.75
  ) {
    return true;
  }
  return false;
}

function ingredientCategory(name) {
  const n = name.toLowerCase();
  if (MEAT.test(n) || /\b(meat|poultry)\b/.test(n)) return 'meat';
  if (SEAFOOD.test(n)) return 'meat';
  if (/\b(milk|cream|butter|cheese|yogurt|yoghurt|egg)\b/.test(n)) return 'dairy';
  if (/\b(apple|banana|lemon|lime|orange|berry|mango|grape|fruit|raisin)\b/.test(n)) return 'fruit';
  if (/\b(flour|rice|oat|pasta|noodle|bread|quinoa|barley|couscous|cornmeal)\b/.test(n)) return 'grains';
  if (/\b(salt|pepper|cumin|paprika|cinnamon|oregano|thyme|basil|spice|chili powder)\b/.test(n)) return 'spices';
  if (/\b(oil|sauce|vinegar|soy|ketchup|mayo|mustard|stock|broth)\b/.test(n)) return 'condiments';
  if (/\b(can|canned|tomato paste|chickpea|bean)\b/.test(n)) return 'canned';
  if (/\b(frozen)\b/.test(n)) return 'frozen';
  if (/\b(water|wine|juice|beer)\b/.test(n)) return 'beverages';
  if (/\b(onion|garlic|tomato|carrot|potato|pepper|spinach|lettuce|celery|broccoli|vegetable)\b/.test(n)) {
    return 'vegetables';
  }
  return 'other';
}

function cuisineFrom(area, category, title) {
  const key = String(area ?? '').trim().toLowerCase();
  if (key && AREA_CUISINE[key]) return AREA_CUISINE[key];
  if (key) return String(area).trim();
  const blob = `${category} ${title}`.toLowerCase();
  if (/italian|pasta|risotto|lasagna|pizza/.test(blob)) return 'Italian';
  if (/french/.test(blob)) return 'French';
  if (/mexican|taco|enchilada|burrito/.test(blob)) return 'Mexican';
  if (/indian|curry|masala|biryani/.test(blob)) return 'Indian';
  if (/chinese|stir.?fry/.test(blob)) return 'Chinese';
  if (/japanese|sushi|ramen|teriyaki/.test(blob)) return 'Japanese';
  if (/thai/.test(blob)) return 'Thai';
  return 'International';
}

function mealSlotsFrom(category, title) {
  const blob = `${category} ${title}`.toLowerCase();
  if (/\b(dessert)\b/.test(blob) || /\b(cake|cookie|brownie|pudding|pie|tart|pastry|ice cream|cupcake)\b/.test(blob)) {
    return ['dessert'];
  }
  if (/\b(breakfast|pancake|waffle|granola|oatmeal|omelette|omelet|scrambled|muffin)\b/.test(blob)) {
    return ['breakfast'];
  }
  if (/\b(starter|side|snack|appetizer)\b/.test(blob)) return ['afternoon_snack', 'lunch'];
  if (/\b(salad|sandwich|soup|wrap)\b/.test(blob)) return ['lunch'];
  return ['dinner', 'lunch'];
}

function emojiFrom(category, title, vegetarian) {
  const blob = `${category} ${title}`.toLowerCase();
  if (/\bcake|cupcake\b/.test(blob)) return '🍰';
  if (/\bcookie|brownie\b/.test(blob)) return '🍪';
  if (/\bpancake|waffle\b/.test(blob)) return '🥞';
  if (/\bsalad\b/.test(blob)) return '🥗';
  if (/\bsoup|stew|broth\b/.test(blob)) return '🍲';
  if (/\bpasta|noodle|spaghetti\b/.test(blob)) return '🍝';
  if (/\brice|biryani|paella\b/.test(blob)) return '🍚';
  if (/\bpizza\b/.test(blob)) return '🍕';
  if (/\btaco|burrito|enchilada\b/.test(blob)) return '🌮';
  if (/\bburger\b/.test(blob)) return '🍔';
  if (/\bsandwich|toast\b/.test(blob)) return '🥪';
  if (/\begg|omelet|omelette|shakshuka\b/.test(blob)) return '🍳';
  if (/\bfish|salmon|tuna\b/.test(blob)) return '🐟';
  if (/\bshrimp|prawn\b/.test(blob)) return '🦐';
  if (/\bchicken\b/.test(blob)) return '🍗';
  if (/\bbeef|steak\b/.test(blob)) return '🥩';
  if (/\bpork|bacon\b/.test(blob)) return '🥓';
  if (/\blamb|goat\b/.test(blob)) return '🍖';
  if (/\btofu|lentil|bean|chickpea|vegetarian|vegan\b/.test(blob) || vegetarian) return '🥬';
  if (/\bbread\b/.test(blob)) return '🍞';
  if (/\bdessert\b/.test(blob)) return '🍮';
  return '🍽️';
}

function estimateMacros(ingredients, slots, vegetarian) {
  const names = (ingredients ?? []).map((i) => i.name).join(' ');
  const slot = slots.includes('dinner')
    ? 'dinner'
    : slots.includes('lunch')
      ? 'lunch'
      : slots.includes('breakfast')
        ? 'breakfast'
        : slots.includes('dessert')
          ? 'dessert'
          : 'afternoon_snack';
  const assumed = {
    breakfast: { calories: 380, protein: 18, carbs: 48, fat: 12 },
    lunch: { calories: 520, protein: 28, carbs: 52, fat: 18 },
    dinner: { calories: 620, protein: 36, carbs: 48, fat: 24 },
    dessert: { calories: 280, protein: 5, carbs: 42, fat: 10 },
    afternoon_snack: { calories: 180, protein: 7, carbs: 22, fat: 7 },
  }[slot];
  let { calories, protein, carbs, fat } = assumed;
  if (MEAT.test(names) || SEAFOOD.test(names)) {
    protein = Math.round(protein * 1.2);
    calories += 40;
  } else if (vegetarian) {
    protein = Math.round(protein * 0.85);
  }
  if (/\b(cream|butter|cheese|oil)\b/i.test(names)) fat += 4;
  if (/\b(rice|pasta|potato|bread|flour)\b/i.test(names)) carbs += 8;
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

function splitInstructions(raw) {
  return String(raw ?? '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=\.)\s+(?=[A-Z*])/))
    .map((step) => step.replace(/^\d+[\).]\s*/, '').replace(/^STEP\s*\d+\s*/i, '').trim())
    .filter((step) => step.length >= 8 && step.length <= 800);
}

function parseMinutes(text) {
  const blob = String(text ?? '').toLowerCase();
  const found = [];
  for (const m of blob.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/g)) found.push(Number(m[1]) * 60);
  for (const m of blob.matchAll(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/g)) found.push(Number(m[1]));
  const minutes = found.filter((n) => Number.isFinite(n) && n >= 10);
  if (!minutes.length) return null;
  return Math.min(Math.round(Math.max(...minutes)), 240);
}

function mealIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = String(meal[`strIngredient${i}`] ?? '').trim();
    const amount = String(meal[`strMeasure${i}`] ?? '').trim();
    if (!name) continue;
    ingredients.push({ name, amount, category: ingredientCategory(name) });
  }
  return ingredients;
}

function parseMeal(meal) {
  const title = String(meal.strMeal ?? '').trim();
  const idMeal = String(meal.idMeal ?? '').trim();
  if (!idMeal || title.length < 2) return null;
  const category = String(meal.strCategory ?? '').trim();
  if (/beverage|cocktail|\bdrinks?\b/i.test(`${category} ${title}`)) return null;

  const ingredients = mealIngredients(meal);
  const method = splitInstructions(meal.strInstructions);
  if (ingredients.length < 3 || method.length < 2) return null;

  const foodBlob = `${title} ${category} ${ingredients.map((ing) => ing.name).join(' ')}`;
  const vegetarian = !MEAT.test(foodBlob) && !SEAFOOD.test(foodBlob);
  const meal_slots = mealSlotsFrom(category, title);
  const macros = estimateMacros(ingredients, meal_slots, vegetarian);
  const source =
    String(meal.strSource ?? '').trim() || `https://www.themealdb.com/meal/${idMeal}`;
  const cook = parseMinutes(meal.strInstructions) ?? (meal_slots.includes('breakfast') ? 25 : meal_slots.includes('dessert') ? 45 : 40);

  return {
    id: `mealdb_${idMeal}`,
    name: title,
    emoji: emojiFrom(category, title, vegetarian),
    cuisine: cuisineFrom(meal.strArea, category, title),
    cook_time: cook,
    servings: 4,
    ...macros,
    vegetarian,
    ingredients,
    method,
    chef_tip: null,
    notes: 'Recipe data and imagery: TheMealDB (https://www.themealdb.com/). Nutrition is estimated for meal planning.',
    meal_slots,
    is_component: false,
    excluded_from_auto: false,
    source_url: source,
    image_url: String(meal.strMealThumb ?? '').trim() || null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchAllMeals() {
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const byId = new Map();
  for (const letter of letters) {
    const json = await fetchJson(`${BASE}/search.php?f=${encodeURIComponent(letter)}`);
    for (const meal of json.meals ?? []) {
      if (meal?.idMeal) byId.set(String(meal.idMeal), meal);
    }
    await sleep(120);
  }
  return [...byId.values()];
}

const existing = JSON.parse(readFileSync(existingPath, 'utf8'));
if (!Array.isArray(existing)) throw new Error('catalog-recipes.json is not an array');

const meals = await fetchAllMeals();
const accepted = [];
const rejected = { parse: 0, duplicate: 0 };

for (const meal of meals) {
  const recipe = parseMeal(meal);
  if (!recipe) {
    rejected.parse += 1;
    continue;
  }
  const against = [...existing, ...accepted];
  if (against.some((other) => isNearDuplicate(recipe, other))) {
    rejected.duplicate += 1;
    continue;
  }
  accepted.push(recipe);
}

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, `${JSON.stringify(accepted, null, 2)}\n`, 'utf8');

const rows = accepted.map((r) => {
  const ingredients = (r.ingredients ?? []).map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    category: ing.category,
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
    ${sqlJson(r.method)},
    ${sqlStr(r.chef_tip)},
    ${sqlStr(r.notes)},
    ${sqlTextArray(r.meal_slots)},
    ${sqlBool(Boolean(r.is_component))},
    ${sqlBool(Boolean(r.excluded_from_auto))},
    ${sqlStr(r.source_url)},
    null,
    true,
    ${sqlStr(r.image_url)}
  )`;
});

const header = `-- TheMealDB catalog recipes (official API).
-- Imported with key from THEMEALDB_API_KEY (defaults to test key "1").
-- Swap to the lifetime premium key before App Store / commercial release, then re-run:
--   pnpm --filter @kinexus/db import-themealdb
-- Attribution: https://www.themealdb.com/
-- Deduped against the existing Huddle/Kinexus seed catalog.
-- Nutrition values are estimated for planner scoring.

`;
const insertHead = `insert into public.recipes (
  id, catalog_key, name, emoji, cuisine, cook_time, servings,
  protein, calories, carbs, fat, vegetarian, ingredients, method,
  chef_tip, notes, meal_slots, is_component, excluded_from_auto, source_url,
  household_id, is_public, image_url
)
values
`;
const batches = [];
for (let i = 0; i < rows.length; i += 80) {
  batches.push(`${insertHead}${rows.slice(i, i + 80).join(',\n')}\non conflict (catalog_key) do nothing;`);
}
const sql = `${header}${batches.join('\n\n')}\n`;
writeFileSync(outSql, sql, 'utf8');

const cuisineCounts = {};
for (const r of accepted) cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      apiKey: API_KEY === '1' ? 'test:1' : 'custom',
      existing: existing.length,
      fetched: meals.length,
      imported: accepted.length,
      skippedParse: rejected.parse,
      skippedDuplicate: rejected.duplicate,
      cuisines: cuisineCounts,
      sqlKb: Math.round(sql.length / 1024),
    },
    null,
    2,
  ),
);
