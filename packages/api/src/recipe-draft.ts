import { knownAllergenId, knownEquipmentId, normalizeFoodTags } from '@kinexus/domain';

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
  cuisines?: string[];
  allergens?: string[];
  equipment?: string[];
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
  /** External cover candidates for the import UI (CDN URLs; mirrored on save). */
  imageCandidates?: string[];
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

  const method: string[] = [];
  let currentSection: string | undefined;
  for (const item of Array.isArray(raw.method) ? raw.method : []) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (!text) continue;
      method.push(text);
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text = asString(rec.text);
    if (!text) continue;
    const section = asString(rec.section);
    if (section && section !== currentSection) {
      method.push(`# ${section}`);
      currentSection = section;
    }
    method.push(text);
  }

  const slotsRaw = raw.mealSlots ?? raw.meal_slots;
  const mealSlots = (Array.isArray(slotsRaw) ? slotsRaw : [])
    .map((slot) => String(slot))
    .filter((slot) => SLOT_KEYS.has(slot));

  const cuisine = presentLabel(asString(raw.cuisine), /^unknown$/i);
  const cuisines = normalizeFoodTags([
    ...(Array.isArray(raw.cuisines) ? raw.cuisines.map((item) => String(item)) : []),
    ...(cuisine ? [cuisine] : []),
  ]);
  const allergens = normalizeIdList(raw.allergens, knownAllergenId);
  const equipment = normalizeIdList(raw.equipment, knownEquipmentId);

  return {
    name: presentLabel(asString(raw.name), /^(unknown(\s+recipe)?|n\/a|none)$/i) ?? 'Imported recipe',
    emoji: asString(raw.emoji) ?? '🍽️',
    cuisine: cuisines[0] ?? cuisine,
    cuisines: cuisines.length ? cuisines : undefined,
    allergens: allergens.length ? allergens : undefined,
    equipment: equipment.length ? equipment : undefined,
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
    imageCandidates: asUrlList(raw.imageCandidates ?? raw.image_candidates),
  };
}

function normalizeIdList(
  value: unknown,
  resolve: (raw: string) => string | null,
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = resolve(String(item ?? ''));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function asUrlList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return urls.length ? urls.slice(0, 10) : undefined;
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
