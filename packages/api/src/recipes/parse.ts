import type { CleanIngredient, CleanMethodBlock, RecipeQuantity } from '@kinexus/domain';

export type ExtractedRecipeCore = {
  title: string;
  ingredients: CleanIngredient[];
  method: CleanMethodBlock[];
  imageUrl?: string;
  originalServings?: number;
  cookTimeMinutes?: number;
  cuisine?: string;
  vegetarian?: boolean;
  chefTip?: string;
  authorName?: string;
  siteName?: string;
};

export function createIdFactory(): (prefix: string) => string {
  let n = 0;
  return (prefix: string) => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

const AMOUNT_PREFIX =
  /^([\d\s½¼¾⅓⅔⅛⅜⅝⅞.,/]+(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|tablespoon|teaspoon|teaspoons|tablespoons|piece|pieces|can|cans|clove|cloves|sprig|sprigs|bunch|slice|slices)?\.?)\s+(.+)$/i;

export function ingredientFromLine(text: string, id: string, group?: string): CleanIngredient | null {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return null;
  const match = line.match(AMOUNT_PREFIX);
  if (match?.[1] && match[2]) {
    const raw = match[1].trim();
    return {
      id,
      name: match[2].trim(),
      quantity: quantityFromRaw(raw),
      group,
    };
  }
  return { id, name: line, group };
}

export function quantityFromRaw(raw: string): RecipeQuantity {
  const str = raw.trim();
  const numberMatch = str.match(/(\d+\s*\/\s*\d+|\d*\.?\d+)/);
  const token = numberMatch?.[1]?.replace(/\s+/g, '');
  if (!token) return { value: null, raw: str };
  let value = 0;
  if (token.includes('/')) {
    const [num, den] = token.split('/');
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { value: null, raw: str };
    value = n / d;
  } else {
    value = Number(token);
  }
  if (!Number.isFinite(value)) return { value: null, raw: str };
  const tail = str.slice((numberMatch?.index ?? 0) + (numberMatch?.[0].length ?? 0));
  const unit = tail.match(/[a-zA-Z]+/)?.[0]?.toLowerCase();
  return { value, unit, raw: str };
}

export function parseIsoDurationMinutes(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const hours = Number(iso.match(/(\d+)H/i)?.[1] ?? '0');
  const minutes = Number(iso.match(/(\d+)M/i)?.[1] ?? '0');
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

export function servingsFromYield(value: unknown): number | undefined {
  const source = Array.isArray(value) ? value[0] : value;
  if (source == null) return undefined;
  const match = String(source).match(/\d+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function imageFromSchema(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) return imageFromSchema(value[0]);
  if (typeof value === 'object') {
    const rec = value as { url?: unknown };
    return typeof rec.url === 'string' ? rec.url.trim() || undefined : undefined;
  }
  return undefined;
}

export function asText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return asText(value[0]);
  if (typeof value === 'object') {
    const rec = value as { name?: unknown; text?: unknown };
    return asText(rec.text ?? rec.name);
  }
  const text = String(value).trim();
  return text || undefined;
}
