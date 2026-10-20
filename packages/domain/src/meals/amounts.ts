import { pickCanonicalShoppingName, shoppingMergeKey } from './ingredient-merge';
import {
  COUNT_PREP_UNITS,
  COUNT_SIZE_UNITS,
  formatShoppingCountLabel,
  shoppingCountDefFor,
  type ShoppingCountDef,
} from './shopping-units';

export type ParsedAmount = {
  value: number;
  unit: string;
  raw: string;
};

/** Approximate edible weight of one garlic clove. */
export const GARLIC_CLOVE_GRAMS = 4;

const UNIT_MAP: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  clove: 'clove',
  cloves: 'clove',
};

const WEIGHT_UNITS = new Set(['g', 'kg']);
const VOLUME_UNITS = new Set(['ml', 'l', 'tsp', 'tbsp', 'cup']);
const IMPERIAL_WEIGHT = new Set(['oz', 'lb']);

export type CombineAmountsOptions = {
  /** When true, prefer g/ml/kg/l over oz/lb where convertible. */
  preferMetric?: boolean;
  ingredientName?: string;
};

function normaliseUnit(raw: string): string {
  return UNIT_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

function toWeightGrams(value: number, unit: string, ingredientName?: string): number | null {
  if (unit === 'g') return value;
  if (unit === 'kg') return value * 1000;
  if (unit === 'oz') return value * 28.3495;
  if (unit === 'lb') return value * 453.592;
  if (unit === 'clove') {
    const name = (ingredientName ?? '').toLowerCase();
    // Only convert garlic cloves; spice "cloves" stay as counts
    if (!name || name.includes('garlic') || shoppingMergeKey(name) === 'garlic') {
      return value * GARLIC_CLOVE_GRAMS;
    }
  }
  return null;
}

function toVolumeMl(value: number, unit: string): number | null {
  if (unit === 'ml') return value;
  if (unit === 'l') return value * 1000;
  if (unit === 'tsp') return value * 5;
  if (unit === 'tbsp') return value * 15;
  if (unit === 'cup') return value * 240;
  return null;
}

function formatBase(value: number, base: string): string {
  if (base === 'g') {
    return value >= 1000
      ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}kg`
      : `${Math.round(value)}g`;
  }
  if (base === 'ml') {
    return value >= 1000
      ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}l`
      : `${Math.round(value)}ml`;
  }
  return `${value}${base}`;
}

