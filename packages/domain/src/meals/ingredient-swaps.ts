/**
 * Common substitutes for catalogue ingredients. Names only.
 * Spices and herbs: University of Wyoming Extension herb and spice chart (2025).
 * Pantry, produce, dairy, and mince: BBC Good Food, “Common ingredient substitutions”.
 * Fish sauce: BBC Food buyer’s guide (light soy sauce).
 * Oyster sauce: Kikkoman (soy sauce or hoisin).
 * Ancho chillies: Diversivore. Borlotti: BBC Food (a kidney bean) plus the pulse guide.
 * Chorizo: another cured sausage.
 */

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function has(key: string, phrase: string): boolean {
  return ` ${key} `.includes(` ${phrase} `);
}

function hasAny(key: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => has(key, phrase));
}

type Rule = (key: string) => readonly string[] | null;

const RULES: readonly Rule[] = [
  (key) => {
    if (!has(key, 'allspice') || hasAny(key, ['berry', 'berries'])) return null;
    return ['cinnamon, cloves, and nutmeg', 'apple pie spice', 'pumpkin pie spice'];
  },
  (key) => {
    if (!has(key, 'cumin') || has(key, 'seed') || has(key, 'seeds')) return null;
    return ['ground coriander', 'caraway', 'chilli powder'];
  },
  (key) => {
    if (!has(key, 'cinnamon') || has(key, 'stick')) return null;
    return ['nutmeg', 'allspice'];
  },
  (key) => {
    if (!has(key, 'clove') && !has(key, 'cloves')) return null;
    if (has(key, 'garlic')) return null;
    return ['ground allspice', 'ground cinnamon', 'ground nutmeg'];
  },
  (key) => {
    if (!has(key, 'cardamom')) return null;
    return ['ground ginger'];
  },
  (key) => {
    if (!has(key, 'nutmeg')) return null;
    return ['cinnamon', 'ground ginger'];
  },
  (key) => {
    if (!has(key, 'ginger')) return null;
    if (hasAny(key, ['cordial', 'paste', 'beer', 'bread', 'ale', 'garlic'])) return null;
    if (has(key, 'powder') || has(key, 'ground')) return ['allspice', 'cinnamon', 'nutmeg'];
    return ['ground ginger'];
  },
  (key) => {
    if (!has(key, 'garlic')) return null;
    if (hasAny(key, ['sauce', 'paste', 'bread', 'salt', 'oil', 'wild', 'leaves', 'leaf'])) return null;
    if (has(key, 'powder')) return ['fresh garlic', 'garlic granules'];
    if (has(key, 'granules') || has(key, 'granule')) return ['fresh garlic', 'garlic powder'];
    return ['garlic powder', 'garlic granules'];
  },
  (key) => (has(key, 'bay') && (has(key, 'leaf') || has(key, 'leaves')) ? ['dried thyme'] : null),
  (key) => {
    if (!has(key, 'ancho')) return null;
    if (!hasAny(key, ['chilli', 'chillies', 'chili', 'chilies', 'chile', 'chiles'])) return null;
    return ['pasilla chillies', 'mulato chillies', 'ancho chilli powder'];
  },
  (key) => (has(key, 'chorizo') ? ['another type of cured sausage'] : null),
  (key) => (has(key, 'saffron') ? ['ground turmeric'] : null),
  (key) => {
    if (hasAny(key, ['seed', 'seeds', 'powder', 'ground'])) return null;
    if (has(key, 'cilantro') || has(key, 'coriander')) return ['parsley'];
    return null;
  },
  (key) => {
    if (!has(key, 'parsley') || has(key, 'root')) return null;
    return ['cilantro'];
  },
  (key) => {
    if (!has(key, 'basil') || has(key, 'thai')) return null;
    return ['oregano', 'thyme'];
  },
  (key) => (has(key, 'oregano') ? ['basil', 'thyme'] : null),
  (key) => (has(key, 'thyme') ? ['oregano', 'marjoram'] : null),
  (key) => (has(key, 'rosemary') ? ['thyme'] : null),
  (key) => {
    if (!has(key, 'sage') || has(key, 'sausage')) return null;
    return ['poultry seasoning', 'marjoram'];
  },
  (key) => (has(key, 'marjoram') ? ['basil', 'thyme'] : null),
  (key) => {
    if (!has(key, 'dill') || has(key, 'pickle') || has(key, 'pickles')) return null;
    return ['tarragon', 'fennel seeds'];
  },
  (key) => {
    if (!has(key, 'chive') && !has(key, 'chives')) return null;
    if (hasAny(key, ['dip', 'sauce'])) return null;
    return ['spring onions', 'leek'];
  },
  (key) => {
    if (!has(key, 'mint') || hasAny(key, ['sauce', 'jelly', 'chocolate', 'tea'])) return null;
    return ['basil'];
  },
  (key) => (has(key, 'fennel') && has(key, 'seeds') ? ['dill', 'anise seed'] : null),
  (key) => {
    if (!has(key, 'mustard') || !has(key, 'powder')) return null;
    return ['prepared mustard'];
  },
  (key) => (has(key, 'fish') && has(key, 'sauce') ? ['light soy sauce'] : null),
  (key) => (has(key, 'oyster') && has(key, 'sauce') ? ['soy sauce', 'hoisin sauce'] : null),
  (key) => beanSwaps(key),
  (key) => (has(key, 'lentil') || has(key, 'lentils') ? ['another type of lentil'] : null),
  (key) => chilliSwaps(key),
  (key) => onionSwaps(key),
  (key) => citrusSwaps(key),
  (key) => {
    if (has(key, 'parsnip') || has(key, 'parsnips')) return ['carrots'];
    if ((has(key, 'carrot') || has(key, 'carrots')) && !hasAny(key, ['juice', 'mix', 'cabbage'])) return ['parsnips'];
    return null;
  },
  (key) => {
    if (has(key, 'chinese')) return null;
    if (has(key, 'cauliflower') && !has(key, 'rice')) return ['broccoli'];
    if (has(key, 'broccoli')) return ['cauliflower'];
    return null;
  },
  (key) => creamSwaps(key),
  (key) => {
    if (has(key, 'buttermilk')) return ['milk and lemon juice'];
    return null;
  },
  (key) => {
    if (!has(key, 'chicken')) return null;
    if (has(key, 'stock') || has(key, 'broth') || has(key, 'liver') || has(key, 'wing') || has(key, 'wings')) return null;
    if (has(key, 'breast') || has(key, 'breasts')) return ['chicken thighs'];
    if (has(key, 'thigh') || has(key, 'thighs')) return ['chicken breast'];
    return null;
  },
  (key) => {
    if (has(key, 'mincemeat') || has(key, 'garlic') || has(key, 'pork')) return null;
    if ((has(key, 'minced') || has(key, 'ground')) && has(key, 'beef')) {
      return ['pork mince', 'chicken mince', 'turkey mince'];
    }
    return null;
  },
  (key) => {
    const shapes = ['spaghetti', 'penne', 'macaroni', 'linguine', 'fettuccine', 'farfalle', 'rigatoni', 'tagliatelle'];
    if (!shapes.some((shape) => has(key, shape))) return null;
    if (has(key, 'rice') || has(key, 'egg')) return null;
    return ['another pasta shape'];
  },
  (key) => {
    if (has(key, 'self') && has(key, 'raising') && has(key, 'flour')) return ['plain flour and baking powder'];
    if (has(key, 'self') && has(key, 'rising') && has(key, 'flour')) return ['plain flour and baking powder'];
    return null;
  },
];

