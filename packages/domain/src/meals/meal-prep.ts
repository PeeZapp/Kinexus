import {
  DAYS,
  DAY_LABELS,
  type Day,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
} from './types';
import {
  nutritionFitScore,
  recipeShoppingCost,
  recipesAffordableForBudget,
  recipesForSlot,
  slotOccurrenceBudget,
  slotTarget,
  type GeneratedSlot,
} from './generate-plan';
import { hideReplacedCatalogRecipes } from './recipe-versions';

export type MealPrepStyle = 'week_portions' | 'freezer_batch';

export type MealPrepParams = {
  style: MealPrepStyle;
  /** Day you cook / batch everything. */
  cookDay: Day;
  /** Meal slots to fill with prep (usually lunch and/or dinner). */
  slots: readonly MealSlotKey[];
  /** How many different dishes to cook in the session (1–3). */
  dishCount: number;
  /**
   * How many days (including cook day) to cover going forward in the week.
   * Caps at days remaining from cook day through Sunday.
   */
  daysToCover: number;
  goals: NutritionGoals;
  weeklyBudget?: number;
  /** Injected for tests. Defaults to `Math.random`. */
  random?: () => number;
};

export type MealPrepResult = {
  slots: GeneratedSlot[];
  /** Unique recipes to make on the cook day. */
  cookList: Recipe[];
  style: MealPrepStyle;
  cookDay: Day;
  /** How many plan cells each cook-list recipe fills. */
  portionsByRecipeId: Record<string, number>;
};

const PREP_BOOST = [
  'stew',
  'curry',
  'chilli',
  'chili',
  'soup',
  'casserole',
  'bake',
  'tray',
  'roast',
  'bolognese',
  'lasagne',
  'lasagna',
  'braise',
  'slow',
  'crock',
  'meatball',
  'pie',
  'ragù',
  'ragu',
  'tagine',
  'biryani',
  'goulash',
  'risotto',
  'chilli con carne',
  'batch',
  'freezer',
  'leftover',
];

const PREP_PENALTY = [
  'salad',
  'toast',
  'scramble',
  'sandwich',
  'wrap',
  'waffle',
  'pancake',
  'sushi',
  'stir fry',
  'stir-fry',
  'omelette',
  'omelet',
  'smoothie',
  'cereal',
  'yogurt',
  'yoghurt',
];

const FREEZER_BOOST = [
  'stew',
  'curry',
  'chilli',
  'chili',
  'soup',
  'casserole',
  'bolognese',
  'lasagne',
  'lasagna',
  'braise',
  'meatball',
  'pie',
  'ragù',
  'ragu',
  'goulash',
  'freezer',
];

function haystack(recipe: Recipe): string {
  return `${recipe.name} ${recipe.notes ?? ''} ${recipe.chefTip ?? ''}`.toLowerCase();
}

/** Soft score — higher is better for meal-prep style cooking. */
export function mealPrepScore(recipe: Recipe, style: MealPrepStyle): number {
  const text = haystack(recipe);
  let score = 0;

  for (const term of PREP_BOOST) {
    if (text.includes(term)) score += 25;
  }
  for (const term of PREP_PENALTY) {
    if (text.includes(term)) score -= 40;
  }

  const servings = recipe.servings ?? 0;
  if (servings >= 6) score += 30;
  else if (servings >= 4) score += 18;
  else if (servings > 0 && servings <= 2) score -= 15;

  const cook = recipe.cookTime ?? 0;
  if (cook >= 35 && cook <= 120) score += 20;
  else if (cook > 0 && cook < 20) score -= 25;
  else if (cook > 150) score += 5;

  if (style === 'freezer_batch') {
    for (const term of FREEZER_BOOST) {
      if (text.includes(term)) score += 15;
    }
  }

  return score;
}

export function recipesForMealPrep(
  recipes: readonly Recipe[],
  slot: MealSlotKey,
  style: MealPrepStyle,
): Recipe[] {
  const pool = recipesForSlot(recipes, slot);
  const scored = pool
    .map((recipe) => ({ recipe, score: mealPrepScore(recipe, style) }))
    .sort((a, b) => b.score - a.score);
  const friendly = scored.filter((row) => row.score >= 0).map((row) => row.recipe);
  return friendly.length > 0 ? friendly : scored.map((row) => row.recipe);
}

function daysFromCookDay(cookDay: Day, daysToCover: number): Day[] {
  const start = DAYS.indexOf(cookDay);
  if (start < 0) return [];
  const remaining = DAYS.slice(start);
  const count = Math.max(1, Math.min(daysToCover, remaining.length));
  return remaining.slice(0, count);
}

function clampDishCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(3, Math.round(value)));
}

