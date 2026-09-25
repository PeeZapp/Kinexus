const SLOT_KEYS = new Set([
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'night_snack',
  'dessert',
]);

export type RecipeIngredientDraft = {
  name: string;
  amount?: string;
  category?: string;
};

export type RecipeDraft = {
  name: string;
  emoji?: string;
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  ingredients: RecipeIngredientDraft[];
  method: string[];
  chefTip?: string;
  mealSlots: string[];
  imageUrl?: string;
};

export function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value[0] != null ? String(value[0]) : undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return undefined;
}

export function normalizeRecipeDraft(raw: Record<string, unknown>): RecipeDraft {
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).flatMap((item) => {
    if (typeof item === 'string') {
      const name = item.trim();
      return name ? [{ name }] : [];
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    const name = asString(rec.name);
    if (!name) return [];
    return [
      {
        name,
        amount: asString(rec.amount),
        category: asString(rec.category),
      },
    ];
  });

  const method = (Array.isArray(raw.method) ? raw.method : []).map((step) => String(step).trim()).filter(Boolean);

  const slotsRaw = raw.mealSlots ?? raw.meal_slots;
  const mealSlots = (Array.isArray(slotsRaw) ? slotsRaw : [])
    .map((slot) => String(slot))
    .filter((slot) => SLOT_KEYS.has(slot));

  return {
    name: presentLabel(asString(raw.name), /^(unknown(\s+recipe)?|n\/a|none)$/i) ?? 'Imported recipe',
    emoji: asString(raw.emoji) ?? '🍽️',
    cuisine: presentLabel(asString(raw.cuisine), /^unknown$/i),
    cookTime: positiveNumber(asNumber(raw.cookTime ?? raw.cook_time)),
    servings: positiveNumber(asNumber(raw.servings)),
    calories: positiveNumber(asNumber(raw.calories)),
    protein: positiveNumber(asNumber(raw.protein)),
    carbs: positiveNumber(asNumber(raw.carbs)),
    fat: positiveNumber(asNumber(raw.fat)),
    vegetarian: asBool(raw.vegetarian),
    ingredients,
    method,
    chefTip: asString(raw.chefTip ?? raw.chef_tip),
    mealSlots: mealSlots.length ? mealSlots : ['dinner'],
    imageUrl: asString(raw.imageUrl ?? raw.image_url),
  };
}

function presentLabel(value: string | undefined, placeholder: RegExp): string | undefined {
  if (!value || placeholder.test(value.trim())) return undefined;
  return value;
}

function positiveNumber(value: number | undefined): number | undefined {
  return value != null && value > 0 ? value : undefined;
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const candidates = [clean];
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(clean.slice(start, end + 1));
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('AI did not return a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI did not return a JSON object');
}