function beanSwaps(key: string): readonly string[] | null {
  const options = [
    ['kidney beans', 'kidney bean'],
    ['cannellini beans', 'cannellini bean', 'cannellini'],
    ['chickpeas', 'chickpea'],
    ['black beans', 'black bean'],
    ['borlotti beans', 'borlotti bean', 'borlotti'],
  ] as const;
  if (hasAny(key, ['lamb', 'sauce', 'fermented', 'flour', 'powder'])) return null;
  const hit = options.find((names) => names.some((name) => has(key, name) || key.includes(name)));
  if (!hit) return null;
  const label = hit[0];
  return options.map((names) => names[0]).filter((name) => name !== label);
}

function chilliSwaps(key: string): readonly string[] | null {
  if (has(key, 'ancho') || hasAny(key, ['sauce', 'oil', 'paste', 'bean', 'ketchup', 'jam', 'salt', 'ham'])) return null;
  const named = hasAny(key, ['chilli', 'chillies', 'chili', 'chilies', 'cayenne', 'jalapeno', 'serrano']);
  const pepperFlakes = has(key, 'pepper') && (has(key, 'flakes') || has(key, 'flake'));
  if (!named && !pepperFlakes) return null;
  const powder = has(key, 'powder') || has(key, 'cayenne');
  const flakes = has(key, 'flakes') || has(key, 'flake');
  const fresh = !powder && !flakes && named;
  if (powder) return ['chilli flakes', 'fresh chilli'];
  if (flakes) return ['chilli powder', 'fresh chilli'];
  if (fresh) return ['chilli flakes', 'chilli powder'];
  return null;
}

