import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import { getMealPlan, getPantry, getPicks, getRecipe, getShoppingList, searchRecipes } from './reads.js';
import { resolveCallerHousehold, withMcpAudit } from './shared.js';
import {
  previewAddMeal,
  previewAddToShoppingList,
  previewCreateRecipe,
  previewDeleteRecipe,
  previewImportRecipeFromUrl,
  previewMoveMeal,
  previewPlanMeals,
  previewRemoveMeal,
  previewUpdateRecipe,
  type PreviewResult,
} from './writes.js';

const ingredientSchema = z.object({
  name: z.string(),
  amount: z.string().optional(),
});

const planSlotSchema = z.object({
  date: z.string(),
  slotKey: z.string(),
  overwrite: z.boolean().optional(),
});

const nutritionSchema = z.union([
  z.object({
    source: z.enum(['stored', 'estimate']),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    servings: z.number().optional(),
  }),
  z.object({
    source: z.literal('missing'),
    message: z.string(),
  }),
]);

const recipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  householdId: z.string().nullable(),
  cuisine: z.string().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  mealSlots: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  method: z.array(z.string()),
  sourceUrl: z.string().optional(),
  nutrition: nutritionSchema,
  visibility: z.enum(['household', 'catalog']),
});

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        visibility: z.string(),
        keyIngredients: z.array(z.string()),
      }),
    )
    .optional(),
  message: z.string().optional(),
  recipeId: z.string().optional(),
  existing: z
    .object({
      recipeId: z.string().optional(),
      recipeName: z.string().optional(),
    })
    .optional(),
});

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

const openWorldWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
} as const;

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

function asPreviewResult(value: PreviewResult): z.infer<typeof previewResultSchema> {
  return value;
}

const searchRecipesInput = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});
const searchRecipesOutput = z.object({
  householdId: z.string(),
  recipes: z.array(recipeSchema),
});

export const searchRecipesTool: McpToolDefinition<typeof searchRecipesInput, typeof searchRecipesOutput> = {
  name: 'search_recipes',
  title: 'Search recipes',
  description: 'Search household and catalog recipes by name, cuisine, or ingredient.',
  inputSchema: searchRecipesInput,
  outputSchema: searchRecipesOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withMcpAudit(caller, { tool: 'search_recipes', mode: 'read' }, async () => {
      const result = await searchRecipes(caller.client, caller.userId, args);
      return result;
    }),
};

const getRecipeInput = z.object({ recipeId: z.string() });
const getRecipeOutput = z.object({
  householdId: z.string(),
  recipe: recipeSchema,
});

export const getRecipeTool: McpToolDefinition<typeof getRecipeInput, typeof getRecipeOutput> = {
  name: 'get_recipe',
  title: 'Get recipe',
  description:
    'Get one recipe by id, including stored nutrition or a labelled estimate. Never invents nutrition.',
  inputSchema: getRecipeInput,
  outputSchema: getRecipeOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withMcpAudit(caller, { tool: 'get_recipe', mode: 'read' }, () =>
      getRecipe(caller.client, caller.userId, args.recipeId),
    ),
};

const getMealPlanInput = z.object({
  fromDate: z.string(),
  toDate: z.string(),
});
const getMealPlanOutput = z.object({
  householdId: z.string(),
  slots: z.array(
    z.object({
      date: z.string(),
      day: z.string(),
      slotKey: z.string(),
      slotId: z.string().optional(),
      recipeId: z.string().optional(),
      recipeName: z.string().optional(),
      hidden: z.boolean(),
      filled: z.boolean(),
    }),
  ),
});

export const getMealPlanTool: McpToolDefinition<typeof getMealPlanInput, typeof getMealPlanOutput> = {
  name: 'get_meal_plan',
  title: 'Get meal plan',
  description: 'Read meal plan slots for a date range (YYYY-MM-DD).',
  inputSchema: getMealPlanInput,
  outputSchema: getMealPlanOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withMcpAudit(caller, { tool: 'get_meal_plan', mode: 'read' }, () =>
      getMealPlan(caller.client, caller.userId, args),
    ),
};

