import { shoppingMergeKey } from './ingredient-merge';

export type ShoppingCountDef = {
  /** Exact shoppingMergeKey matches. */
  keys?: string[];
  /** Match when merge key equals or ends with this word (e.g. lettuce). */
  keySuffixes?: string[];
  /** Typical grams per shoppable unit (onion, potato head of lettuce…). */
  gramsPerUnit?: number;
  /** How to label the count. `item` uses the ingredient name. */
  label: 'item' | 'clove' | 'leaf' | 'bunch' | 'head';
};

/**
 * Produce / countables that should show as shoppable units
 * (e.g. "5 onions", "0.5 iceberg lettuce") instead of mixed size strings.
 */
const SHOPPING_COUNT_DEFS: ShoppingCountDef[] = [
  {
    keys: [
      'onion',
      'red onion',
      'brown onion',
      'white onion',
      'yellow onion',
      'spanish onion',
      'shallot',
    ],
    gramsPerUnit: 150,
    label: 'item',
  },
  { keys: ['potato', 'sweet potato'], gramsPerUnit: 180, label: 'item' },
  { keys: ['carrot'], gramsPerUnit: 70, label: 'item' },
  { keys: ['tomato'], gramsPerUnit: 120, label: 'item' },
  { keys: ['capsicum', 'bell pepper'], gramsPerUnit: 160, label: 'item' },
  { keys: ['cucumber', 'courgette', 'zucchini', 'aubergine', 'eggplant'], gramsPerUnit: 200, label: 'item' },
  { keys: ['leek'], gramsPerUnit: 150, label: 'item' },
  { keys: ['celery'], gramsPerUnit: 40, label: 'item' }, // stalks roughly; better than nothing when counted
  { keys: ['egg'], label: 'item' },
  {
    keys: ['lemon', 'lime', 'orange', 'apple', 'banana', 'avocado', 'mango', 'pear', 'peach', 'avocado'],
    label: 'item',
  },
  { keySuffixes: ['lettuce'], gramsPerUnit: 500, label: 'item' },
  { keys: ['cabbage'], gramsPerUnit: 800, label: 'item' },
  { keys: ['broccoli', 'cauliflower'], gramsPerUnit: 400, label: 'item' },
  { keys: ['corn', 'sweetcorn'], label: 'item' },
  { keys: ['bay leaf', 'bay'], label: 'leaf' },
  { keys: ['spring onion', 'green onion', 'scallion'], label: 'item' },
  { keys: ['garlic'], gramsPerUnit: 4, label: 'clove' },
];

/** Size / whole-item words that mean "N of this item". */
export const COUNT_SIZE_UNITS = new Set([
  '',
  'each',
  'piece',
  'pieces',
  'unit',
  'units',
  'whole',
  'large',
  'medium',
  'small',
  'xl',
  'extra',
  'head',
  'heads',
  'bulb',
  'bulbs',
  'bunch',
  'bunches',
]);

/** Prep words often glued into the amount ("1 chopped") — still a count. */
export const COUNT_PREP_UNITS = new Set([
  'chopped',
  'sliced',
  'diced',
  'minced',
  'grated',
  'crushed',
  'peeled',
  'halved',
  'quartered',
  'thin',
  'finely',
  'roughly',
  'shredded',
  'torn',
]);

export function shoppingCountDefFor(ingredientName: string | undefined): ShoppingCountDef | null {
  if (!ingredientName?.trim()) return null;
  const key = shoppingMergeKey(ingredientName);
  for (const def of SHOPPING_COUNT_DEFS) {
    if (def.keys?.some((k) => k === key)) return def;
    if (def.keySuffixes?.some((suffix) => key === suffix || key.endsWith(` ${suffix}`))) return def;
  }
  return null;
}

function lightPlural(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies') || w.endsWith('es') || (w.endsWith('s') && !w.endsWith('ss'))) return word;
  if (w.endsWith('y') && w.length > 1 && !'aeiou'.includes(w[w.length - 2]!)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (w.endsWith('ch') || w.endsWith('sh') || w.endsWith('x') || w.endsWith('z')) return `${word}es`;
  return `${word}s`;
}

function lightSingular(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return `${word.slice(0, -3)}y`;
  if (w.endsWith('oes') && w.length > 4) return word.slice(0, -2);
  if (w.endsWith('sses')) return word.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return word.slice(0, -1);
  return word;
}

function formatCountNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = parseFloat(value.toFixed(2));
  return String(rounded);
}

/** e.g. 5 + "onion" → "5 onions"; 0.5 + "iceberg lettuce" → "0.5 iceberg lettuce". */
export function formatShoppingCountLabel(value: number, ingredientName: string, label: ShoppingCountDef['label']): string {
  const nice = formatCountNumber(value);
  if (label === 'clove') {
    return `${nice} ${value === 1 ? 'clove' : 'cloves'}`;
  }
  if (label === 'leaf') {
    return `${nice} ${value === 1 ? 'leaf' : 'leaves'}`;
  }
  if (label === 'bunch') {
    return `${nice} ${value === 1 ? 'bunch' : 'bunches'}`;
  }
  if (label === 'head') {
    return `${nice} ${value === 1 ? 'head' : 'heads'}`;
  }

  const parts = ingredientName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return nice;
  const last = parts[parts.length - 1]!;
  const singularLast = lightSingular(last);
  const head = parts.slice(0, -1);
  if (value === 1) {
    return ['1', ...head, singularLast].join(' ');
  }
  // Sub-one portions keep singular ("0.5 iceberg lettuce")
  if (value < 1) {
    return [nice, ...head, singularLast].join(' ');
  }
  return [nice, ...head, lightPlural(singularLast)].join(' ');
}
