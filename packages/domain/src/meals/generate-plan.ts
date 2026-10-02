import { roundMoney } from '../stash/money';
import { hideReplacedCatalogRecipes } from './recipe-versions';
import {
  DAYS,
  type Day,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
} from './types';

/** Core meals — the only slots assumed when not selected. */
export const CORE_SLOTS: readonly MealSlotKey[] = ['breakfast', 'lunch', 'dinner'];

export const OPTIONAL_SLOTS: readonly MealSlotKey[] = [
  'morning_snack',
  'afternoon_snack',
  'night_snack',
  'dessert',
];

/** Typical nutrition for each slot (used for proportional budgeting). */
export const SLOT_ASSUMED: Record<MealSlotKey, { calories: number; protein: number }> = {
  breakfast: { calories: 380, protein: 20 },
  morning_snack: { calories: 140, protein: 7 },
  lunch: { calories: 560, protein: 30 },
  afternoon_snack: { calories: 180, protein: 8 },
  dinner: { calories: 660, protein: 38 },
  night_snack: { calories: 140, protein: 7 },
  dessert: { calories: 220, protein: 5 },
};

export const ALL_MEAL_SLOTS: readonly MealSlotKey[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'night_snack',
  'dessert',
];

export type RecipeProteinKind = 'chicken' | 'beef' | 'pork' | 'seafood' | 'plant' | 'egg' | 'turkey' | 'other';

export const PROTEIN_KINDS: readonly { id: RecipeProteinKind; label: string }[] = [
  { id: 'chicken', label: 'Chicken' },
  { id: 'beef', label: 'Beef' },
  { id: 'pork', label: 'Pork' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'plant', label: 'Plant' },
  { id: 'egg', label: 'Egg' },
  { id: 'turkey', label: 'Turkey' },
  { id: 'other', label: 'Other' },
];

export function recipeProteinKind(recipe: Recipe): RecipeProteinKind {
  const names = (recipe.ingredients ?? []).map((i) => normalizeIngredientName(i.name || ''));
  const has = (terms: string[]) => names.some((n) => terms.some((t) => n.includes(t)));
  if (has(['chicken'])) return 'chicken';
  if (has(['beef', 'steak', 'mince'])) return 'beef';
  if (has(['pork', 'bacon', 'ham'])) return 'pork';
  if (has(['salmon', 'tuna', 'fish', 'prawn', 'shrimp'])) return 'seafood';
  if (has(['tofu', 'tempeh', 'lentil', 'bean', 'chickpea'])) return 'plant';
  if (has(['egg'])) return 'egg';
  if (has(['turkey'])) return 'turkey';
  return 'other';
}

function recipeMatchesSlot(recipe: Recipe, slot: MealSlotKey): boolean {
  const rs = recipe.mealSlots ?? [];
  if (rs.includes(slot)) return true;
  const isSnackSlot = slot === 'morning_snack' || slot === 'afternoon_snack' || slot === 'night_snack';
  if (
    isSnackSlot &&
    (rs.includes('morning_snack') || rs.includes('afternoon_snack') || rs.includes('night_snack'))
  ) {
    return true;
  }
  // Lunch dishes are usually dinner-sized; dinner slots can use them.
  if (slot === 'dinner' && rs.includes('lunch')) return true;
  return false;
}

/**
 * Recipes that can fill a slot (falls back to the full eligible library if nothing matches).
 * Base recipes (`isComponent`), household "not for my family" (`excludedFromAuto`),
 * and catalog-removed recipes are never picked.
 */
export function recipesForSlot(recipes: readonly Recipe[], slot: MealSlotKey): Recipe[] {
  const eligible = hideReplacedCatalogRecipes(recipes).filter(
    (r) => !r.isComponent && !r.excludedFromAuto && !r.removed,
  );
  const matched = eligible.filter((r) => recipeMatchesSlot(r, slot));
  return matched.length > 0 ? matched : [...eligible];
}

/**
 * Calorie/protein target for one slot.
 *
 * - Only unselected CORE slots count as "assumed eaten"
 * - Unselected optional slots (snacks, dessert) are not assumed
 * - Remaining budget is distributed across selected slots proportionally
 */
export function slotTarget(
  slot: MealSlotKey,
  selectedSlots: readonly MealSlotKey[],
  goals: NutritionGoals,
): { calories: number; protein: number } {
  const unselectedCore = CORE_SLOTS.filter((s) => !selectedSlots.includes(s));
  const assumedCal = unselectedCore.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0);
  const assumedProt = unselectedCore.reduce((sum, s) => sum + SLOT_ASSUMED[s].protein, 0);

  const budgetCal = Math.max(goals.calories - assumedCal, 80);
  const budgetProt = Math.max(goals.protein - assumedProt, 5);

  const totalSelectedCal = selectedSlots.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0);
  const totalSelectedProt = selectedSlots.reduce((sum, s) => sum + SLOT_ASSUMED[s].protein, 0);

  const shareCal =
    totalSelectedCal > 0
      ? SLOT_ASSUMED[slot].calories / totalSelectedCal
      : selectedSlots.length > 0
        ? 1 / selectedSlots.length
        : 0;
  const shareProt =
    totalSelectedProt > 0
      ? SLOT_ASSUMED[slot].protein / totalSelectedProt
      : selectedSlots.length > 0
        ? 1 / selectedSlots.length
        : 0;

  return {
    calories: Math.round(budgetCal * shareCal),
    protein: Math.round(budgetProt * shareProt),
  };
}

