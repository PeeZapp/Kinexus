import { deduplicateIngredients } from './amounts';
import type {
  DerivedShoppingItem,
  MealPlan,
  MealSlotKey,
  Recipe,
  ShoppingRecipeSource,
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
      'fish sauce', 'oyster sauce', 'worcestershire', 'tahini', 'miso', 'paste', 'stock', 'broth',
      'harissa', 'sriracha', 'tabasco',
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

export function resolveShoppingCategory(raw: string | undefined): string {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase().trim();
  const direct = SHOPPING_CATEGORIES.find((c) => c.label.toLowerCase() === lower);
  if (direct) return direct.label;
  for (const def of SHOPPING_CATEGORIES) {
    if (def.keywords.some((kw) => lower.includes(kw))) return def.label;
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
    const cat = resolveShoppingCategory(item.category);
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
};

/**
 * Build a shopping list from an active meal plan: merge amounts for the same
 * ingredient name, attach recipe sources, and resolve aisle categories.
 */
export function shoppingFromPlan(input: ShoppingFromPlanInput): DerivedShoppingItem[] {
  const { plan, recipes } = input;
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const baseRecipeMap = new Map(recipes.filter((r) => r.isComponent).map((r) => [r.id, r]));
  const activeSlotSet = new Set<MealSlotKey>(plan.activeSlots ?? ['breakfast', 'lunch', 'dinner']);

  const raw: {
    name: string;
    amount?: string;
    category?: string;
    baseRecipeId?: string;
    recipeId: string;
    recipeName: string;
  }[] = [];

  for (const slot of plan.slots) {
    if (!activeSlotSet.has(slot.slotKey)) continue;
    if (!slot.recipeId) continue;
    const recipe = recipeById.get(slot.recipeId);
    if (!recipe?.ingredients) continue;
    for (const ing of recipe.ingredients) {
      raw.push({
        name: ing.name,
        amount: ing.amount,
        category: ing.category,
        baseRecipeId: ing.baseRecipeId,
        recipeId: recipe.id,
        recipeName: recipe.name,
      });
    }
  }

  const deduped = deduplicateIngredients(raw.map(({ name, amount, category }) => ({ name, amount, category })));

  const baseIdByName = new Map<string, string>();
  const sourcesByName = new Map<string, ShoppingRecipeSource[]>();
  const mealCountByName = new Map<string, number>();
  for (const row of raw) {
    const key = row.name.toLowerCase().trim();
    mealCountByName.set(key, (mealCountByName.get(key) ?? 0) + 1);
    if (row.baseRecipeId && !baseIdByName.has(key)) baseIdByName.set(key, row.baseRecipeId);
    const sources = sourcesByName.get(key) ?? [];
    if (!sources.some((s) => s.recipeId === row.recipeId)) {
      sources.push({ recipeId: row.recipeId, recipeName: row.recipeName });
    }
    sourcesByName.set(key, sources);
  }

  return deduped.map((ing) => {
    const key = ing.name.toLowerCase().trim();
    const brId = baseIdByName.get(key);
    const br = brId ? baseRecipeMap.get(brId) : undefined;
    return {
      name: ing.name,
      amount: ing.amount,
      category: resolveShoppingCategory(ing.category || 'other'),
      recipeSources: sourcesByName.get(key) ?? [],
      sharedMealCount: mealCountByName.get(key) ?? 0,
      ...(br ? { isBaseRecipe: true, baseRecipeId: br.id, baseRecipeName: br.name } : {}),
    };
  });
}
