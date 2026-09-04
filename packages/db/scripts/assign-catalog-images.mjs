import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipesPath = join(root, 'seeds', 'catalog-recipes.json');
const imagesPath = join(root, 'seeds', 'catalog-recipe-images.json');
const sqlPath = join(root, 'supabase', 'migrations', '20260904143000_catalog_recipe_images.sql');

const UA = 'KinexusCatalogImages/1.0 (https://github.com/PeeZapp/Kinexus; representative catalog dish photos)';

const STOP = new Set([
  'with', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'from',
  'style', 'classic', 'crispy', 'creamy', 'spiced', 'herbed', 'fresh', 'homemade',
  'loaded', 'perfect', 'fluffy', 'traditional', 'rustic', 'golden', 'hearty',
  'inspired', 'homemade',
]);

const SYNONYM = {
  aubergine: 'eggplant',
  prawn: 'shrimp',
  prawns: 'shrimp',
  chilli: 'chili',
  chile: 'chili',
  chilies: 'chili',
  coriander: 'cilantro',
  mince: 'beef',
  fillet: 'fish',
};

const DISTINCT = new Set([
  'cookie', 'cookies', 'brownie', 'brownies', 'pancake', 'pancakes', 'muffin', 'granola',
  'curry', 'tikka', 'biryani', 'masala', 'tagine', 'salmon', 'steak', 'burger', 'taco',
  'enchilada', 'burrito', 'soup', 'salad', 'ramen', 'risotto', 'paella', 'teriyaki',
  'shakshuka', 'benedict', 'cheesecake', 'pavlova', 'fritter', 'hummus', 'couscous',
  'linguine', 'rigatoni', 'spaghetti', 'nacho', 'pie', 'chicken', 'beef', 'pork', 'lamb',
]);

/** Recipe regex picks the family; meal regex picks TheMealDB photos in that family. */
const FAMILIES = [
  { id: 'curry', recipe: /\b(curry|tikka|masala|biryani|rogan josh|korma|saag|vindaloo|tagine|butter chicken)\b/i, meal: /\b(curry|tikka|masala|biryani|rogan|korma|tagine)\b/i },
  { id: 'salad', recipe: /\bsalad\b/i, meal: /\bsalad\b/i },
  { id: 'ramen', recipe: /\b(ramen|wonton noodle|noodle soup|noodle bowl)\b/i, meal: /\b(ramen|noodle)\b/i },
  { id: 'soup', recipe: /\b(soup|bisque|broth)\b/i, meal: /\b(soup|broth)\b/i },
  { id: 'burger', recipe: /\bburgers?\b/i, meal: /\bburger/i },
  { id: 'taco', recipe: /\b(tacos?|nachos?|enchiladas?|burrito bowls?)\b/i, meal: /\b(taco|nacho|enchilada|burrito)\b/i },
  { id: 'pasta', recipe: /\b(pasta|linguine|tagliatelle|rigatoni|spaghetti|lasagne|lasagna|mac and cheese)\b/i, meal: /\b(pasta|linguine|spaghetti|rigatoni|lasagne|penne|fettuccine|mac and cheese|carbonara)\b/i },
  { id: 'fried-rice', recipe: /\bfried rice\b/i, meal: /\bfried rice\b/i },
  { id: 'paella', recipe: /\bpaella\b/i, meal: /\b(paella|seafood rice)\b/i },
  { id: 'risotto', recipe: /\brisotto\b/i, meal: /\brisotto\b/i },
  { id: 'pie', recipe: /\bpie\b/i, meal: /\bpie\b/i },
  { id: 'chili', recipe: /\b(chili|chile relleno)\b/i, meal: /\bchil[ie]\b/i },
  { id: 'stir-fry', recipe: /\b(stir-fry|stir fry|bulgogi)\b/i, meal: /\b(stir-fry|stir fry|beef and broccoli)\b/i },
  { id: 'teriyaki', recipe: /\bteriyaki\b/i, meal: /\bteriyaki\b/i },
  { id: 'chicken', recipe: /\bchicken\b/i, meal: /\bchicken\b/i },
  { id: 'beef', recipe: /\bbeef\b/i, meal: /\bbeef\b/i },
  { id: 'pork', recipe: /\b(pork|carnitas)\b/i, meal: /\bpork\b/i },
  { id: 'lamb', recipe: /\blamb\b/i, meal: /\blamb\b/i },
  { id: 'tofu', recipe: /\btofu\b/i, meal: /\btofu\b/i },
  { id: 'shrimp', recipe: /\b(prawns?|shrimp)\b/i, meal: /\b(prawn|shrimp)\b/i },
  { id: 'breakfast-egg', recipe: /\b(eggs benedict|scrambled eggs|huevos|shakshuka|full english|spanish tortilla|poached eggs|breakfast burrito|buttered soldiers)\b/i, meal: /\b(benedict|shakshuka|huevos|english breakfast|spanish tortilla|omelette)\b/i },
  { id: 'breakfast-sweet', recipe: /\b(pancake|pancakes|french toast|granola|parfait|smoothie|muffin|muffins|croissant|banana bread|oat bars)\b/i, meal: /\b(pancake|muffin|granola|smoothie|banana|french toast)\b/i },
  { id: 'sandwich', recipe: /\b(sandwich|bagel|wrap|pita|pitta|flatbread|croque|blt|bruschetta|crostini)\b/i, meal: /\b(sandwich|wrap|bagel|pita)\b/i },
  { id: 'steak', recipe: /\b(steak|ribeye|short ribs?|brisket|carne asada)\b/i, meal: /\b(steak|brisket|rib|roast)\b/i },
  { id: 'salmon', recipe: /\bsalmon\b/i, meal: /\bsalmon\b/i },
  { id: 'fish', recipe: /\b(fish|cod|tuna|snapper|trout|crab)\b/i, meal: /\b(fish|salmon|tuna|cod|crab)\b/i },
  { id: 'eggplant', recipe: /\b(eggplant|aubergine)\b/i, meal: /\b(eggplant|aubergine)\b/i },
  { id: 'toast', recipe: /\btoast\b/i, meal: /\b(toast|sandwich|bagel)\b/i },
  { id: 'fritter', recipe: /\bfritters?\b/i, meal: /\bfritter/i },
  { id: 'dessert', recipe: /\b(cookies?|brownies?|cheesecake|panna cotta|pots de cr[eè]me|cr[eè]me br[uû]l[eé]e|pavlova|drizzle cake|(?<!rice )cakes?|ganache|bliss balls?|energy bites)\b/i, meal: /\b(cake|cookie|brownie|cheesecake|tart|pudding|pavlova)\b/i },
  { id: 'dip', recipe: /\b(dip|hummus|muhammara|skewers)\b/i, meal: /\b(dip|hummus|skewer)\b/i },
  { id: 'rice-bowl', recipe: /\b(rice bowl|bibimbap|tabbouleh|couscous|barley bowl)\b/i, meal: /\b(couscous|rice|bowl|bibimbap)\b/i },
];

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => SYNONYM[w] ?? w)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function jaccard(recipeName, mealName) {
  const a = new Set(tokens(recipeName));
  const b = new Set(tokens(mealName));
  let inter = 0;
  for (const w of b) if (a.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function familyOf(name) {
  return FAMILIES.find((f) => f.recipe.test(name)) ?? null;
}

function bestIn(name, candidates) {
  const anchors = tokens(name).filter((t) => DISTINCT.has(t));
  let meal = null;
  let score = -1;
  for (const candidate of candidates) {
    const mealTokens = tokens(candidate.name);
    let s = jaccard(name, candidate.name);
    if (anchors.some((t) => mealTokens.includes(t))) s += 0.35;
    if (s > score) {
      score = s;
      meal = candidate;
    }
  }
  return { meal, score };
}

async function loadMealDb() {
  const meals = [];
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const meal of data.meals ?? []) {
      if (meal.strMeal && meal.strMealThumb) {
        meals.push({ name: meal.strMeal, url: meal.strMealThumb });
      }
    }
  }
  return meals;
}