function slotCostWeight(slot: MealSlotKey): number {
  return SLOT_ASSUMED[slot].calories;
}

function allSlotCostWeight(): number {
  return ALL_MEAL_SLOTS.reduce((sum, slot) => sum + slotCostWeight(slot), 0);
}

/** Shopping cost of putting this recipe on the plan once. */
export function recipeShoppingCost(recipe: Recipe): number | null {
  const cost = recipe.cost;
  if (!cost) return null;
  if (Number.isFinite(cost.totalCost) && cost.totalCost >= 0) return cost.totalCost;
  if (!Number.isFinite(cost.costPerServe) || cost.costPerServe < 0) return null;
  const serves = cost.servingsBasis > 0 ? cost.servingsBasis : 1;
  return roundMoney(cost.costPerServe * serves);
}

export function fitsSlotBudget(cost: number, cap: number): boolean {
  return Math.round(cost * 100) <= Math.round(cap * 100);
}

/**
 * Max shopping cost for one occurrence of a slot.
 * Every slot, including unselected snacks, keeps a share of the weekly total.
 */
export function slotOccurrenceBudget(weeklyBudget: number, slot: MealSlotKey): number {
  const total = allSlotCostWeight();
  if (!(weeklyBudget > 0) || total <= 0) return 0;
  return (weeklyBudget * slotCostWeight(slot)) / total / DAYS.length;
}

/** How a weekly food budget splits between slots being filled and slots left alone. */
export function weeklyBudgetSplit(
  weeklyBudget: number,
  selectedSlots: readonly MealSlotKey[],
): { selected: number; reserved: number } {
  const total = allSlotCostWeight();
  const selectedWeight = selectedSlots.reduce((sum, slot) => sum + slotCostWeight(slot), 0);
  const selected = total > 0 && weeklyBudget > 0 ? roundMoney((weeklyBudget * selectedWeight) / total) : 0;
  return { selected, reserved: roundMoney(Math.max(0, weeklyBudget - selected)) };
}

/** Cap for the days actually being filled. A shorter plan does not absorb the rest of the week. */
export function planBudgetCap(
  weeklyBudget: number,
  selectedSlots: readonly MealSlotKey[],
  dayCount: number,
): number {
  if (!(weeklyBudget > 0) || dayCount <= 0) return 0;
  const perDay = selectedSlots.reduce((sum, slot) => sum + slotOccurrenceBudget(weeklyBudget, slot), 0);
  return roundMoney(perDay * dayCount);
}

export function planShoppingCost(rows: readonly { recipe: Recipe }[]): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const row of rows) {
    const cost = recipeShoppingCost(row.recipe);
    if (cost == null) missing += 1;
    else total += cost;
  }
  return { total: roundMoney(total), missing };
}

/** Blank or zero means no budget. "$400" and "400" both parse. */
export function parseWeeklyFoodBudget(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return roundMoney(amount);
}

/** Recipes at or under `cap`, or the cheapest band when nothing fits. */
export function recipesAffordableForBudget(recipes: readonly Recipe[], cap: number): Recipe[] {
  const priced = recipes.filter((recipe) => recipeShoppingCost(recipe) != null);
  const affordable = priced.filter((recipe) => fitsSlotBudget(recipeShoppingCost(recipe)!, cap));
  if (affordable.length > 0) return affordable;
  if (priced.length === 0) return [...recipes];
  const cheapest = Math.min(...priced.map((recipe) => recipeShoppingCost(recipe)!));
  const ceiling = Math.max(cheapest * 1.15, cheapest + 1);
  return priced.filter((recipe) => (recipeShoppingCost(recipe) ?? Infinity) <= ceiling);
}

function poolWithinBudget(preferred: readonly Recipe[], fallback: readonly Recipe[], cap: number): Recipe[] {
  const affordable = preferred.filter((recipe) => {
    const cost = recipeShoppingCost(recipe);
    return cost != null && fitsSlotBudget(cost, cap);
  });
  if (affordable.length > 0) return affordable;
  return recipesAffordableForBudget(fallback, cap);
}

/** Lower is better — matches auto-fill scoring (cal diff + 4× protein diff). */
export function nutritionFitScore(
  recipe: Recipe,
  target: { calories: number; protein: number },
): number {
  const calDiff = Math.abs((recipe.calories ?? target.calories) - target.calories);
  const protDiff = Math.abs((recipe.protein ?? target.protein) - target.protein);
  return calDiff + protDiff * 4;
}

