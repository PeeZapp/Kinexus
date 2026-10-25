import { deduplicateIngredients, prefersMetricCountry } from './amounts';
import { scaleRecipeToServings } from './scale-servings';
import { shoppingMergeKey, splitShoppingIngredientName } from './ingredient-merge';
import { linkedRecipeForIngredient } from './recipe-class';
import { recipeForHouseholdView } from './recipe-versions';
import {
  isHouseholdAudience,
  type DerivedShoppingItem,
  type Ingredient,
  type MealPlan,
  type MealSlot,
  type MealSlotKey,
  type Recipe,
  type RecipeClass,
  type ShoppingRecipeSource,
} from './types';

type CategoryDef = {
  label: string;
  emoji: string;
  keywords: string[];
};

export const SHOPPING_CATEGORIES: readonly CategoryDef[] = [
  { label: 'Bakery', emoji: '🍞', keywords: ['bakery', 'bread', 'baked', 'pastry', 'roll'] },
  {
    label: 'Dairy & Eggs',
    emoji: '🥛',
    keywords: ['dairy', 'egg', 'milk', 'cream', 'cheese', 'butter', 'yoghurt', 'yogurt'],
  },
  {
    label: 'Deli & Chilled',
    emoji: '🧆',
    keywords: ['deli', 'chilled', 'tofu', 'halloumi', 'chorizo', 'prosciutto', 'pancetta'],
  },
  {
    label: 'Drinks',
    emoji: '🧃',
    keywords: ['drink', 'beverage', 'juice', 'water', 'wine', 'beer', 'soda', 'cola', 'tea', 'coffee'],
  },
  {
    label: 'Fish & Seafood',
    emoji: '🐟',
    keywords: [
      'fish', 'seafood', 'salmon', 'cod', 'prawn', 'shrimp', 'tuna', 'anchovy', 'clam', 'lobster',
      'mussel', 'squid', 'sea bass', 'seabass',
    ],
  },
  { label: 'Frozen', emoji: '🧊', keywords: ['frozen'] },
  {
    label: 'Fruit',
    emoji: '🍎',
    keywords: [
      'fruit', 'apple', 'banana', 'lemon', 'lime', 'orange', 'mango', 'berry', 'berries', 'grape',
      'pear', 'peach', 'avocado', 'tomato',
    ],
  },
  {
    label: 'Grains & Pasta',
    emoji: '🍝',
    keywords: [
      'grain', 'pasta', 'rice', 'noodle', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'couscous',
      'quinoa', 'oat', 'flour', 'breadcrumb', 'bulgur',
    ],
  },
  {
    label: 'Herbs & Spices',
    emoji: '🌿',
    keywords: [
      'herb', 'spice', 'basil', 'parsley', 'cilantro', 'coriander', 'thyme', 'rosemary', 'oregano',
      'mint', 'cumin', 'paprika', 'turmeric', 'ginger', 'chilli', 'chili', 'pepper', 'salt', 'bay',
      'saffron', 'cardamom', 'cinnamon', 'clove', 'nutmeg', 'allspice', 'star anise', 'sumac',
      "za'atar", 'ras el hanout',
    ],
  },
  {
    label: 'Meat & Poultry',
    emoji: '🥩',
    keywords: [
      'meat', 'beef', 'pork', 'chicken', 'lamb', 'turkey', 'veal', 'mince', 'sausage', 'bacon',
      'poultry', 'steak', 'rib', 'brisket', 'pulled',
    ],
  },
  {
    label: 'Oils & Condiments',
    emoji: '🫙',
    keywords: [
      'oil', 'vinegar', 'sauce', 'condiment', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'soy',
      'fish sauce', 'oyster sauce', 'worcestershire', 'tahini', 'miso', 'paste',
      'harissa', 'sriracha', 'tabasco',
    ],
  },
  {
    label: 'Pantry',
    emoji: '🏪',
    keywords: [
      'pantry', 'stock', 'broth', 'bouillon', 'stock cube', 'stock powder', 'gelatine', 'gelatin',
      'baking powder', 'baking soda', 'bicarb', 'yeast', 'cornflour', 'cornstarch', 'sugar',
    ],
  },
  {
    label: 'Tins & Jars',
    emoji: '🥫',
    keywords: [
      'tin', 'can', 'jar', 'canned', 'tinned', 'bean', 'lentil', 'chickpea', 'tomato paste',
      'coconut milk', 'baked bean', 'kidney bean', 'black bean',
    ],
  },
  {
    label: 'Vegetables',
    emoji: '🥦',
    keywords: [
      'vegetable', 'veg', 'onion', 'garlic', 'carrot', 'celery', 'broccoli', 'spinach', 'mushroom',
      'courgette', 'zucchini', 'aubergine', 'eggplant', 'potato', 'sweet potato', 'capsicum', 'pepper',
      'leek', 'cabbage', 'cauliflower', 'kale', 'asparagus', 'pea', 'corn', 'sweetcorn', 'artichoke',
      'fennel', 'beetroot', 'beet', 'radish', 'cucumber', 'lettuce', 'rocket', 'arugula',
      'spring onion', 'scallion', 'shallot', 'bok choy', 'pak choi',
    ],
  },
  { label: 'Other', emoji: '🛒', keywords: [] },
];