function pickDishes(args: {
  pool: readonly Recipe[];
  count: number;
  target: { calories: number; protein: number };
  style: MealPrepStyle;
  weeklyBudget: number | undefined;
  slot: MealSlotKey;
  random: () => number;
}): Recipe[] {
  const { pool, count, target, style, weeklyBudget, slot, random } = args;
  if (pool.length === 0) return [];

  let candidates = [...pool];
  if (weeklyBudget != null && weeklyBudget > 0) {
    const cap = slotOccurrenceBudget(weeklyBudget, slot);
    const affordable = recipesAffordableForBudget(candidates, cap);
    if (affordable.length > 0) candidates = affordable;
  }

  const ranked = candidates
    .map((recipe) => ({
      recipe,
      score: nutritionFitScore(recipe, target) - mealPrepScore(recipe, style) * 2,
    }))
    .sort((a, b) => a.score - b.score);

  const picked: Recipe[] = [];
  const used = new Set<string>();
  const topBand = ranked.slice(0, Math.min(8, ranked.length));

  while (picked.length < count && topBand.length > 0) {
    const available = topBand.filter((row) => !used.has(row.recipe.id));
    if (available.length === 0) break;
    const choice = available[Math.floor(random() * Math.min(3, available.length))]?.recipe;
    if (!choice) break;
    used.add(choice.id);
    picked.push(choice);
  }

  // If pool is tiny, allow reuse of best dish so we still fill dishCount for UI.
  while (picked.length < count && ranked.length > 0) {
    picked.push(ranked[picked.length % ranked.length]!.recipe);
  }

  return picked.slice(0, count);
}

/**
 * Build a meal-prep preview: pick a few prep-friendly dishes for the cook day,
 * then repeat them across the chosen slots for the days being covered.
 */
export function generateMealPrepPlan(
  recipes: readonly Recipe[],
  existingSlotKeys: ReadonlySet<string>,
  params: MealPrepParams,
): MealPrepResult {
  const slots = params.slots.filter(Boolean);
  if (slots.length === 0 || recipes.length === 0) {
    return {
      slots: [],
      cookList: [],
      style: params.style,
      cookDay: params.cookDay,
      portionsByRecipeId: {},
    };
  }

  const random = params.random ?? Math.random;
  const dishCount = clampDishCount(params.dishCount);
  const coverDays = daysFromCookDay(params.cookDay, params.daysToCover);
  const library = hideReplacedCatalogRecipes(recipes).filter(
    (r) => !r.isComponent && !r.excludedFromAuto && !r.removed,
  );

  // Prefer the first selected slot for picking dishes (usually lunch or dinner).
  const primarySlot = slots[0]!;
  const pool = recipesForMealPrep(library, primarySlot, params.style);
  const target = slotTarget(primarySlot, slots, params.goals);
  const dishes = pickDishes({
    pool,
    count: dishCount,
    target,
    style: params.style,
    weeklyBudget: params.weeklyBudget,
    slot: primarySlot,
    random,
  });

  if (dishes.length === 0) {
    return {
      slots: [],
      cookList: [],
      style: params.style,
      cookDay: params.cookDay,
      portionsByRecipeId: {},
    };
  }

  const results: GeneratedSlot[] = [];
  const portionsByRecipeId: Record<string, number> = {};
  let cellIndex = 0;

  for (const day of coverDays) {
    for (const slot of slots) {
      const key = `${day}_${slot}`;
      if (existingSlotKeys.has(key)) continue;

      let recipe: Recipe;
      if (params.style === 'freezer_batch') {
        // Rotate dishes across cells so freezer meals alternate through the week.
        recipe = dishes[cellIndex % dishes.length]!;
        cellIndex += 1;
      } else if (slots.length === 1) {
        // One meal type (e.g. all lunches): cycle dishes across days for variety.
        recipe = dishes[cellIndex % dishes.length]!;
        cellIndex += 1;
      } else {
        // Several meal types: keep one dish per slot so breakfast/lunch stay stable.
        recipe = dishes[Math.min(slots.indexOf(slot), dishes.length - 1)]!;
      }

      const slotGoals = slotTarget(slot, slots, params.goals);
      portionsByRecipeId[recipe.id] = (portionsByRecipeId[recipe.id] ?? 0) + 1;
      results.push({
        day,
        slot,
        recipe,
        targetCalories: slotGoals.calories,
        targetProtein: slotGoals.protein,
      });
    }
  }

  const cookList = dishes.filter((dish, index) => dishes.findIndex((d) => d.id === dish.id) === index);

  return {
    slots: results,
    cookList,
    style: params.style,
    cookDay: params.cookDay,
    portionsByRecipeId,
  };
}

/** Default days to cover from a cook day through Sunday. */
export function defaultMealPrepDaysToCover(cookDay: Day): number {
  return Math.max(1, DAYS.length - DAYS.indexOf(cookDay));
}

export function mealPrepCookSummary(result: MealPrepResult): string {
  if (result.cookList.length === 0) return '';
  const parts = result.cookList.map((recipe) => {
    const portions = result.portionsByRecipeId[recipe.id] ?? 1;
    return `${recipe.name} (${portions} meal${portions === 1 ? '' : 's'})`;
  });
  const dayLabel = DAY_LABELS[result.cookDay];
  if (result.style === 'freezer_batch') {
    return `Cook on ${dayLabel}, then freeze: ${parts.join(', ')}.`;
  }
  return `Prep on ${dayLabel}: ${parts.join(', ')}.`;
}

/** Cost of shopping the cook list once (not each plan occurrence). */
export function mealPrepCookListCost(cookList: readonly Recipe[]): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const recipe of cookList) {
    const cost = recipeShoppingCost(recipe);
    if (cost == null) missing += 1;
    else total += cost;
  }
  return { total, missing };
}