export type GeneratedSlot = {
  day: Day;
  slot: MealSlotKey;
  recipe: Recipe;
  targetCalories: number;
  targetProtein: number;
};

const STAPLE_INGREDIENTS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'butter',
]);

function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function recipeIngredientSet(recipe: Recipe): Set<string> {
  return new Set(
    (recipe.ingredients ?? [])
      .map((i) => normalizeIngredientName(i.name || ''))
      .filter((n) => n && !STAPLE_INGREDIENTS.has(n)),
  );
}

function dominantProtein(recipe: Recipe): RecipeProteinKind {
  return recipeProteinKind(recipe);
}

export type GenerateMealPlanOptions = {
  /** Injected for tests. Defaults to `Math.random`. */
  random?: () => number;
  /** Days to fill. Defaults to the full week. */
  days?: readonly Day[];
  /**
   * Whole-week household food budget. Unselected slots, including snacks, keep their share,
   * so a dinner-only plan cannot spend the full amount.
   */
  weeklyBudget?: number;
};

export function generateMealPlan(
  selectedSlots: readonly MealSlotKey[],
  existingSlotKeys: ReadonlySet<string>,
  recipes: readonly Recipe[],
  goals: NutritionGoals,
  options?: GenerateMealPlanOptions,
): GeneratedSlot[] {
  if (selectedSlots.length === 0 || recipes.length === 0) return [];

  const random = options?.random ?? Math.random;
  const weeklyBudget = options?.weeklyBudget;
  const results: GeneratedSlot[] = [];

  const usedPerSlot = new Map<MealSlotKey, Set<string>>(
    selectedSlots.map((s) => [s, new Set<string>()]),
  );
  const ingredientUsage = new Map<string, number>();
  const proteinUsage = new Map<string, number>();
  const cuisineUsage = new Map<string, number>();

  const PROTEIN_HARD_CAP = 3;
  const CUISINE_HARD_CAP = 3;

  const allowedDays = options?.days ? new Set(options.days) : null;
  const days = allowedDays ? DAYS.filter((day) => allowedDays.has(day)) : DAYS;

  for (const day of days) {
    for (const slot of selectedSlots) {
      const key = `${day}_${slot}`;
      if (existingSlotKeys.has(key)) continue;

      const target = slotTarget(slot, selectedSlots, goals);
      const pool = recipesForSlot(recipes, slot);
      if (pool.length === 0) continue;

      const used = usedPerSlot.get(slot) ?? new Set<string>();
      const unused = pool.filter((r) => !used.has(r.id));
      const candidates = unused.length > 0 ? unused : pool;

      const eligibleByHardCaps = candidates.filter((r) => {
        const proteinKey = dominantProtein(r);
        const cuisineKey = (r.cuisine || 'unknown').toLowerCase();
        return (
          (proteinUsage.get(proteinKey) ?? 0) < PROTEIN_HARD_CAP &&
          (cuisineUsage.get(cuisineKey) ?? 0) < CUISINE_HARD_CAP
        );
      });
      const varietyPool = eligibleByHardCaps.length > 0 ? eligibleByHardCaps : candidates;
      const scoringPool =
        weeklyBudget != null && weeklyBudget > 0
          ? poolWithinBudget(varietyPool, pool, slotOccurrenceBudget(weeklyBudget, slot))
          : varietyPool;

      const scored = scoringPool.map((r) => {
        const nutritionScore = nutritionFitScore(r, target);
        const ingSet = recipeIngredientSet(r);
        let overlapHits = 0;
        ingSet.forEach((ing) => {
          if (ingredientUsage.has(ing)) overlapHits += 1;
        });
        const overlapBoost = Math.min(overlapHits, 4) * 35;
        const proteinKey = dominantProtein(r);
        const proteinPenalty = (proteinUsage.get(proteinKey) ?? 0) * 55;
        const cuisineKey = (r.cuisine || 'unknown').toLowerCase();
        const cuisinePenalty = (cuisineUsage.get(cuisineKey) ?? 0) * 30;
        return { recipe: r, score: nutritionScore + proteinPenalty + cuisinePenalty - overlapBoost };
      });
      scored.sort((a, b) => a.score - b.score);

      const topN = Math.min(3, scored.length);
      if (topN === 0) continue;
      const picked = scored[Math.floor(random() * topN)]?.recipe;
      if (!picked) continue;

      used.add(picked.id);
      recipeIngredientSet(picked).forEach((ing) => {
        ingredientUsage.set(ing, (ingredientUsage.get(ing) ?? 0) + 1);
      });
      const proteinKey = dominantProtein(picked);
      proteinUsage.set(proteinKey, (proteinUsage.get(proteinKey) ?? 0) + 1);
      const cuisineKey = (picked.cuisine || 'unknown').toLowerCase();
      cuisineUsage.set(cuisineKey, (cuisineUsage.get(cuisineKey) ?? 0) + 1);

      results.push({
        day,
        slot,
        recipe: picked,
        targetCalories: target.calories,
        targetProtein: target.protein,
      });
    }
  }

  return results;
}
