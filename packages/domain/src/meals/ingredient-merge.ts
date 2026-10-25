/**
 * Canonical merge keys for shopping-list dedupe.
 * Merges prep/unit variants (sliced onion ≈ onion, garlic cloves ≈ garlic)
 * but keeps distinct varieties (red onion ≠ brown onion, green onion ≠ onion).
 */

const DISTINCT_PHRASES = [
  'green onion',
  'spring onion',
  'salad onion',
  'scallion',
  'red onion',
  'brown onion',
  'white onion',
  'yellow onion',
  'spanish onion',
  'green apple',
  'red apple',
  'granny smith',
  'pink lady',
  // Vinegars first (longer than bare wines) — never merge with drinking wine
  'white wine vinegar',
  'red wine vinegar',
  'rice wine vinegar',
  'apple cider vinegar',
  'balsamic vinegar',
  'sherry vinegar',
  'malt vinegar',
  'cider vinegar',
  'rice vinegar',
  'wine vinegar',
  'red wine',
  'white wine',
  'rose wine',
  'rosé wine',
  'sparkling wine',
  'rice wine',
  'shaoxing wine',
].sort((a, b) => b.length - a.length);

/** Words that describe how you prep or shop an item, not a different product. */
const QUALIFIER_TOKENS = new Set([
  'large', 'medium', 'small', 'big', 'jumbo', 'baby', 'fresh', 'ripe', 'firm', 'soft',
  'raw', 'cooked', 'roasted', 'toasted', 'organic', 'boneless', 'skinless', 'trimmed',
  'finely', 'roughly', 'coarsely', 'thinly', 'freshly', 'loosely', 'lightly', 'packed',
  'chopped', 'sliced', 'diced', 'minced', 'grated', 'crushed', 'peeled', 'halved',
  'quartered', 'cubed', 'shredded', 'torn', 'julienned', 'deseeded', 'seeded',
  'heaped', 'level', 'scant', 'pure', 'plain', 'granulated', 'unsalted', 'extra', 'virgin',
  'english', 'cracked', 'flaky', 'coarse', 'fine', 'kosher', 'rolled',
]);

const HERBS = new Set([
  'basil', 'oregano', 'thyme', 'rosemary', 'parsley', 'cilantro', 'coriander', 'dill',
  'mint', 'sage', 'tarragon', 'marjoram', 'chive', 'chives', 'bay', 'herb', 'herbs',
]);

/** Ground form of these is the jar you buy, so "ground cumin" is just cumin. */
const GROUND_SPICES = new Set([
  'cumin', 'cinnamon', 'nutmeg', 'allspice', 'clove', 'cloves', 'cardamom', 'paprika',
  'turmeric', 'pepper', 'cayenne', 'chilli', 'chili', 'mustard', 'fenugreek', 'sumac',
]);

const MEATS = new Set(['beef', 'pork', 'lamb', 'chicken', 'turkey', 'veal', 'mince', 'meat']);

const IRREGULAR_SINGULAR: Record<string, string> = {
  leaves: 'leaf',
  potatoes: 'potato',
  tomatoes: 'tomato',
  chillies: 'chilli',
  chilies: 'chilli',
  chilis: 'chilli',
  cherries: 'cherry',
  peaches: 'peach',
  berries: 'berry',
};

