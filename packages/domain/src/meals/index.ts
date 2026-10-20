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
export type {
  CleanIngredient,
  CleanMethodBlock,
  CleanRecipe,
  CreateRecipeImportRequest,
  CreateRecipeImportResponse,
  GetRecipeImportResponse,
  RecipeAttribution,
  RecipeExtractionMeta,
  RecipeExtractionMethod,
  RecipeImportErrorCode,
  RecipeImportJob,
  RecipeImportJobStatus,
  RecipeImportPhase,
  RecipeImportUserError,
  RecipeQuantity,
  RecipeSourceKind,
} from './clean-recipe';
export {
  EXTRACTION_CONFIDENCE,
  RECIPE_IMPORT_ERROR_BODY,
  RECIPE_IMPORT_ERROR_TITLE,
  RECIPE_IMPORT_PROGRESS_MESSAGES,
  RECIPE_IMPORT_USER_ERROR_COPY,
  RECIPE_NOT_FOUND_MESSAGE,
  cleanIngredientsToRecipeIngredients,
  cleanRecipeToHouseholdDraft,
  formatScaledNumber,
  householdRecipeToClean,
  isCompleteCleanRecipe,
  methodBlocksToStrings,
  rotatingProgressMessage,
  scaledQuantityLabel,
  userErrorFromCode,
} from './clean-recipe';
export type { NormalizedRecipeUrl } from './recipe-url';
export { RecipeUrlError, classifyRecipeHost, normalizeRecipeUrl, youtubeVideoId } from './recipe-url';
export type { SharedRecipePayload } from './share-recipe-url';
export { extractRecipeUrlFromShare } from './share-recipe-url';
export {
  DAYS,
  DAY_LABELS,
  MEAL_SLOTS,
  audienceOverlapsExisting,
  isHouseholdAudience,
  mealSlotRecordKey,
  normalizeAudiencePersonIds,
  slotMatchesPersonFilter,
  slotMatchesPlanPersonFilter,
} from './types';
export {
  addableMealSlotKeys,
  dayIsRemovedFromPlan,
  hiddenMealSlotKeysForDay,
  householdHideSlotMap,
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
  fitsSlotBudget,
  generateMealPlan,
  nutritionFitScore,
  OPTIONAL_SLOTS,
  parseWeeklyFoodBudget,
  planBudgetCap,
  planShoppingCost,
  PROTEIN_KINDS,
  recipeProteinKind,
  recipeShoppingCost,
  recipesAffordableForBudget,
  recipeMatchesSlot,
  recipesForSlot,
  SLOT_ASSUMED,
  slotOccurrenceBudget,
  slotTarget,
  weeklyBudgetSplit,
} from './generate-plan';
export type { GenerateMealPlanOptions, GeneratedSlot, RecipeProteinKind } from './generate-plan';

export {
  defaultMealPrepDaysToCover,
  generateMealPrepPlan,
  mealPrepCookListCost,
  mealPrepCookSummary,
  mealPrepScore,
  recipesForMealPrep,
} from './meal-prep';
export type { MealPrepParams, MealPrepResult, MealPrepStyle } from './meal-prep';

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

export {
  combineAmounts,
  deduplicateIngredients,
  parseAmount,
  prefersMetricCountry,
  GARLIC_CLOVE_GRAMS,
} from './amounts';
export type { FlatIngredient, ParsedAmount, CombineAmountsOptions, DeduplicateOptions } from './amounts';

export { pickCanonicalShoppingName, shoppingMergeKey } from './ingredient-merge';

export {
  formatShoppingCountLabel,
  shoppingCountDefFor,
  COUNT_PREP_UNITS,
  COUNT_SIZE_UNITS,
} from './shopping-units';
export type { ShoppingCountDef } from './shopping-units';

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
export { findReplacingRecipe, hideReplacedCatalogRecipes, recipeForHouseholdView } from './recipe-versions';
export {
  estimateRecipeNutrition,
  nutritionCoverageLow,
  nutritionKey,
} from './recipe-nutrition';
export type { RecipeNutritionEstimate } from './recipe-nutrition';

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