const STOCK_BROTH_RE = /\b(stocks?|broths?|bouillon)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-phrase / whole-word match so "roll" does not hit "rolled oats". */
function matchesKeyword(hay: string, kw: string): boolean {
  const escaped = escapeRegExp(kw.toLowerCase());
  if (kw.includes(' ')) {
    return hay.includes(kw.toLowerCase());
  }
  return new RegExp(`(?:^|[^a-z])${escaped}(?:s)?(?:[^a-z]|$)`).test(hay);
}

/**
 * Resolve an aisle label. Ingredient name overrides AI category for stock/broth → Pantry
 * so "beef stock" does not land in Meat.
 */
export function resolveShoppingCategory(raw: string | undefined, name?: string): string {
  const nameLower = (name ?? '').toLowerCase().trim();
  const lower = (raw ?? '').toLowerCase().trim();

  if (STOCK_BROTH_RE.test(nameLower) || STOCK_BROTH_RE.test(lower)) {
    return 'Pantry';
  }

  // "clove" is a spice keyword; do not file garlic under Herbs & Spices
  if (/\bgarlic\b/.test(nameLower)) {
    return 'Vegetables';
  }

  if (!raw && !name) return 'Other';

  const direct = SHOPPING_CATEGORIES.find((c) => c.label.toLowerCase() === lower);
  if (direct) return direct.label;

  // Prefer matching against the ingredient name when present (more specific than AI bucket)
  const haystacks = nameLower ? [nameLower, lower] : [lower];
  for (const hay of haystacks) {
    if (!hay) continue;
    for (const def of SHOPPING_CATEGORIES) {
      if (def.label === 'Other') continue;
      if (def.keywords.some((kw) => matchesKeyword(hay, kw))) return def.label;
    }
  }
  return 'Other';
}

export function shoppingCategoryEmoji(label: string): string {
  return SHOPPING_CATEGORIES.find((c) => c.label === label)?.emoji ?? '🛒';
}

export function groupShoppingByCategory(
  items: readonly DerivedShoppingItem[],
): { category: string; emoji: string; items: DerivedShoppingItem[] }[] {
  const map = new Map<string, DerivedShoppingItem[]>();
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  for (const item of sorted) {
    const cat = resolveShoppingCategory(item.category, item.name);
    const group = map.get(cat);
    if (group) group.push(item);
    else map.set(cat, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    })
    .map(([category, groupItems]) => ({
      category,
      emoji: shoppingCategoryEmoji(category),
      items: groupItems,
    }));
}

