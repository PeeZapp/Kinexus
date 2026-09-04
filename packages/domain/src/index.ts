/**
 * Pure TypeScript domain package (no React / React Native).
 */

export type {
  CreatedInvite,
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdPerson,
  HouseholdRole,
  PeekedInvite,
  PersonType,
  Profile,
} from './household/types';

export * as meals from './meals/index';

export {
  ALL_MEAL_SLOTS,
  combineAmounts,
  CORE_SLOTS,
  DAYS,
  DAY_LABELS,
  deduplicateIngredients,
  dietaryRestrictionsFromPeople,
  DIETARY_OPTIONS,
  filterRecipesByDietary,
  filterRecipesForPeople,
  generateMealPlan,
  getDietaryOption,
  groupShoppingByCategory,
  hasConflict,
  MEAL_SLOTS,
  mealSlotRecordKey,
  mondayWeekStart,
  addDaysIso,
  nutritionFitScore,
  OPTIONAL_SLOTS,
  parseAmount,
  recipesForSlot,
  resolveShoppingCategory,
  shoppingCategoryEmoji,
  shoppingFromPlan,
  SHOPPING_CATEGORIES,
  SLOT_ASSUMED,
  slotTarget,
} from './meals/index';

export type {
  Day,
  DerivedShoppingItem,
  DietaryOption,
  FlatIngredient,
  GenerateMealPlanOptions,
  GeneratedSlot,
  Ingredient,
  MealPlan,
  MealSlot,
  MealSlotKey,
  NutritionGoalPreset,
  NutritionGoals,
  ParsedAmount,
  PersonDietary,
  Recipe,
  ShoppingFromPlanInput,
  ShoppingRecipeSource,
} from './meals/index';