function formatNice(value: number, unit: string): string {
  const nice = Number.isInteger(value) ? `${value}` : `${parseFloat(value.toFixed(2))}`;
  if (!unit) return nice;
  if (unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') return `${nice}${unit}`;
  if (unit === 'clove') return `${nice} ${value === 1 ? 'clove' : 'cloves'}`;
  return `${nice} ${unit}`;
}

function formatGarlicClovesAsGrams(totalCloves: number): string {
  const grams = Math.round(totalCloves * GARLIC_CLOVE_GRAMS);
  const approx = Number.isInteger(totalCloves)
    ? String(totalCloves)
    : String(parseFloat(totalCloves.toFixed(1)));
  return `${grams}g (approx ${approx} ${totalCloves === 1 ? 'clove' : 'cloves'})`;
}

function inferDensityGPerMl(ingredientName?: string, category?: string): number {
  const name = (ingredientName ?? '').toLowerCase();
  const cat = (category ?? '').toLowerCase();

  const densityByKeyword: Array<[string, number]> = [
    ['olive oil', 0.91],
    ['oil', 0.92],
    ['honey', 1.42],
    ['syrup', 1.33],
    ['milk', 1.03],
    ['cream', 1.0],
    ['soy sauce', 1.17],
    ['vinegar', 1.01],
    ['water', 1.0],
    ['flour', 0.53],
    ['sugar', 0.85],
    ['brown sugar', 0.72],
    ['salt', 1.2],
    ['rice', 0.8],
    ['oats', 0.41],
  ];
  for (const [kw, density] of densityByKeyword) {
    if (name.includes(kw)) return density;
  }

  if (cat.includes('condiment') || cat.includes('liquid')) return 1.0;
  if (cat.includes('dairy')) return 1.0;
  if (cat.includes('grain')) return 0.7;
  return 1.0;
}

function isLikelyLiquid(ingredientName?: string, category?: string): boolean {
  const name = (ingredientName ?? '').toLowerCase();
  const cat = (category ?? '').toLowerCase();
  if (cat.includes('condiment') || cat.includes('liquid') || cat.includes('drink')) return true;
  return ['oil', 'milk', 'cream', 'water', 'juice', 'vinegar', 'soy sauce', 'broth', 'stock', 'wine'].some((k) =>
    name.includes(k),
  );
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function normalizeAmountString(raw: string): string {
  let str = raw.trim().toLowerCase();
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    str = str.split(glyph).join(ascii);
  }
  return str;
}

export function parseAmount(raw: string | undefined): ParsedAmount | null {
  if (!raw || !raw.trim()) return null;
  const str = normalizeAmountString(raw);

  const numberMatch = str.match(/(\d+\s*\/\s*\d+|\d*\.?\d+)/);
  const token = numberMatch?.[1]?.replace(/\s+/g, '');
  if (!numberMatch || !token) return null;

  let value = 0;
  if (token.includes('/')) {
    const [num, den] = token.split('/');
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    value = n / d;
  } else {
    value = Number(token);
  }
  if (!Number.isFinite(value)) return null;

  const tail = str.slice((numberMatch.index ?? 0) + numberMatch[0].length);
  const unitTokenMatch = tail.match(/([a-zA-Z]+)/);
  const unit = normaliseUnit(unitTokenMatch?.[1] ?? '');
  return { value, unit, raw: str };
}

/** Convert a parsed amount into a shoppable count when the ingredient supports it. */
function toShoppingCount(
  parsed: ParsedAmount,
  ingredientName: string,
  def: ShoppingCountDef,
): number | null {
  const unit = parsed.unit;
  const key = shoppingMergeKey(ingredientName);

  if (def.label === 'clove' || key === 'garlic') {
    if (unit === 'clove' || COUNT_SIZE_UNITS.has(unit) || COUNT_PREP_UNITS.has(unit)) {
      return parsed.value;
    }
    if (WEIGHT_UNITS.has(unit) || IMPERIAL_WEIGHT.has(unit)) {
      const g = toWeightGrams(parsed.value, unit, ingredientName);
      if (g == null || !def.gramsPerUnit) return null;
      return g / def.gramsPerUnit;
    }
    return null;
  }

  if (unit === 'leaf' || unit === 'leaves') {
    if (def.label === 'leaf') return parsed.value;
    // Leaves of lettuce ≠ whole heads — don't force into head counts
    return null;
  }

  if (COUNT_SIZE_UNITS.has(unit) || COUNT_PREP_UNITS.has(unit)) {
    return parsed.value;
  }

  if ((WEIGHT_UNITS.has(unit) || IMPERIAL_WEIGHT.has(unit)) && def.gramsPerUnit) {
    const g = toWeightGrams(parsed.value, unit, ingredientName);
    if (g == null) return null;
    return g / def.gramsPerUnit;
  }

  return null;
}

function tryCombineAsShoppingCount(
  amounts: (string | undefined)[],
  ingredientName: string,
): string | undefined {
  const def = shoppingCountDefFor(ingredientName);
  if (!def) return undefined;

  const rawAmounts = amounts.filter((a): a is string => Boolean(a?.trim()));
  if (rawAmounts.length === 0) return undefined;

  const counts: number[] = [];
  for (const raw of rawAmounts) {
    const parsed = parseAmount(raw);
    if (!parsed) return undefined;
    const count = toShoppingCount(parsed, ingredientName, def);
    if (count == null) return undefined;
    counts.push(count);
  }

  const total = counts.reduce((s, n) => s + n, 0);
  if (!(total > 0)) return undefined;

  // Garlic: keep grams + approx cloves for the pantry/scale case
  if (def.label === 'clove' || shoppingMergeKey(ingredientName) === 'garlic') {
    return formatGarlicClovesAsGrams(total);
  }

  // Round near-integers (e.g. 150g+150g onion → 2) but keep real halves
  const rounded =
    Math.abs(total - Math.round(total)) < 0.08 ? Math.round(total) : parseFloat(total.toFixed(2));

  return formatShoppingCountLabel(rounded, ingredientName, def.label);
}

export function combineAmounts(
  amounts: (string | undefined)[],
  options: CombineAmountsOptions = {},
): string | undefined {
  const { preferMetric = true, ingredientName } = options;

  if (ingredientName) {
    const asCount = tryCombineAsShoppingCount(amounts, ingredientName);
    if (asCount) return asCount;
  }

  const parsed = amounts.map(parseAmount).filter((p): p is ParsedAmount => p !== null);

  if (parsed.length === 0) return undefined;

  const units = [...new Set(parsed.map((p) => p.unit))];

  // Garlic cloves → grams + approx note (fallback when count path did not run)
  if (units.length === 1 && units[0] === 'clove') {
    const total = parsed.reduce((s, p) => s + p.value, 0);
    const name = (ingredientName ?? '').toLowerCase();
    if (!name || name.includes('garlic') || shoppingMergeKey(name) === 'garlic') {
      return formatGarlicClovesAsGrams(total);
    }
    return formatNice(total, 'clove');
  }

  if (units.length === 1) {
    const unit = units[0] ?? '';
    const total = parsed.reduce((s, p) => s + p.value, 0);
    if (preferMetric && IMPERIAL_WEIGHT.has(unit)) {
      const totalG = parsed.reduce((s, p) => s + (toWeightGrams(p.value, p.unit) ?? 0), 0);
      return formatBase(totalG, 'g');
    }
    return formatNice(total, unit);
  }

  // Cloves mixed with weight → grams + approx cloves from clove portion
  const cloveParts = parsed.filter((p) => p.unit === 'clove');
  const weightParts = parsed.filter((p) => WEIGHT_UNITS.has(p.unit) || IMPERIAL_WEIGHT.has(p.unit));
  if (
    cloveParts.length > 0 &&
    weightParts.length + cloveParts.length === parsed.length &&
    (shoppingMergeKey(ingredientName ?? '') === 'garlic' || (ingredientName ?? '').toLowerCase().includes('garlic'))
  ) {
    const cloveCount = cloveParts.reduce((s, p) => s + p.value, 0);
    const weightG = weightParts.reduce((s, p) => s + (toWeightGrams(p.value, p.unit) ?? 0), 0);
    const totalG = weightG + cloveCount * GARLIC_CLOVE_GRAMS;
    const approxCloves = cloveCount + weightG / GARLIC_CLOVE_GRAMS;
    const grams = Math.round(totalG);
    const approx = Number.isInteger(approxCloves)
      ? String(approxCloves)
      : String(parseFloat(approxCloves.toFixed(1)));
    return `${grams}g (approx ${approx} cloves)`;
  }

  if (units.every((u) => WEIGHT_UNITS.has(u) || IMPERIAL_WEIGHT.has(u))) {
    const totalG = parsed.reduce((s, p) => s + (toWeightGrams(p.value, p.unit) ?? 0), 0);
    return formatBase(totalG, 'g');
  }

  if (units.every((u) => VOLUME_UNITS.has(u))) {
    // Keep natural kitchen unit when all the same — already handled above.
    // Mixed volume → ml for metric consistency.
    const totalMl = parsed.reduce((s, p) => s + (toVolumeMl(p.value, p.unit) ?? 0), 0);
    return formatBase(totalMl, 'ml');
  }

  const distinct = [...new Set(amounts.filter((a): a is string => Boolean(a)))];
  return distinct.join(' + ');
}

export type FlatIngredient = {
  name: string;
  amount?: string;
  category?: string;
  /** Original ingredient names that were merged into this row. */
  mergedFrom?: string[];
};

export type DeduplicateOptions = {
  preferMetric?: boolean;
};

export function deduplicateIngredients(
  all: FlatIngredient[],
  options: DeduplicateOptions = {},
): FlatIngredient[] {
  const preferMetric = options.preferMetric ?? true;
  const map = new Map<string, FlatIngredient[]>();

  for (const ing of all) {
    const key = shoppingMergeKey(ing.name) || ing.name.trim().toLowerCase();
    const group = map.get(key);
    if (group) group.push(ing);
    else map.set(key, [ing]);
  }

  const result: FlatIngredient[] = [];
  for (const [, group] of map) {
    const representativeName = pickCanonicalShoppingName(group.map((g) => g.name));
    const representative = group.find((g) => g.name === representativeName) ?? group[0];
    if (!representative) continue;

    const parsed = group.map((g) => parseAmount(g.amount)).filter((p): p is ParsedAmount => p !== null);
    const units = [...new Set(parsed.map((p) => p.unit))];
    const hasWeight = units.some((u) => WEIGHT_UNITS.has(u) || IMPERIAL_WEIGHT.has(u) || u === 'clove');
    const hasVolume = units.some((u) => VOLUME_UNITS.has(u));
    const density = inferDensityGPerMl(representativeName, representative.category);
    const liquid = isLikelyLiquid(representativeName, representative.category);

    let combined: string | undefined;
    if (parsed.length > 0 && hasWeight && hasVolume) {
      if (liquid) {
        const totalMl = parsed.reduce((sum, p) => {
          const ml = toVolumeMl(p.value, p.unit);
          if (ml !== null) return sum + ml;
          const g = toWeightGrams(p.value, p.unit, representativeName);
          return sum + (g !== null ? g / Math.max(density, 0.01) : 0);
        }, 0);
        combined = formatBase(totalMl, 'ml');
      } else {
        const totalG = parsed.reduce((sum, p) => {
          const g = toWeightGrams(p.value, p.unit, representativeName);
          if (g !== null) return sum + g;
          const ml = toVolumeMl(p.value, p.unit);
          return sum + (ml !== null ? ml * density : 0);
        }, 0);
        const cloveCount = parsed.filter((p) => p.unit === 'clove').reduce((s, p) => s + p.value, 0);
        if (cloveCount > 0 && shoppingMergeKey(representativeName) === 'garlic') {
          const approx = totalG / GARLIC_CLOVE_GRAMS;
          const approxLabel = Number.isInteger(approx) ? String(approx) : String(parseFloat(approx.toFixed(1)));
          combined = `${Math.round(totalG)}g (approx ${approxLabel} cloves)`;
        } else {
          combined = formatBase(totalG, 'g');
        }
      }
    } else {
      combined = combineAmounts(
        group.map((g) => g.amount),
        { preferMetric, ingredientName: representativeName },
      );
    }

    const originalNames = [...new Set(group.map((g) => g.name.trim()).filter(Boolean))];
    const mergedFrom =
      originalNames.length > 1
        ? originalNames.filter((n) => n.toLowerCase() !== representativeName.toLowerCase())
        : undefined;

    result.push({
      name: representativeName,
      amount: combined,
      category: representative.category,
      ...(mergedFrom?.length ? { mergedFrom } : {}),
    });
  }

  return result;
}

export function prefersMetricCountry(country: string | null | undefined): boolean {
  const code = (country ?? 'AU').toUpperCase();
  return code !== 'US';
}