export type ShoppingFromPlanInput = {
  plan: Pick<MealPlan, 'activeSlots' | 'slots'>;
  recipes: readonly Recipe[];
  /** Household country for unit preference (default AU / metric). */
  country?: string | null;
  /**
   * Classed recipes to cook from scratch this week.
   * Omitted ids stay as the finished ingredient (buy the jar).
   */
  makeRecipeIds?: readonly string[];
};

type RawShopLine = {
  name: string;
  amount?: string;
  category?: string;
  recipeId: string;
  recipeName: string;
  linkedRecipeId?: string;
  linkedRecipeName?: string;
  linkedRecipeClass?: RecipeClass;
  madeFromRecipeId?: string;
  madeFromRecipeName?: string;
};

/**
 * Household meals shop only for slot types on this week's plan.
 * A personal or group meal still shops when that type is off the family plan,
 * because those meals stay on the week for the people they are for.
 */
function slotFeedsShopping(slot: MealSlot, activeSlotSet: ReadonlySet<MealSlotKey>): boolean {
  if (slot.hidden) return false;
  if (!isHouseholdAudience(slot.audiencePersonIds)) return true;
  return activeSlotSet.has(slot.slotKey);
}

/**
 * Build a shopping list from an active meal plan: merge amounts for the same
 * ingredient (including prep/unit variants), attach recipe sources, and resolve aisle categories.
 * A linked sauce (or other class) stays as one finished item unless that recipe id is in `makeRecipeIds`,
 * in which case one full batch of its ingredients replaces the finished line.
 * Personal meals are included even when their slot type is not on the family plan.
 */
