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
  tblsp: 'tbsp',
  tbls: 'tbsp',
  tbs: 'tbsp',
  tbsps: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  clove: 'clove',
  cloves: 'clove',
};

const WEIGHT_UNITS = new Set(['g', 'kg']);
const VOLUME_UNITS = new Set(['ml', 'l', 'tsp', 'tbsp', 'cup']);
const IMPERIAL_WEIGHT = new Set(['oz', 'lb']);

export type VolumeStandards = {
  tspMl: number;
  tbspMl: number;
  cupMl: number;
};

const DEFAULT_VOLUME: VolumeStandards = { tspMl: 5, tbspMl: 15, cupMl: 240 };

/** Cup and tablespoon sizes. Australia and New Zealand use a 20ml tablespoon and a 250ml cup. */
export function volumeStandardsForCountry(country?: string | null): VolumeStandards {
  const code = (country ?? '').toUpperCase();
  if (code === 'AU' || code === 'NZ') return { tspMl: 5, tbspMl: 20, cupMl: 250 };
  if (code === 'US') return { tspMl: 5, tbspMl: 15, cupMl: 240 };
  if (!code) return DEFAULT_VOLUME;
  return { tspMl: 5, tbspMl: 15, cupMl: 250 };
}

export type CombineAmountsOptions = {
  /** When true, prefer g/ml/kg/l over oz/lb and over cup/tbsp/tsp. */
  preferMetric?: boolean;
  ingredientName?: string;
  /** Household country, used for cup and tablespoon millilitres. */
  country?: string | null;
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

function toVolumeMl(value: number, unit: string, standards: VolumeStandards = DEFAULT_VOLUME): number | null {
  if (unit === 'ml') return value;
  if (unit === 'l') return value * 1000;
  if (unit === 'tsp') return value * standards.tspMl;
  if (unit === 'tbsp') return value * standards.tbspMl;
  if (unit === 'cup') return value * standards.cupMl;
  return null;
}

function formatBase(value: number, base: string): string {
  if (base === 'g') {
    return value >= 1000
      ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}kg`
      : `${Math.round(value)}g`;
  }
  if (base === 'ml') {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}l`;
    }
    // 62.5ml (a metric 1/4 cup) is shopped as 60ml, not 65ml.
    const onHalfStep = value >= 30 && Math.abs(value / 5 - Math.floor(value / 5) - 0.5) < 0.001;
    const rounded = value >= 30
      ? (onHalfStep ? Math.floor(value / 5) : Math.round(value / 5)) * 5
      : Math.max(value > 0 ? 1 : 0, Math.round(value));
    return `${rounded}ml`;
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

function isKnownAmountUnit(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (UNIT_MAP[lower]) return true;
  if (COUNT_SIZE_UNITS.has(lower) || COUNT_PREP_UNITS.has(lower)) return true;
  return (
    lower === 'leaf' ||
    lower === 'leaves' ||
    lower === 'can' ||
    lower === 'cans' ||
    lower === 'tin' ||
    lower === 'tins' ||
    lower === 'slice' ||
    lower === 'slices' ||
    lower === 'sprig' ||
    lower === 'sprigs' ||
    lower === 'stick' ||
    lower === 'sticks' ||
    lower === 'fillet' ||
    lower === 'fillets' ||
    lower === 'rasher' ||
    lower === 'rashers' ||
    lower === 'stalk' ||
    lower === 'stalks' ||
    lower === 'pinch' ||
    lower === 'pinches' ||
    lower === 'handful' ||
    lower === 'handfuls'
  );
}

function numberValue(token: string): number | null {
  const mixed = token.trim().match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(numerator) || !denominator) return null;
    return whole + numerator / denominator;
  }
  const fraction = token.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (!Number.isFinite(numerator) || !denominator) return null;
    return numerator / denominator;
  }
  const value = Number(token.trim());
  return Number.isFinite(value) ? value : null;
}

