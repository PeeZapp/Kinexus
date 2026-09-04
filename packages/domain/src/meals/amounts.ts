export type ParsedAmount = {
  value: number;
  unit: string;
  raw: string;
};

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
};

const WEIGHT_UNITS = new Set(['g', 'kg']);
const VOLUME_UNITS = new Set(['ml', 'l', 'tsp', 'tbsp', 'cup']);

function normaliseUnit(raw: string): string {
  return UNIT_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

function toWeightGrams(value: number, unit: string): number | null {
  if (unit === 'g') return value;
  if (unit === 'kg') return value * 1000;
  if (unit === 'oz') return value * 28.3495;
  if (unit === 'lb') return value * 453.592;
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
  return ['oil', 'milk', 'cream', 'water', 'juice', 'vinegar', 'soy sauce', 'broth', 'stock'].some((k) =>
    name.includes(k),
  );
}

export function parseAmount(raw: string | undefined): ParsedAmount | null {
  if (!raw || !raw.trim()) return null;
  const str = raw.trim().toLowerCase();

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

export function combineAmounts(amounts: (string | undefined)[]): string | undefined {
  const parsed = amounts.map(parseAmount).filter((p): p is ParsedAmount => p !== null);

  if (parsed.length === 0) return undefined;

  const units = [...new Set(parsed.map((p) => p.unit))];

  if (units.length === 1) {
    const unit = units[0] ?? '';
    const total = parsed.reduce((s, p) => s + p.value, 0);
    const nice = Number.isInteger(total) ? `${total}` : `${parseFloat(total.toFixed(2))}`;
    return unit ? `${nice}${unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l' ? '' : ' '}${unit}` : nice;
  }

  if (units.every((u) => WEIGHT_UNITS.has(u))) {
    const totalG = parsed.reduce((s, p) => {
      const g = toWeightGrams(p.value, p.unit);
      return s + (g ?? 0);
    }, 0);
    return formatBase(totalG, 'g');
  }

  if (units.every((u) => VOLUME_UNITS.has(u))) {
    const totalMl = parsed.reduce((s, p) => {
      const ml = toVolumeMl(p.value, p.unit);
      return s + (ml ?? 0);
    }, 0);
    return formatBase(totalMl, 'ml');
  }

  const distinct = [...new Set(amounts.filter((a): a is string => Boolean(a)))];
  return distinct.join(' + ');
}

export type FlatIngredient = {
  name: string;
  amount?: string;
  category?: string;
};

export function deduplicateIngredients(all: FlatIngredient[]): FlatIngredient[] {
  const map = new Map<string, FlatIngredient[]>();

  for (const ing of all) {
    const key = ing.name.trim().toLowerCase();
    const group = map.get(key);
    if (group) group.push(ing);
    else map.set(key, [ing]);
  }

  const result: FlatIngredient[] = [];
  for (const [, group] of map) {
    const representative = group[0];
    if (!representative) continue;
    const parsed = group.map((g) => parseAmount(g.amount)).filter((p): p is ParsedAmount => p !== null);
    const units = [...new Set(parsed.map((p) => p.unit))];
    const hasWeight = units.some((u) => WEIGHT_UNITS.has(u) || u === 'oz' || u === 'lb');
    const hasVolume = units.some((u) => VOLUME_UNITS.has(u));
    const density = inferDensityGPerMl(representative.name, representative.category);
    const liquid = isLikelyLiquid(representative.name, representative.category);

    let combined: string | undefined;
    if (parsed.length > 0 && hasWeight && hasVolume) {
      if (liquid) {
        const totalMl = parsed.reduce((sum, p) => {
          const ml = toVolumeMl(p.value, p.unit);
          if (ml !== null) return sum + ml;
          const g = toWeightGrams(p.value, p.unit);
          return sum + (g !== null ? g / Math.max(density, 0.01) : 0);
        }, 0);
        combined = formatBase(totalMl, 'ml');
      } else {
        const totalG = parsed.reduce((sum, p) => {
          const g = toWeightGrams(p.value, p.unit);
          if (g !== null) return sum + g;
          const ml = toVolumeMl(p.value, p.unit);
          return sum + (ml !== null ? ml * density : 0);
        }, 0);
        combined = formatBase(totalG, 'g');
      }
    } else {
      combined = combineAmounts(group.map((g) => g.amount));
    }

    result.push({
      name: representative.name,
      amount: combined,
      category: representative.category,
    });
  }

  return result;
}