function pickImage(recipeName, meals) {
  const family = familyOf(recipeName);
  if (family) {
    const inFamily = meals.filter((m) => family.meal.test(m.name));
    if (inFamily.length > 0) {
      const hit = bestIn(recipeName, inFamily);
      return { url: hit.meal.url, source: 'family', match: hit.meal.name, family: family.id, score: hit.score };
    }
  }
  const open = bestIn(recipeName, meals);
  if (open.meal && open.score >= 0.45) {
    return { url: open.meal.url, source: 'themealdb', match: open.meal.name, family: family?.id ?? null, score: open.score };
  }
  const fallback = family ? bestIn(recipeName, meals) : open;
  return {
    url: fallback.meal?.url ?? meals[0].url,
    source: 'fallback',
    match: fallback.meal?.name ?? null,
    family: family?.id ?? null,
    score: fallback.score,
  };
}

const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const meals = await loadMealDb();
if (meals.length < 100) {
  throw new Error(`TheMealDB returned only ${meals.length} dishes; refusing to write catalog images`);
}
console.log(`Loaded ${meals.length} TheMealDB dishes`);

const images = {};
for (const recipe of recipes) {
  const picked = pickImage(recipe.name, meals);
  if (!picked.url) throw new Error(`No image for ${recipe.id} ${recipe.name}`);
  images[recipe.id] = {
    url: picked.url,
    source: picked.source,
    match: picked.match,
    family: picked.family,
    name: recipe.name,
  };
  console.log(`${picked.source.padEnd(9)} ${picked.score.toFixed(2)} [${picked.family ?? '-'}] ${recipe.name} => ${picked.match}`);
}

writeFileSync(imagesPath, JSON.stringify(images, null, 2));

const updates = recipes.map((r) => {
  const url = images[r.id].url;
  return `update public.recipes set image_url = '${url.replaceAll("'", "''")}' where catalog_key = '${r.id}';`;
});

writeFileSync(
  sqlPath,
  `-- Representative catalog dish photos from TheMealDB (CC / API thumbs).
-- Visual stand-ins for each catalog recipe, not plated replicas.

alter table public.recipes add column if not exists image_url text;

${updates.join('\n')}
`,
);

const urls = new Set(Object.values(images).map((x) => x.url));
console.log(`Wrote ${recipes.length} images, ${urls.size} unique`);