const getShoppingListInput = z.object({
  weekStart: z.string().optional(),
});
const getShoppingListOutput = z.object({
  householdId: z.string(),
  weekStart: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      amount: z.string().nullable(),
      category: z.string().nullable(),
      checked: z.boolean(),
    }),
  ),
});

export const getShoppingListTool: McpToolDefinition<typeof getShoppingListInput, typeof getShoppingListOutput> = {
  name: 'get_shopping_list',
  title: 'Get shopping list',
  description: 'Read the household shopping list for a week (Monday YYYY-MM-DD).',
  inputSchema: getShoppingListInput,
  outputSchema: getShoppingListOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withMcpAudit(caller, { tool: 'get_shopping_list', mode: 'read' }, () =>
      getShoppingList(caller.client, caller.userId, args),
    ),
};

const getPantryInput = z.object({});
const getPantryOutput = z.object({
  available: z.literal(false),
  message: z.string(),
});

export const getPantryTool: McpToolDefinition<typeof getPantryInput, typeof getPantryOutput> = {
  name: 'get_pantry',
  title: 'Get pantry',
  description: 'Pantry is device-local; reports that it is unavailable via connectors.',
  inputSchema: getPantryInput,
  outputSchema: getPantryOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withMcpAudit(caller, { tool: 'get_pantry', mode: 'read' }, () => getPantry()),
};

const getPicksInput = z.object({
  personId: z.string().optional(),
  slotKey: z.string().optional(),
});
const getPicksOutput = z.object({
  householdId: z.string(),
  picks: z.array(
    z.object({
      personId: z.string(),
      slotKey: z.string(),
      recipeId: z.string(),
    }),
  ),
});

export const getPicksTool: McpToolDefinition<typeof getPicksInput, typeof getPicksOutput> = {
  name: 'get_picks',
  title: 'Get picks',
  description: 'Read approved person/slot recipe picks for the household.',
  inputSchema: getPicksInput,
  outputSchema: getPicksOutput,
  scope: 'meals:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withMcpAudit(caller, { tool: 'get_picks', mode: 'read' }, () =>
      getPicks(caller.client, caller.userId, args),
    ),
};

const createRecipeInput = z.object({
  name: z.string(),
  ingredients: z.array(ingredientSchema).optional(),
  method: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
  cookTime: z.number().optional(),
  servings: z.number().optional(),
  mealSlots: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
  notes: z.string().optional(),
  chefTip: z.string().optional(),
  calories: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  vegetarian: z.boolean().optional(),
  emoji: z.string().optional(),
  decision: z.enum(['create_new', 'reuse']).optional(),
  reuseRecipeId: z.string().optional(),
  plan: z.array(planSlotSchema).optional(),
});

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withMcpAudit(caller, { tool, mode: 'write', householdId }, async () => asPreviewResult(await run()));
}

export const previewCreateRecipeTool: McpToolDefinition<typeof createRecipeInput, typeof previewResultSchema> = {
  name: 'preview_create_recipe',
  title: 'Preview create recipe',
  description:
    'Preview creating a household recipe. Dedupes by title + key ingredients. Optional plan slots create one combined preview (recipe + plan) for a single confirmation.',
  inputSchema: createRecipeInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_create_recipe', () => previewCreateRecipe(caller, args)),
};

const updateRecipeInput = createRecipeInput.partial().extend({ recipeId: z.string() });

export const previewUpdateRecipeTool: McpToolDefinition<typeof updateRecipeInput, typeof previewResultSchema> = {
  name: 'preview_update_recipe',
  title: 'Preview update recipe',
  description: 'Preview updating a household-owned recipe.',
  inputSchema: updateRecipeInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_update_recipe', () => previewUpdateRecipe(caller, args)),
};

const deleteRecipeInput = z.object({ recipeId: z.string() });

export const previewDeleteRecipeTool: McpToolDefinition<typeof deleteRecipeInput, typeof previewResultSchema> = {
  name: 'preview_delete_recipe',
  title: 'Preview delete recipe',
  description: 'Preview deleting a household-owned recipe.',
  inputSchema: deleteRecipeInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_delete_recipe', () => previewDeleteRecipe(caller, args)),
};

