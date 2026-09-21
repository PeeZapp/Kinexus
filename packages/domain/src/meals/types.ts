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
};

export type PersonDietary = {
  dietary?: string[];
};

export function mealSlotRecordKey(day: Day, slot: MealSlotKey): string {
  return `${day}_${slot}`;
}