export function shoppingFromPlan(input: ShoppingFromPlanInput): DerivedShoppingItem[] {
  const { plan, recipes } = input;
  const preferMetric = prefersMetricCountry(input.country);
  const activeSlotSet = new Set<MealSlotKey>(plan.activeSlots ?? ['breakfast', 'lunch', 'dinner']);
  const makeSet = new Set(input.makeRecipeIds ?? []);
  const expanded = new Set<string>();
  const extraSources = new Map<string, ShoppingRecipeSource[]>();
  const raw: RawShopLine[] = [];

  function rememberSource(madeFromId: string, source: ShoppingRecipeSource) {
    const list = extraSources.get(madeFromId) ?? [];
    if (!list.some((item) => item.recipeId === source.recipeId)) list.push(source);
    extraSources.set(madeFromId, list);
  }

  function pushIngredient(
    ing: Ingredient,
    source: ShoppingRecipeSource,
    ownerId: string,
    madeFrom?: ShoppingRecipeSource,
  ) {
    const names = splitShoppingIngredientName(ing.name);
    if (names.length > 1) {
      for (const name of names) pushIngredient({ ...ing, name }, source, ownerId, madeFrom);
      return;
    }
    const linked = linkedRecipeForIngredient(ing.name, recipes, {
      explicitId: ing.baseRecipeId,
      excludeIds: [ownerId],
    });
    if (linked && makeSet.has(linked.id)) {
      expandLinked(linked, source);
      return;
    }
    raw.push({
      name: ing.name,
      amount: ing.amount,
      category: ing.category,
      recipeId: source.recipeId,
      recipeName: source.recipeName,
      ...(linked?.recipeClass
        ? {
            linkedRecipeId: linked.id,
            linkedRecipeName: linked.name,
            linkedRecipeClass: linked.recipeClass,
          }
        : {}),
      ...(madeFrom ? { madeFromRecipeId: madeFrom.recipeId, madeFromRecipeName: madeFrom.recipeName } : {}),
    });
  }

  function expandLinked(linked: Recipe, source: ShoppingRecipeSource) {
    if (expanded.has(linked.id)) {
      rememberSource(linked.id, source);
      return;
    }
    expanded.add(linked.id);
    const madeFrom = { recipeId: linked.id, recipeName: linked.name };
    for (const ing of linked.ingredients ?? []) {
      pushIngredient(ing, source, linked.id, madeFrom);
    }
  }

  function addCookedRecipe(recipe: Recipe, targetServings?: number) {
    const cooked = scaleRecipeToServings(recipe, targetServings);
    const source = { recipeId: cooked.id, recipeName: cooked.name };
    for (const ing of cooked.ingredients ?? []) pushIngredient(ing, source, cooked.id);
  }

  for (const slot of plan.slots) {
    if (!slotFeedsShopping(slot, activeSlotSet)) continue;
    if (slot.recipeId) {
      const recipe = recipeForHouseholdView(recipes, slot.recipeId);
      if (recipe) addCookedRecipe(recipe, slot.targetServings);
    }
    for (const sideId of slot.sideRecipeIds ?? []) {
      const side = recipeForHouseholdView(recipes, sideId);
      if (side) addCookedRecipe(side, slot.targetServings);
    }
  }

  const deduped = deduplicateIngredients(
    raw.map(({ name, amount, category }) => ({ name, amount, category })),
    { preferMetric, country: input.country },
  );

  const linkedByKey = new Map<string, Pick<RawShopLine, 'linkedRecipeId' | 'linkedRecipeName' | 'linkedRecipeClass'>>();
  const madeFromByKey = new Map<string, Pick<RawShopLine, 'madeFromRecipeId' | 'madeFromRecipeName'>>();
  const sourcesByKey = new Map<string, ShoppingRecipeSource[]>();
  const mealCountByKey = new Map<string, number>();
  const categoryByKey = new Map<string, string>();

  for (const row of raw) {
    const key = shoppingMergeKey(row.name) || row.name.toLowerCase().trim();
    mealCountByKey.set(key, (mealCountByKey.get(key) ?? 0) + 1);
    if (row.linkedRecipeId && !linkedByKey.has(key)) {
      linkedByKey.set(key, {
        linkedRecipeId: row.linkedRecipeId,
        linkedRecipeName: row.linkedRecipeName,
        linkedRecipeClass: row.linkedRecipeClass,
      });
    }
    if (row.madeFromRecipeId && !madeFromByKey.has(key)) {
      madeFromByKey.set(key, {
        madeFromRecipeId: row.madeFromRecipeId,
        madeFromRecipeName: row.madeFromRecipeName,
      });
    }
    if (row.category && !categoryByKey.has(key)) categoryByKey.set(key, row.category);
    const sources = sourcesByKey.get(key) ?? [];
    if (!sources.some((s) => s.recipeId === row.recipeId)) {
      sources.push({ recipeId: row.recipeId, recipeName: row.recipeName });
    }
    if (row.madeFromRecipeId) {
      for (const extra of extraSources.get(row.madeFromRecipeId) ?? []) {
        if (!sources.some((s) => s.recipeId === extra.recipeId)) sources.push(extra);
      }
    }
    sourcesByKey.set(key, sources);
  }

  return deduped.map((ing) => {
    const key = shoppingMergeKey(ing.name) || ing.name.toLowerCase().trim();
    const linked = linkedByKey.get(key);
    const madeFrom = madeFromByKey.get(key);
    const rawCategory = ing.category || categoryByKey.get(key) || 'other';
    return {
      name: ing.name,
      amount: ing.amount,
      category: resolveShoppingCategory(rawCategory, ing.name),
      recipeSources: sourcesByKey.get(key) ?? [],
      sharedMealCount: mealCountByKey.get(key) ?? 0,
      ...(ing.mergedFrom?.length ? { mergedFrom: ing.mergedFrom } : {}),
      ...(linked?.linkedRecipeId
        ? {
            isBaseRecipe: true,
            baseRecipeId: linked.linkedRecipeId,
            baseRecipeName: linked.linkedRecipeName,
            linkedRecipeId: linked.linkedRecipeId,
            linkedRecipeName: linked.linkedRecipeName,
            linkedRecipeClass: linked.linkedRecipeClass,
          }
        : {}),
      ...(madeFrom?.madeFromRecipeId
        ? { madeFromRecipeId: madeFrom.madeFromRecipeId, madeFromRecipeName: madeFrom.madeFromRecipeName }
        : {}),
    };
  });
}
