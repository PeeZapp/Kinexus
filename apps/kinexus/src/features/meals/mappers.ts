import type { Database, Json } from '@kinexus/db';
import type { Day, Ingredient, MealSlot, MealSlotKey, NutritionGoals, Recipe, StoredGroceryQuote } from '@kinexus/domain';
import { DAYS, MEAL_SLOTS, isRecipeClass, parsePriceOverrideMap, type IngredientPriceBook } from '@kinexus/domain';

type RecipeRow = Database['public']['Tables']['recipes']['Row'];
type SlotRow = Database['public']['Tables']['meal_slots']['Row'];
type GoalsRow = Database['public']['Tables']['nutrition_goals']['Row'];

const SLOT_KEYS = new Set<string>(MEAL_SLOTS.map((s) => s.key));
const DAY_KEYS = new Set<string>(DAYS);

function asStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function mapIngredients(value: Json): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : '';
    if (!name) return [];
    return [
      {
        name,
        amount: typeof rec.amount === 'string' ? rec.amount : undefined,
        category: typeof rec.category === 'string' ? rec.category : undefined,
        baseRecipeId: typeof rec.baseRecipeId === 'string' ? rec.baseRecipeId : undefined,
      },
    ];
  });
}

export function recipeFromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    householdId: row.household_id,
    emoji: row.emoji ?? undefined,
    cuisine: row.cuisine ?? undefined,
    cookTime: asNum(row.cook_time),
    servings: asNum(row.servings),
    protein: asNum(row.protein),
    calories: asNum(row.calories),
    carbs: asNum(row.carbs),
    fat: asNum(row.fat),
    vegetarian: row.vegetarian ?? undefined,
    ingredients: mapIngredients(row.ingredients),
    method: asStringArray(row.method),
    chefTip: row.chef_tip ?? undefined,
    notes: row.notes ?? undefined,
    mealSlots: row.meal_slots.filter((s): s is MealSlotKey => SLOT_KEYS.has(s)),
    recipeClass: isRecipeClass(row.recipe_class) ? row.recipe_class : undefined,
    isComponent: row.is_component,
    excludedFromAuto: row.excluded_from_auto,
    sourceUrl: row.source_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageFlagged: Boolean(row.image_flagged),
    removed: Boolean(row.removed),
    isCommunity: row.is_public && row.household_id === null,
    sourcedFromRecipeId: row.sourced_from_recipe_id ?? undefined,
    replacesSource: Boolean(row.replaces_source),
    createdBy: row.created_by ?? undefined,
    creatorPublishedAt: row.creator_published_at ?? undefined,
    creatorSourceRecipeId: row.creator_source_recipe_id ?? undefined,
  };
}

export function priceBookFromRow(row: {
  prices: Json;
  priced_at: string;
}): IngredientPriceBook {
  return {
    prices: parsePriceOverrideMap(row.prices),
    pricedAt: row.priced_at,
  };
}

export function goalsFromRow(row: GoalsRow): NutritionGoals {
  return {
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

export function slotFromRow(row: SlotRow): MealSlot & { id: string; updatedAt: string } {
  const day = DAY_KEYS.has(row.day) ? (row.day as Day) : 'monday';
  const slotKey = SLOT_KEYS.has(row.slot_key) ? (row.slot_key as MealSlotKey) : 'breakfast';
  return {
    id: row.id,
    day,
    slotKey,
    recipeId: row.recipe_id ?? undefined,
    recipeName: row.recipe_name ?? undefined,
    emoji: row.emoji ?? undefined,
    protein: asNum(row.protein),
    calories: asNum(row.calories),
    carbs: asNum(row.carbs),
    fat: asNum(row.fat),
    cookTime: asNum(row.cook_time),
    hidden: row.hidden,
    assignedPersonId: row.assigned_person_id ?? undefined,
    audiencePersonIds: row.audience_person_ids ?? [],
    sideRecipeIds: row.side_recipe_ids ?? [],
    targetServings: asNum(row.target_servings),
    updatedAt: row.client_updated_at,
  };
}

export function denormFromRecipe(recipe: Recipe | null) {
  return {
    recipe_id: recipe?.id ?? null,
    recipe_name: recipe?.name ?? null,
    emoji: recipe?.emoji ?? null,
    protein: recipe?.protein ?? null,
    calories: recipe?.calories ?? null,
    carbs: recipe?.carbs ?? null,
    fat: recipe?.fat ?? null,
    cook_time: recipe?.cookTime ?? null,
  };
}

export type ShoppingListItem = {
  id: string;
  name: string;
  amount: string | null;
  category: string;
  checked: boolean;
  recipeSources: { recipeId: string; recipeName: string }[];
  sharedMealCount: number;
  mergedFrom: string[];
  /** True when the household added this row by hand (survives regenerate). */
  manual: boolean;
  linkedRecipeId: string | null;
  linkedRecipeName: string | null;
  madeFromRecipeId: string | null;
  madeFromRecipeName: string | null;
  groceryQuote: StoredGroceryQuote | null;
};

type ShoppingRow = Database['public']['Tables']['shopping_items']['Row'];

export function shoppingFromRow(row: ShoppingRow): ShoppingListItem {
  const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, Json | undefined>)
    : {};
  const sourcesRaw = meta.recipeSources;
  const recipeSources = Array.isArray(sourcesRaw)
    ? sourcesRaw.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const rec = item as Record<string, unknown>;
        const recipeId = typeof rec.recipeId === 'string' ? rec.recipeId : '';
        const recipeName = typeof rec.recipeName === 'string' ? rec.recipeName : '';
        return recipeId ? [{ recipeId, recipeName }] : [];
      })
    : [];
  const shared = asNum(meta.sharedMealCount);
  const mergedRaw = meta.mergedFrom;
  const mergedFrom = Array.isArray(mergedRaw)
    ? mergedRaw.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: row.category ?? 'Other',
    checked: row.checked,
    recipeSources,
    sharedMealCount: shared ?? 1,
    mergedFrom,
    manual: meta.manual === true,
    linkedRecipeId: typeof meta.linkedRecipeId === 'string' ? meta.linkedRecipeId : null,
    linkedRecipeName: typeof meta.linkedRecipeName === 'string' ? meta.linkedRecipeName : null,
    madeFromRecipeId: typeof meta.madeFromRecipeId === 'string' ? meta.madeFromRecipeId : null,
    madeFromRecipeName: typeof meta.madeFromRecipeName === 'string' ? meta.madeFromRecipeName : null,
    groceryQuote: groceryQuoteFromJson(row.grocery_quote ?? null),
  };
}