function onionSwaps(key: string): readonly string[] | null {
  if (hasAny(key, ['powder', 'salt', 'ring', 'rings', 'soup', 'gravy', 'pickled', 'ground', 'mix', 'cabbage'])) return null;
  if (has(key, 'spring') || has(key, 'scallion') || has(key, 'scallions') || (has(key, 'green') && has(key, 'onion'))) {
    return ['onion', 'leeks'];
  }
  if (has(key, 'shallot') || has(key, 'shallots') || has(key, 'challot') || has(key, 'challots')) return ['onion'];
  if (has(key, 'leek') || has(key, 'leeks')) return ['onion', 'spring onions'];
  if (has(key, 'onion') || has(key, 'onions')) return ['spring onions', 'leeks', 'shallots'];
  return null;
}

function citrusSwaps(key: string): readonly string[] | null {
  if (has(key, 'grass') || has(key, 'leaf') || has(key, 'leaves') || hasAny(key, ['curd', 'sole', 'pepper', 'myrtle', 'pickle'])) {
    return null;
  }
  if (has(key, 'zest')) {
    if (has(key, 'lemon')) return ['lime zest'];
    if (has(key, 'lime')) return ['lemon zest'];
    return null;
  }
  if (has(key, 'juice')) {
    if (has(key, 'lemon')) return ['lime juice'];
    if (has(key, 'lime')) return ['lemon juice'];
    return null;
  }
  if (has(key, 'lemon') || has(key, 'lemons')) return ['lime'];
  if (has(key, 'lime') || has(key, 'limes')) return ['lemon'];
  return null;
}

function creamSwaps(key: string): readonly string[] | null {
  if (hasAny(key, ['cheese', 'tartar', 'coconut', 'ice', 'clotted', 'corn'])) return null;
  if ((has(key, 'sour') && has(key, 'cream')) || (has(key, 'crema') && !has(key, 'ice'))) {
    return ['plain yogurt', 'crème fraîche'];
  }
  if (has(key, 'creme') && has(key, 'fraiche')) return ['sour cream', 'plain yogurt'];
  if (!has(key, 'cream')) return null;
  if (has(key, 'double') || has(key, 'heavy')) return ['whipping cream', 'single cream'];
  if (has(key, 'whipping')) return ['double cream'];
  if (has(key, 'single')) return ['double cream'];
  return null;
}

export function ingredientSwaps(name: string): readonly string[] {
  const key = normalize(name);
  if (!key) return [];
  for (const rule of RULES) {
    const swaps = rule(key);
    if (swaps) return swaps;
  }
  return [];
}

/** “pasilla chillies, mulato chillies, or ancho chilli powder” */
export function formatIngredientSwaps(swaps: readonly string[]): string {
  if (swaps.length <= 1) return swaps[0] ?? '';
  if (swaps.length === 2) return `${swaps[0]} or ${swaps[1]}`;
  return `${swaps.slice(0, -1).join(', ')}, or ${swaps[swaps.length - 1]}`;
}
