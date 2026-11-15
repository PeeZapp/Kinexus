import {
  estimateRecipeNutrition,
  MEAL_SLOTS,
  type MealSlotKey,
  type Recipe,
  type RecipeClass,
  type RecipeNutritionEstimate,
} from '@kinexus/domain';

export type RecipeIngredientRow = {
  id: string;
  amount: string;
  name: string;
  section: string;
};

export type RecipeMethodRow = {
  id: string;
  text: string;
  section: string;
};

export type RecipeFormState = {
  url: string;
  name: string;
  emoji: string;
  cuisines: string[];
  allergens: string[];
  dietary: string[];
  equipment: string[];
  cookTime: string;
  servings: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredients: RecipeIngredientRow[];
  method: RecipeMethodRow[];
  chefTip: string;
  notes: string;
  slots: MealSlotKey[];
  recipeClass: RecipeClass | null;
  imageUrl: string;
  imageCandidates: string[];
};

const SLOT_KEYS = new Set<string>(MEAL_SLOTS.map((slot) => slot.key));

let rowSeq = 0;
export function newRowId(prefix: string): string {
  rowSeq += 1;
  return `${prefix}-${rowSeq}-${Date.now().toString(36)}`;
}

export const EMPTY_RECIPE_FORM: RecipeFormState = {
  url: '',
  name: '',
  emoji: '🍽️',
  cuisines: [],
  allergens: [],
  dietary: [],
  equipment: [],
  cookTime: '30',
  servings: '4',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  ingredients: [],
  method: [],
  chefTip: '',
  notes: '',
  slots: [],
  recipeClass: null,
  imageUrl: '',
  imageCandidates: [],
};

export function ingredientRowsFrom(list: { amount?: string; name: string }[]): RecipeIngredientRow[] {
  return list.map((ing) => ({
    id: newRowId('ing'),
    amount: ing.amount ?? '',
    name: ing.name,
    section: 'section' in ing && typeof (ing as { section?: unknown }).section === 'string' ? ((ing as { section?: string }).section ?? '') : '',
  }));
}

export function methodRowsFrom(list: Recipe['method'] | undefined): RecipeMethodRow[] {
  const rows: RecipeMethodRow[] = [];
  let currentSection = '';
  for (const item of Array.isArray(list) ? list : []) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('# ')) {
        currentSection = trimmed.slice(2).trim();
        continue;
      }
      rows.push({ id: newRowId('step'), text: trimmed, section: currentSection });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (!text) continue;
    const section = typeof rec.section === 'string' ? rec.section.trim() : '';
    if (section) currentSection = section;
    rows.push({ id: newRowId('step'), text, section: section || currentSection });
  }
  return rows;
}

export function moveRow<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(to, 0, item);
  return next;
}

function num(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && value.trim() ? n : undefined;
}

export function formFromRecipe(recipe: Recipe): RecipeFormState {
  const slots = (recipe.mealSlots ?? []).filter((slot): slot is MealSlotKey => SLOT_KEYS.has(slot));
  return {
    url: recipe.sourceUrl ?? '',
    name: recipe.name,
    emoji: recipe.emoji || '🍽️',
    cuisines: (recipe.cuisines?.length ? recipe.cuisines : recipe.cuisine ? [recipe.cuisine] : []) ?? [],
    allergens: recipe.allergens ?? [],
    dietary: recipe.dietary ?? [],
    equipment: recipe.equipment ?? [],
    cookTime: recipe.cookTime != null ? String(recipe.cookTime) : '',
    servings: recipe.servings != null ? String(recipe.servings) : '',
    calories: recipe.calories != null ? String(recipe.calories) : '',
    protein: recipe.protein != null ? String(recipe.protein) : '',
    carbs: recipe.carbs != null ? String(recipe.carbs) : '',
    fat: recipe.fat != null ? String(recipe.fat) : '',
    ingredients: ingredientRowsFrom(recipe.ingredients ?? []),
    method: methodRowsFrom(recipe.method),
    chefTip: recipe.chefTip ?? '',
    notes: recipe.notes ?? '',
    recipeClass: recipe.recipeClass ?? null,
    slots,
    imageUrl: recipe.imageUrl ?? '',
    imageCandidates: [],
  };
}

export function draftFromForm(
  form: RecipeFormState,
  extras: Partial<Omit<Recipe, 'id' | 'householdId'>> = {},
): Omit<Recipe, 'id' | 'householdId'> {
  return {
    name: form.name.trim(),
    emoji: form.emoji.trim() || '🍽️',
    cuisine: form.cuisines[0]?.trim() || undefined,
    cuisines: form.cuisines,
    allergens: form.allergens,
    dietary: form.dietary,
    equipment: form.equipment,
    cookTime: num(form.cookTime),
    servings: num(form.servings),
    calories: num(form.calories),
    protein: num(form.protein),
    carbs: num(form.carbs),
    fat: num(form.fat),
    ingredients: form.ingredients.flatMap((row) => {
      const name = row.name.trim();
      if (!name) return [];
      const amount = row.amount.trim();
      const section = row.section.trim();
      return [{ name, amount: amount || undefined, ...(section ? { section } : {}) }];
    }),
    method: form.method
      .map((row) => {
        const text = row.text.trim();
        if (!text) return null;
        const section = row.section.trim();
        return { text, ...(section ? { section } : {}) };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    chefTip: form.chefTip.trim() || undefined,
    notes: form.notes.trim() || undefined,
    recipeClass: form.recipeClass ?? undefined,
    mealSlots: form.slots,
    sourceUrl: form.url.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    ...extras,
  };
}

export function formIngredients(form: RecipeFormState) {
  return form.ingredients.flatMap((row) => {
    const name = row.name.trim();
    if (!name) return [];
    const amount = row.amount.trim();
    return [{ name, amount: amount || undefined }];
  });
}

export function applyNutrition(form: RecipeFormState, estimate: RecipeNutritionEstimate): RecipeFormState {
  return {
    ...form,
    calories: String(estimate.calories),
    protein: String(estimate.protein),
    carbs: String(estimate.carbs),
    fat: String(estimate.fat),
  };
}

export function patchRecipeForm(current: RecipeFormState, patch: Partial<RecipeFormState>): RecipeFormState {
  const next = { ...current, ...patch };
  if (!('ingredients' in patch) && !('servings' in patch)) return next;
  const estimate = estimateRecipeNutrition(formIngredients(next), num(next.servings) || 1);
  return estimate ? applyNutrition(next, estimate) : next;
}