function groceryQuoteFromJson(value: Json | null): StoredGroceryQuote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, Json | undefined>;
  if (typeof rec.name !== 'string' || !Array.isArray(rec.quotes)) return null;
  if (rec.amount != null && typeof rec.amount !== 'string') return null;
  const quotes: StoredGroceryQuote['quotes'] = [];
  for (const row of rec.quotes) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const quote = row as Record<string, Json | undefined>;
    if (typeof quote.chainId !== 'string' || typeof quote.chainName !== 'string' || typeof quote.productName !== 'string') return null;
    if (typeof quote.price !== 'number' || typeof quote.packs !== 'number') return null;
    quotes.push({
      chainId: quote.chainId,
      chainName: quote.chainName,
      storeId: typeof quote.storeId === 'string' ? quote.storeId : quote.chainId,
      storeName: typeof quote.storeName === 'string' ? quote.storeName : quote.chainName,
      productId: typeof quote.productId === 'string' ? quote.productId : quote.productName,
      productName: quote.productName,
      price: quote.price,
      packs: quote.packs,
    });
  }
  const pins: { chainId: string; productId: string }[] = [];
  if (Array.isArray(rec.pins)) {
    for (const pin of rec.pins) {
      if (!pin || typeof pin !== 'object' || Array.isArray(pin)) continue;
      const row = pin as Record<string, Json | undefined>;
      if (typeof row.chainId !== 'string' || typeof row.productId !== 'string') continue;
      pins.push({ chainId: row.chainId, productId: row.productId });
    }
  }
  return {
    name: rec.name,
    amount: typeof rec.amount === 'string' ? rec.amount : null,
    quotes,
    pins: pins.length > 0 ? pins : undefined,
  };
}

export function recipeToInsert(householdId: string, recipe: Omit<Recipe, 'id' | 'householdId'>): Database['public']['Tables']['recipes']['Insert'] {
  return {
    household_id: householdId,
    name: recipe.name,
    emoji: recipe.emoji ?? null,
    cuisine: recipe.cuisine ?? null,
    cook_time: recipe.cookTime ?? null,
    servings: recipe.servings ?? null,
    protein: recipe.protein ?? null,
    calories: recipe.calories ?? null,
    carbs: recipe.carbs ?? null,
    fat: recipe.fat ?? null,
    vegetarian: recipe.vegetarian ?? null,
    ingredients: (recipe.ingredients ?? []) as unknown as Json,
    method: (recipe.method ?? []) as unknown as Json,
    chef_tip: recipe.chefTip ?? null,
    notes: recipe.notes ?? null,
    meal_slots: recipe.mealSlots ?? (recipe.recipeClass ? [] : ['dinner']),
    is_component: recipe.recipeClass ? (recipe.mealSlots ?? []).length === 0 : Boolean(recipe.isComponent),
    recipe_class: recipe.recipeClass ?? null,
    excluded_from_auto: Boolean(recipe.excludedFromAuto),
    is_public: false,
    source_url: recipe.sourceUrl ?? null,
    image_url: recipe.imageUrl ?? null,
    sourced_from_recipe_id: recipe.sourcedFromRecipeId ?? null,
    replaces_source: Boolean(recipe.replacesSource),
  };
}

export function recipeToUpdate(recipe: Omit<Recipe, 'id' | 'householdId'>): Database['public']['Tables']['recipes']['Update'] {
  return {
    name: recipe.name,
    emoji: recipe.emoji ?? null,
    cuisine: recipe.cuisine ?? null,
    cook_time: recipe.cookTime ?? null,
    servings: recipe.servings ?? null,
    protein: recipe.protein ?? null,
    calories: recipe.calories ?? null,
    carbs: recipe.carbs ?? null,
    fat: recipe.fat ?? null,
    vegetarian: recipe.vegetarian ?? null,
    ingredients: (recipe.ingredients ?? []) as unknown as Json,
    method: (recipe.method ?? []) as unknown as Json,
    chef_tip: recipe.chefTip ?? null,
    notes: recipe.notes ?? null,
    meal_slots: recipe.mealSlots ?? (recipe.recipeClass ? [] : ['dinner']),
    is_component: recipe.recipeClass ? (recipe.mealSlots ?? []).length === 0 : Boolean(recipe.isComponent),
    recipe_class: recipe.recipeClass ?? null,
    excluded_from_auto: Boolean(recipe.excludedFromAuto),
    source_url: recipe.sourceUrl ?? null,
    image_url: recipe.imageUrl ?? null,
  };
}