/** Same product, different words. Applied after qualifiers are gone. */
const KEY_ALIASES: Record<string, string> = {
  'green onion': 'spring onion',
  scallion: 'spring onion',
  'salad onion': 'spring onion',
  cilantro: 'coriander',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  arugula: 'rocket',
  cornstarch: 'cornflour',
  'corn starch': 'cornflour',
  shrimp: 'prawn',
  chili: 'chilli',
  'bell pepper': 'capsicum',
  'red bell pepper': 'red capsicum',
  'green bell pepper': 'green capsicum',
  'yellow bell pepper': 'yellow capsicum',
  'orange bell pepper': 'orange capsicum',
  'all purpose flour': 'flour',
  'plain flour': 'flour',
  'white flour': 'flour',
  'caster sugar': 'sugar',
  'white sugar': 'sugar',
  'granulated sugar': 'sugar',
  'powdered sugar': 'icing sugar',
  'confectioners sugar': 'icing sugar',
  'heavy cream': 'thickened cream',
  'whipping cream': 'thickened cream',
  'double cream': 'thickened cream',
  yogurt: 'yoghurt',
  'greek yogurt': 'greek yoghurt',
  pepper: 'black pepper',
  peppercorn: 'black pepper',
  'black peppercorn': 'black pepper',
  'minced beef': 'beef mince',
  'ground beef': 'beef mince',
  'beef mince': 'beef mince',
  'minced pork': 'pork mince',
  'ground pork': 'pork mince',
  'pork mince': 'pork mince',
  'minced lamb': 'lamb mince',
  'ground lamb': 'lamb mince',
  'lamb mince': 'lamb mince',
  'minced chicken': 'chicken mince',
  'ground chicken': 'chicken mince',
  'chicken mince': 'chicken mince',
  'minced turkey': 'turkey mince',
  'ground turkey': 'turkey mince',
  'turkey mince': 'turkey mince',
  'extra virgin olive oil': 'olive oil',
  'virgin olive oil': 'olive oil',
  'kosher salt': 'salt',
  'white rice': 'rice',
  'cumin powder': 'cumin',
  'turmeric powder': 'turmeric',
  'coriander powder': 'ground coriander',
};

const DROP_PHRASES = ['free range', 'bone in', 'skin on', 'extra virgin', 'all purpose', 'extra large'];

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function singularToken(word: string): string {
  const irregular = IRREGULAR_SINGULAR[word];
  if (irregular) return irregular;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2);
  if (/(?:ches|shes|xes|zes|sses)$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('us') || word.endsWith('is') || word.endsWith('ss') || word.endsWith('os')) return word;
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

function normalizePlural(value: string): string {
  const parts = value.split(' ').filter(Boolean);
  if (parts.length === 0) return value;
  parts[parts.length - 1] = singularToken(parts[parts.length - 1] ?? '');
  return parts.join(' ');
}

function dropQualifiers(value: string): string {
  const tokens = value.split(' ').filter(Boolean);
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    const next = tokens[i + 1];
    if (token === 'whole' && next && (next === 'wheat' || next === 'grain' || next === 'meal')) {
      kept.push(token);
      continue;
    }
    if (token === 'whole') continue;
    if (token === 'dried') {
      const rest = tokens.slice(i + 1);
      if (rest.some((part) => HERBS.has(part))) continue;
      kept.push(token);
      continue;
    }
    if (token === 'ground') {
      const rest = tokens.slice(i + 1);
      if (rest.some((part) => MEATS.has(part) || part === 'coriander' || part === 'ginger')) {
        kept.push(token);
        continue;
      }
      if (rest.some((part) => GROUND_SPICES.has(part) || part === 'black' || part === 'white')) continue;
      kept.push(token);
      continue;
    }
    if (QUALIFIER_TOKENS.has(token)) continue;
    kept.push(token);
  }
  return collapseSpaces(kept.join(' '));
}

function phraseInName(name: string, phrase: string): boolean {
  if (name === phrase) return true;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(name);
}

function dropShoppingPhrases(value: string): string {
  let n = value;
  for (const phrase of DROP_PHRASES) {
    n = n.replace(new RegExp(`\\b${phrase}\\b`, 'g'), ' ');
  }
  return collapseSpaces(n);
}

function finishKey(key: string): string {
  const singular = normalizePlural(collapseSpaces(key));
  return KEY_ALIASES[singular] ?? singular;
}

/**
 * A variety phrase wins only when the other words are shopping noise
 * ("large red onion" → red onion, "red onion powder" stays itself).
 */
function distinctKey(name: string): string | null {
  for (const phrase of DISTINCT_PHRASES) {
    if (!phraseInName(name, phrase)) continue;
    const rest = collapseSpaces(name.replace(phrase, ' '));
    if (!rest) return phrase;
    if (rest.split(' ').every((token) => QUALIFIER_TOKENS.has(token))) return phrase;
  }
  return null;
}

