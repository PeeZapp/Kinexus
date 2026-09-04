export type {
  Day,
  DerivedShoppingItem,
  Ingredient,
  MealPlan,
  MealSlot,
  MealSlotKey,
  NutritionGoalPreset,
  NutritionGoals,
  PersonDietary,
  Recipe,
  ShoppingRecipeSource,
} from './types';
export { DAYS, DAY_LABELS, MEAL_SLOTS, mealSlotRecordKey } from './types';
export { addDaysIso, mondayWeekStart } from './week';

export {
  ALL_MEAL_SLOTS,
  CORE_SLOTS,
  generateMealPlan,
  nutritionFitScore,
  OPTIONAL_SLOTS,
  recipesForSlot,
  SLOT_ASSUMED,
  slotTarget,
} from './generate-plan';
export type { GenerateMealPlanOptions, GeneratedSlot } from './generate-plan';

export { combineAmounts, deduplicateIngredients, parseAmount } from './amounts';
export type { FlatIngredient, ParsedAmount } from './amounts';

export {
  groupShoppingByCategory,
  resolveShoppingCategory,
  shoppingCategoryEmoji,
  shoppingFromPlan,
  SHOPPING_CATEGORIES,
} from './shopping-from-plan';
export type { ShoppingFromPlanInput } from './shopping-from-plan';

export {
  dietaryRestrictionsFromPeople,
  DIETARY_OPTIONS,
  filterRecipesByDietary,
  filterRecipesForPeople,
  getDietaryOption,
  hasConflict,
} from './dietary';
export type { DietaryOption } from './dietary';