const AMOUNT_NUMBER = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d*\.?\d+`;

/** Turn pack counts, ranges, and parenthetical equivalents into plain measures. */
function prepareAmountString(raw: string): string {
  let str = normalizeAmountString(raw);
  str = str.replace(
    new RegExp(`(${AMOUNT_NUMBER})\\s*(?:-|–|—|\\bto\\b)\\s*(${AMOUNT_NUMBER})`, 'g'),
    (_, left: string, right: string) => String(Math.max(numberValue(left) ?? 0, numberValue(right) ?? 0)),
  );
  str = str.replace(
    new RegExp(`(\\d*\\.?\\d+)\\s*[x×]\\s*(${AMOUNT_NUMBER})\\s*([a-z]+)?`, 'g'),
    (_, count: string, amount: string, unit?: string) => {
      const total = (numberValue(count) ?? 0) * (numberValue(amount) ?? 0);
      return unit ? `${total} ${unit}` : String(total);
    },
  );
  str = str.replace(
    new RegExp(`(\\d*\\.?\\d+)\\s*\\(\\s*(${AMOUNT_NUMBER})\\s*([a-z]+)\\s*\\)`, 'g'),
    (_, count: string, amount: string, unit: string) => {
      const total = (numberValue(count) ?? 1) * (numberValue(amount) ?? 0);
      return `${total} ${unit}`;
    },
  );
  return str.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Every measure in one amount string. "1/4 cup, 3 tblsp" is two parts, not just the cup. */
export function parseAmountParts(raw: string | undefined): ParsedAmount[] {
  if (!raw?.trim()) return [];
  const str = prepareAmountString(raw);
  const parts: ParsedAmount[] = [];
  const re = new RegExp(AMOUNT_NUMBER, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(str))) {
    const token = match[1] ?? match[0];
    const value = numberValue(token);
    if (value == null) continue;
    const after = str.slice(re.lastIndex);
    const unitMatch = after.match(/^\s*([a-z]+)/);
    let unit = '';
    if (unitMatch?.[1] && isKnownAmountUnit(unitMatch[1])) {
      unit = normaliseUnit(unitMatch[1]);
      re.lastIndex += unitMatch[0].length;
    }
    parts.push({ value, unit, raw: str });
  }
  return parts;
}

export function parseAmount(raw: string | undefined): ParsedAmount | null {
  return parseAmountParts(raw)[0] ?? null;
}

/** Convert a parsed amount into a shoppable count when the ingredient supports it. */
function toShoppingCount(
  parsed: ParsedAmount,
  ingredientName: string,
  def: ShoppingCountDef,
  standards: VolumeStandards,
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

  const ml = toVolumeMl(parsed.value, unit, standards);
  if (ml != null && def.gramsPerUnit) {
    return (ml * 0.7) / def.gramsPerUnit;
  }

  return null;
}

function tryCombineAsShoppingCount(
  amounts: (string | undefined)[],
  ingredientName: string,
  standards: VolumeStandards,
): string | undefined {
  const def = shoppingCountDefFor(ingredientName);
  if (!def) return undefined;

  const rawAmounts = amounts.filter((amount): amount is string => Boolean(amount?.trim()));
  if (rawAmounts.length === 0) return undefined;

  const counts: number[] = [];
  for (const raw of rawAmounts) {
    const parts = parseAmountParts(raw);
    if (parts.length === 0) continue;
    for (const parsed of parts) {
      const count = toShoppingCount(parsed, ingredientName, def, standards);
      if (count == null) return undefined;
      counts.push(count);
    }
  }

  if (counts.length === 0) return undefined;
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!(total > 0)) return undefined;

  if (def.label === 'clove' || shoppingMergeKey(ingredientName) === 'garlic') {
    return formatGarlicClovesAsGrams(total);
  }

  const nearestHalf = Math.round(total * 2) / 2;
  const rounded = nearestHalf === 0 ? 0.5 : nearestHalf;

  return formatShoppingCountLabel(rounded, ingredientName, def.label);
}

export function combineAmounts(
  amounts: (string | undefined)[],
  options: CombineAmountsOptions = {},
): string | undefined {
  const { preferMetric = true, ingredientName, country } = options;
  const standards = volumeStandardsForCountry(country);

  if (ingredientName) {
    const asCount = tryCombineAsShoppingCount(amounts, ingredientName, standards);
    if (asCount) return asCount;
  }

  const parsed = amounts.flatMap((amount) => parseAmountParts(amount));
  if (parsed.length === 0) {
    const raw = [...new Set(amounts.map((amount) => amount?.trim()).filter((amount): amount is string => Boolean(amount)))];
    return raw.length > 0 ? raw.join(' + ') : undefined;
  }

  const units = [...new Set(parsed.map((part) => part.unit))];
  const weightOnly = units.every((unit) => WEIGHT_UNITS.has(unit) || IMPERIAL_WEIGHT.has(unit));
  const volumeOnly = units.every((unit) => VOLUME_UNITS.has(unit));

  if (units.length === 1 && units[0] === 'clove') {
    const total = parsed.reduce((sum, part) => sum + part.value, 0);
    const name = (ingredientName ?? '').toLowerCase();
    if (!name || name.includes('garlic') || shoppingMergeKey(name) === 'garlic') {
      return formatGarlicClovesAsGrams(total);
    }
    return formatNice(total, 'clove');
  }

  const cloveParts = parsed.filter((part) => part.unit === 'clove');
  const weightParts = parsed.filter((part) => WEIGHT_UNITS.has(part.unit) || IMPERIAL_WEIGHT.has(part.unit));
  if (
    cloveParts.length > 0 &&
    weightParts.length + cloveParts.length === parsed.length &&
    (shoppingMergeKey(ingredientName ?? '') === 'garlic' || (ingredientName ?? '').toLowerCase().includes('garlic'))
  ) {
    const cloveCount = cloveParts.reduce((sum, part) => sum + part.value, 0);
    const weightG = weightParts.reduce((sum, part) => sum + (toWeightGrams(part.value, part.unit) ?? 0), 0);
    const totalG = weightG + cloveCount * GARLIC_CLOVE_GRAMS;
    const approxCloves = cloveCount + weightG / GARLIC_CLOVE_GRAMS;
    const grams = Math.round(totalG);
    const approx = Number.isInteger(approxCloves)
      ? String(approxCloves)
      : String(parseFloat(approxCloves.toFixed(1)));
    return `${grams}g (approx ${approx} cloves)`;
  }

  if (weightOnly) {
    const totalG = parsed.reduce((sum, part) => sum + (toWeightGrams(part.value, part.unit) ?? 0), 0);
    return formatBase(totalG, 'g');
  }

  if (volumeOnly && (preferMetric || units.length > 1)) {
    const totalMl = parsed.reduce((sum, part) => sum + (toVolumeMl(part.value, part.unit, standards) ?? 0), 0);
    return formatBase(totalMl, 'ml');
  }

  if (units.length === 1) {
    const unit = units[0] ?? '';
    const total = parsed.reduce((sum, part) => sum + part.value, 0);
    return formatNice(total, unit);
  }

  const distinct = [...new Set(amounts.map((amount) => amount?.trim()).filter((amount): amount is string => Boolean(amount)))];
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
  country?: string | null;
};

export function deduplicateIngredients(
  all: FlatIngredient[],
  options: DeduplicateOptions = {},
): FlatIngredient[] {
  const preferMetric = options.preferMetric ?? true;
  const standards = volumeStandardsForCountry(options.country);
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

    const parsed = group.flatMap((item) => parseAmountParts(item.amount));
    const units = [...new Set(parsed.map((p) => p.unit))];
    const hasWeight = units.some((u) => WEIGHT_UNITS.has(u) || IMPERIAL_WEIGHT.has(u) || u === 'clove');
    const hasVolume = units.some((u) => VOLUME_UNITS.has(u));
    const density = inferDensityGPerMl(representativeName, representative.category);
    const liquid = isLikelyLiquid(representativeName, representative.category);

    let combined: string | undefined;
    if (parsed.length > 0 && hasWeight && hasVolume) {
      if (liquid) {
        const totalMl = parsed.reduce((sum, p) => {
          const ml = toVolumeMl(p.value, p.unit, standards);
          if (ml !== null) return sum + ml;
          const g = toWeightGrams(p.value, p.unit, representativeName);
          return sum + (g !== null ? g / Math.max(density, 0.01) : 0);
        }, 0);
        combined = formatBase(totalMl, 'ml');
      } else {
        const totalG = parsed.reduce((sum, p) => {
          const g = toWeightGrams(p.value, p.unit, representativeName);
          if (g !== null) return sum + g;
          const ml = toVolumeMl(p.value, p.unit, standards);
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
        { preferMetric, ingredientName: representativeName, country: options.country },
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