/** Stable key used to merge shopping rows that are the same item. */
export function shoppingMergeKey(name: string): string {
  let n = collapseSpaces(name.toLowerCase().replace(/[-/]/g, ' '));
  if (!n) return '';

  n = n.replace(/\bgarlic\s+cloves?\b/g, 'garlic');
  n = n.replace(/\bcloves?\s+(?:of\s+)?garlic\b/g, 'garlic');

  if (!/\b(?:garlic|celery|onion|lemon|smoked)\s+salt\b/.test(n)) {
    n = n.replace(/\b(?:fine|flaky|coarse|cracked|kosher)?\s*sea\s+salt\b/g, 'salt');
    n = n.replace(/\b(?:table|kosher)\s+salt\b/g, 'salt');
  }

  n = n.replace(/\bdry\s+(?=(?:white|red)\s+wine\b)/g, '');
  n = n.replace(/\b(?:minced|ground)\s+(beef|pork|lamb|chicken|turkey|veal)\b/g, '$1 mince');
  n = dropShoppingPhrases(n);
  n = dropQualifiers(n);
  if (!n) n = collapseSpaces(name.toLowerCase());

  n = n.replace(/\bchili\b/g, 'chilli');

  if (/\bvinegar\b/.test(n)) {
    for (const phrase of DISTINCT_PHRASES) {
      if (!phrase.includes('vinegar')) continue;
      if (phraseInName(n, phrase)) return finishKey(phrase);
    }
    return finishKey(n);
  }

  const distinct = distinctKey(n);
  if (distinct) return finishKey(distinct);

  return finishKey(n);
}

/**
 * "salt and black pepper" is two things to buy.
 * Leaves a single name alone, including names that are not an "and" pair.
 */
export function splitShoppingIngredientName(name: string): string[] {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+(?:and|&)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return [trimmed];
  if (parts.some((part) => part.split(/\s+/).length > 4)) return [trimmed];
  return parts;
}

/**
 * True when a pantry item can stand in for a recipe ingredient.
 * "chicken" covers "chicken thigh", and "red onion" covers "onion".
 * A generic pantry item does not cover a named variety ("onion" does not cover "red onion").
 */
export function ingredientCoveredByPantry(pantryName: string, ingredientName: string): boolean {
  const pantryKey = shoppingMergeKey(pantryName);
  const ingredientKey = shoppingMergeKey(ingredientName);
  if (!pantryKey || !ingredientKey) return false;
  if (pantryKey === ingredientKey) return true;

  const pantryHasIngredient = phraseInName(pantryKey, ingredientKey);
  const ingredientHasPantry = phraseInName(ingredientKey, pantryKey);
  if (!pantryHasIngredient && !ingredientHasPantry) return false;

  if (ingredientHasPantry) {
    const specific = DISTINCT_PHRASES.find((phrase) => phraseInName(ingredientKey, phrase));
    if (specific && specific !== pantryKey && !phraseInName(pantryKey, specific)) return false;
  }
  return true;
}

/** Prefer a short, clean display name from a merge group. */
export function pickCanonicalShoppingName(names: readonly string[]): string {
  if (names.length === 0) return '';
  const scored = names.map((raw) => {
    const trimmed = raw.trim();
    const key = shoppingMergeKey(trimmed);
    const clovey = /\bcloves?\b/i.test(trimmed) && key === 'garlic';
    return { trimmed, clovey };
  });
  scored.sort((a, b) => {
    if (a.clovey !== b.clovey) return a.clovey ? 1 : -1;
    if (a.trimmed.length !== b.trimmed.length) return a.trimmed.length - b.trimmed.length;
    return a.trimmed.localeCompare(b.trimmed);
  });
  const best = scored[0]?.trimmed ?? names[0] ?? '';
  // Title-ish: keep original casing of the winner
  return best;
}
