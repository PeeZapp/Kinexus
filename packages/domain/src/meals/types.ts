export type MealSlotKey =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'night_snack'
  | 'dessert';

export type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS: readonly Day[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const MEAL_SLOTS: readonly { key: MealSlotKey; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'morning_snack', label: 'Morning Snack' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'afternoon_snack', label: 'Afternoon Snack' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'night_snack', label: 'Night Snack' },
  { key: 'dessert', label: 'Dessert' },
];

export type Ingredient = {
  name: string;
  amount?: string;
  category?: string;
  /** Links to a base recipe (`isComponent: true`) in the library. */
  baseRecipeId?: string;
};

export type RecipeCostLine = {
  name: string;
  amount?: string;
  lineCost: number;
  store?: string;
  note?: string;
};

/** Country-scoped supermarket estimate for a recipe. Refreshed monthly. */
export type RecipeCostEstimate = {
  totalCost: number;
  costPerServe: number;
  currency: string;
  country: string;
  stores: string[];
  pricedAt: string;
  servingsBasis: number;
  breakdown: RecipeCostLine[];
  coveredIngredients?: number;
  totalIngredients?: number;
};

export type Recipe = {
  id: string;
  name: string;
  /** Null = system/catalog seed. */
  householdId: string | null;
  emoji?: string;
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  ingredients?: Ingredient[];
  method?: string[];
  chefTip?: string;
  notes?: string;
  mealSlots?: MealSlotKey[];
  isComponent?: boolean;
  /** Household marked this recipe as not for the family — skip plans and suggestions. */
  excludedFromAuto?: boolean;
  sourceUrl?: string;
  imageUrl?: string;
  imageFlagged?: boolean;
  removed?: boolean;
  isCommunity?: boolean;
  /** Approximate supermarket cost for the household's country. */
  cost?: RecipeCostEstimate;
  /** Recipe this household copy was forked from (catalog or another household recipe). */
  sourcedFromRecipeId?: string;
  /** When true, this household copy replaces the source recipe in the household library. */
  replacesSource?: boolean;
  /** Profile that published a catalog recipe (creator library). */
  createdBy?: string;
  /** When this catalog recipe was last published/updated by a creator. */
  creatorPublishedAt?: string;
  /** Household recipe this catalog row was published from. */
  creatorSourceRecipeId?: string;
};

export type NutritionGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionGoalPreset =
  | 'maintenance'
  | 'muscle_gain'
  | 'weight_loss'
  | 'keto'
  | 'high_protein_cut'
  | 'low_carb'
  | 'endurance'
  | 'recomp'
  | 'lean_bulk'
  | 'custom';

/** One plan cell (row-level; not a week-wide blob). */
export type MealSlot = {
  day: Day;
  slotKey: MealSlotKey;
  recipeId?: string;
  recipeName?: string;
  emoji?: string;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  cookTime?: number;
  hidden?: boolean;
  eatenBy?: Record<string, boolean>;
  /** Household person who may pick the recipe for this cell. */
  assignedPersonId?: string;
  /**
   * Who this meal is for. Empty = household-wide meal.
   * Non-empty = personal/group meal for those household people only.
   */
  audiencePersonIds?: string[];
};

export type MealPlan = {
  id: string;
  householdId: string;
  weekStart: string;
  activeSlots: MealSlotKey[];
  slots: MealSlot[];
};

export type ShoppingRecipeSource = {
  recipeId: string;
  recipeName: string;
};

export type DerivedShoppingItem = {
  name: string;
  amount?: string;
  category: string;
  isBaseRecipe?: boolean;
  baseRecipeId?: string;
  baseRecipeName?: string;
  recipeSources: ShoppingRecipeSource[];
  sharedMealCount: number;
  /** Other ingredient name spellings merged into this row. */
  mergedFrom?: string[];
};

export type PersonDietary = {
  dietary?: string[];
};

/** Sorted unique person ids for stable keys / DB array equality. */
export function normalizeAudiencePersonIds(ids: readonly string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.filter(Boolean))].sort();
}

export function isHouseholdAudience(ids: readonly string[] | null | undefined): boolean {
  return normalizeAudiencePersonIds(ids).length === 0;
}

export function mealSlotRecordKey(
  day: Day,
  slot: MealSlotKey,
  audiencePersonIds?: readonly string[] | null,
): string {
  const audience = normalizeAudiencePersonIds(audiencePersonIds);
  return audience.length === 0 ? `${day}_${slot}` : `${day}_${slot}__${audience.join(',')}`;
}

/**
 * Household meals plus meals whose audience includes this person.
 * Pass null/empty only when matching a concrete person is not required.
 */
export function slotMatchesPersonFilter(
  slot: { audiencePersonIds?: readonly string[] | null; hidden?: boolean },
  personId: string | null,
): boolean {
  if (slot.hidden) return false;
  if (!personId || isHouseholdAudience(slot.audiencePersonIds)) return true;
  return normalizeAudiencePersonIds(slot.audiencePersonIds).includes(personId);
}

/**
 * Plan UI filter: `all` = household meals only; a person id = household + that person's meals.
 */
export function slotMatchesPlanPersonFilter(
  slot: { audiencePersonIds?: readonly string[] | null; hidden?: boolean },
  personFilter: 'all' | string,
): boolean {
  if (slot.hidden) return false;
  if (personFilter === 'all') return isHouseholdAudience(slot.audiencePersonIds);
  return slotMatchesPersonFilter(slot, personFilter);
}

/**
 * True when this audience conflicts with another non-hidden meal for the same day+slot.
 * Family and personal meals can share a day+slot; only overlapping people conflict.
 */
export function audienceOverlapsExisting(
  existing: readonly { id?: string; day: Day; slotKey: MealSlotKey; hidden?: boolean; audiencePersonIds?: readonly string[] | null }[],
  day: Day,
  slotKey: MealSlotKey,
  audiencePersonIds: readonly string[],
  excludeId?: string | null,
): boolean {
  const audience = normalizeAudiencePersonIds(audiencePersonIds);
  const household = audience.length === 0;
  const peers = existing.filter((slot) => {
    if (slot.hidden) return false;
    if (slot.day !== day || slot.slotKey !== slotKey) return false;
    if (excludeId && slot.id === excludeId) return false;
    return true;
  });
  if (household) {
    return peers.some((slot) => isHouseholdAudience(slot.audiencePersonIds));
  }
  const taken = new Set<string>();
  for (const slot of peers) {
    if (isHouseholdAudience(slot.audiencePersonIds)) continue;
    for (const id of normalizeAudiencePersonIds(slot.audiencePersonIds)) taken.add(id);
  }
  return audience.some((id) => taken.has(id));
}
