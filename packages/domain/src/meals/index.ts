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
  RecipeCostEstimate,
  RecipeCostLine,
  ShoppingRecipeSource,
} from './types';
export { DAYS, DAY_LABELS, MEAL_SLOTS, mealSlotRecordKey } from './types';
export {
  addableMealSlotKeys,
  dayIsRemovedFromPlan,
  hiddenMealSlotKeysForDay,
  orderedMealSlotKeys,
  otherDaysToHideForNewSlot,
  plannedDays,
  shouldDropSlotFromActive,
  visibleMealSlotKeys,
} from './plan-slots';
export { addDaysIso, mondayWeekStart } from './week';

export {
  ALL_MEAL_SLOTS,
  CORE_SLOTS,
  generateMealPlan,
  nutritionFitScore,
  OPTIONAL_SLOTS,
  PROTEIN_KINDS,
  recipeProteinKind,
  recipesForSlot,
  SLOT_ASSUMED,
  slotTarget,
} from './generate-plan';
export type { GenerateMealPlanOptions, GeneratedSlot, RecipeProteinKind } from './generate-plan';

export {
  filterRecipesForSwap,
  NUTRITION_SWAP_BAND,
  nutritionWithinBand,
  pickRandomSwapRecipe,
  proteinKindsInRecipes,
  rememberSwapId,
  sortRecipesByNutrition,
} from './swap-recipe';
export type { NutritionReference, SwapRecipeFilters } from './swap-recipe';

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

export { recipePrintHtml } from './print-recipe';

export {
  DEFAULT_MARKET,
  GROCERY_MARKETS,
  marketForCountry,
  marketForHousehold,
  normalizeCountryCode,
  normalizeCurrencyCode,
  storeListLabel,
} from './markets';
export type { GroceryMarket } from './markets';

export {
  asFiniteMoney,
  costMonthStartUtc,
  costPerServeFromTotal,
  formatCostPerServe,
  formatCostSource,
  formatDishCost,
  isCostCurrent,
  normalizeCostLines,
  normalizeRecipeCost,
  recentlyAttempted,
} from './cost';

export {
  INGREDIENT_CATALOG,
  attachRecipeCost,
  catalogPricesFromAi,
  estimateIngredientCostUSD,
  estimateRecipeCost,
  estimateRecipeCostForMarket,
  getCurrencyConfig,
  localFromUsd,
  parsePriceOverrideMap,
} from './recipe-costing';
export type {
  CatalogIngredient,
  IngredientPriceBook,
  PriceOverrideEntry,
  PriceOverrideMap,
  PriceOverrides,
  RecipeCost,
} from './recipe-costing';

export {
  approvedRecipeIds,
  approvedRecipeIdsForLibraryFilter,
  personHasApprovedList,
  recipesForPicker,
} from './slot-picks';
export type { PersonSlotApproval } from './slot-picks';