const importRecipeInput = z.object({
  url: z.string(),
  decision: z.enum(['create_new', 'reuse']).optional(),
  reuseRecipeId: z.string().optional(),
  plan: z.array(planSlotSchema).optional(),
});

export const previewImportRecipeFromUrlTool: McpToolDefinition<typeof importRecipeInput, typeof previewResultSchema> = {
  name: 'preview_import_recipe_from_url',
  title: 'Preview import recipe from URL',
  description:
    'Preview importing a recipe via the existing /recipes/import pipeline (AI gating/lockout messages returned as-is). Optional plan slots share one confirmation.',
  inputSchema: importRecipeInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: openWorldWriteAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_import_recipe_from_url', () => previewImportRecipeFromUrl(caller, args)),
};

const addMealInput = z.object({
  date: z.string(),
  slotKey: z.string(),
  recipeId: z.string(),
  overwrite: z.boolean().optional(),
});

export const previewAddMealTool: McpToolDefinition<typeof addMealInput, typeof previewResultSchema> = {
  name: 'preview_add_meal',
  title: 'Preview add meal',
  description:
    'Preview adding a recipe to a plan slot. Filled slots are blocked unless overwrite is true (stated in the preview).',
  inputSchema: addMealInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_add_meal', () => previewAddMeal(caller, args)),
};

const moveMealInput = z.object({
  fromDate: z.string(),
  fromSlotKey: z.string(),
  toDate: z.string(),
  toSlotKey: z.string(),
  overwrite: z.boolean().optional(),
});

export const previewMoveMealTool: McpToolDefinition<typeof moveMealInput, typeof previewResultSchema> = {
  name: 'preview_move_meal',
  title: 'Preview move meal',
  description: 'Preview moving a planned meal to another day/slot.',
  inputSchema: moveMealInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_move_meal', () => previewMoveMeal(caller, args)),
};

const removeMealInput = z.object({
  date: z.string(),
  slotKey: z.string(),
});

export const previewRemoveMealTool: McpToolDefinition<typeof removeMealInput, typeof previewResultSchema> = {
  name: 'preview_remove_meal',
  title: 'Preview remove meal',
  description: 'Preview clearing a meal from the plan.',
  inputSchema: removeMealInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_remove_meal', () => previewRemoveMeal(caller, args)),
};

const planMealsInput = z.object({
  meals: z.array(
    z.object({
      date: z.string(),
      slotKey: z.string(),
      recipeId: z.string(),
      overwrite: z.boolean().optional(),
    }),
  ),
});

export const previewPlanMealsTool: McpToolDefinition<typeof planMealsInput, typeof previewResultSchema> = {
  name: 'preview_plan_meals',
  title: 'Preview plan meals',
  description:
    'Preview a multi-day meal plan. Lists every slot. Never overwrites filled slots unless overwrite is set on that slot.',
  inputSchema: planMealsInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) => auditedPreview(caller, 'preview_plan_meals', () => previewPlanMeals(caller, args)),
};

const addShoppingInput = z.object({
  name: z.string(),
  amount: z.string().optional(),
  weekStart: z.string().optional(),
});

export const previewAddToShoppingListTool: McpToolDefinition<typeof addShoppingInput, typeof previewResultSchema> = {
  name: 'preview_add_to_shopping_list',
  title: 'Preview add to shopping list',
  description: 'Preview adding a manual item to the household shopping list.',
  inputSchema: addShoppingInput,
  outputSchema: previewResultSchema,
  scope: 'meals:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_to_shopping_list', () => previewAddToShoppingList(caller, args)),
};

export const MEALS_MCP_TOOLS = [
  searchRecipesTool,
  getRecipeTool,
  getMealPlanTool,
  getShoppingListTool,
  getPantryTool,
  getPicksTool,
  previewCreateRecipeTool,
  previewUpdateRecipeTool,
  previewDeleteRecipeTool,
  previewImportRecipeFromUrlTool,
  previewAddMealTool,
  previewMoveMealTool,
  previewRemoveMealTool,
  previewPlanMealsTool,
  previewAddToShoppingListTool,
] as const;
