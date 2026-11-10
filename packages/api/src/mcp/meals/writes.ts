import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cleanRecipeToHouseholdDraft,
  mondayWeekStart,
  type CleanRecipe,
  type Day,
  type Ingredient,
  type MealSlotKey,
} from '@kinexus/domain';

import { handleCreateRecipeImport, handleGetRecipeImport } from '../../recipes/handlers.js';
import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import {
  RECIPE_NOT_FOUND,
  assertCanWrite,
  dayFromIso,
  parseIsoDate,
  parseSlotKey,
  recipeFromRow,
  recipeInsertRow,
  resolveCallerHousehold,
  type RecipeSummary,
} from './shared.js';
import {
  ensureMealPlanId,
  findDedupeCandidates,
  findHouseholdSlot,
  loadRecipeOrThrow,
} from './reads.js';

export type MealsWriteAction =
  | { action: 'create_recipe'; draft: RecipeDraftPayload; plan?: PlanStepPayload[] }
  | { action: 'update_recipe'; recipeId: string; patch: RecipeDraftPayload }
  | { action: 'delete_recipe'; recipeId: string; name: string }
  | { action: 'import_recipe'; draft: RecipeDraftPayload; sourceUrl: string; plan?: PlanStepPayload[] }
  | { action: 'add_meal'; step: PlanStepPayload }
  | { action: 'move_meal'; from: PlanStepPayload; to: PlanStepPayload }
  | { action: 'remove_meal'; step: PlanStepPayload }
  | { action: 'plan_meals'; steps: PlanStepPayload[] }
  | { action: 'add_to_shopping_list'; weekStart: string; name: string; amount?: string };

export type RecipeDraftPayload = {
  name: string;
  ingredients: Ingredient[];
  method: string[];
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  mealSlots?: MealSlotKey[];
  sourceUrl?: string;
  notes?: string;
  chefTip?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  emoji?: string;
};

export type PlanStepPayload = {
  date: string;
  day: Day;
  slotKey: MealSlotKey;
  recipeId: string;
  recipeName: string;
  overwrite: boolean;
  existingRecipeId?: string;
  existingRecipeName?: string;
  slotId?: string;
};

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'dedupe';
      summary: string;
      candidates: { id: string; name: string; visibility: string; keyIngredients: string[] }[];
      message: string;
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
      existing?: { recipeId?: string; recipeName?: string };
    }
  | {
      kind: 'noop';
      summary: string;
      recipeId: string;
      message: string;
    };

function draftFromInput(input: {
  name: string;
  ingredients?: { name: string; amount?: string }[];
  method?: string[];
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  mealSlots?: string[];
  sourceUrl?: string;
  notes?: string;
  chefTip?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  emoji?: string;
}): RecipeDraftPayload {
  const name = input.name.trim();
  if (!name) throw new Error('Recipe name is required');
  return {
    name,
    ingredients: (input.ingredients ?? [])
      .map((item) => ({ name: item.name.trim(), amount: item.amount?.trim() || undefined }))
      .filter((item) => item.name),
    method: (input.method ?? []).map((step) => step.trim()).filter(Boolean),
    cuisine: input.cuisine?.trim() || undefined,
    cookTime: input.cookTime,
    servings: input.servings,
    mealSlots: input.mealSlots?.map(parseSlotKey),
    sourceUrl: input.sourceUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    chefTip: input.chefTip?.trim() || undefined,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    vegetarian: input.vegetarian,
    emoji: input.emoji,
  };
}

async function buildPlanStep(
  client: SupabaseClient,
  householdId: string,
  input: { date: string; slotKey: string; recipeId: string; overwrite?: boolean },
): Promise<PlanStepPayload> {
  const date = parseIsoDate(input.date, 'date');
  const day = dayFromIso(date);
  const slotKey = parseSlotKey(input.slotKey);
  const recipe = await loadRecipeOrThrow(client, householdId, input.recipeId);
  const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
  const planId = await ensureMealPlanId(client, householdId, weekStart);
  const existing = await findHouseholdSlot(client, planId, day, slotKey);
  const existingRecipeId = (existing?.recipe_id as string | null) ?? undefined;
  const existingRecipeName = (existing?.recipe_name as string | null) ?? undefined;
  const filled = Boolean(existingRecipeId || existingRecipeName);
  const overwrite = Boolean(input.overwrite);
  if (filled && !overwrite) {
    const err = new Error(
      `Slot ${day} ${slotKey} already has ${existingRecipeName ?? 'a meal'}. Pass overwrite: true to replace it.`,
    );
    (err as Error & { code?: string; existing?: unknown }).code = 'slot_filled';
    (err as Error & { existing?: unknown }).existing = {
      recipeId: existingRecipeId,
      recipeName: existingRecipeName,
    };
    throw err;
  }
  return {
    date,
    day,
    slotKey,
    recipeId: recipe.id,
    recipeName: recipe.name,
    overwrite: filled ? true : overwrite,
    existingRecipeId,
    existingRecipeName,
    slotId: existing?.id ? String(existing.id) : undefined,
  };
}

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: MealsWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

export async function previewCreateRecipe(
  caller: McpCaller,
  input: {
    name: string;
    ingredients?: { name: string; amount?: string }[];
    method?: string[];
    cuisine?: string;
    cookTime?: number;
    servings?: number;
    mealSlots?: string[];
    sourceUrl?: string;
    notes?: string;
    chefTip?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    vegetarian?: boolean;
    emoji?: string;
    decision?: 'create_new' | 'reuse';
    reuseRecipeId?: string;
    plan?: { date: string; slotKey: string; overwrite?: boolean }[];
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const draft = draftFromInput(input);
  const planInputs = input.plan ?? [];

  if (input.decision === 'reuse') {
    if (!input.reuseRecipeId) throw new Error('reuseRecipeId is required when decision is reuse');
    const recipe = await loadRecipeOrThrow(caller.client, householdId, input.reuseRecipeId);
    if (planInputs.length === 0) {
      return {
        kind: 'noop',
        summary: `Reuse existing recipe "${recipe.name}"`,
        recipeId: recipe.id,
        message: 'No write needed — using the existing recipe as-is.',
      };
    }
    const steps: PlanStepPayload[] = [];
    for (const item of planInputs) {
      steps.push(
        await buildPlanStep(caller.client, householdId, {
          ...item,
          recipeId: recipe.id,
        }),
      );
    }
    const payload: MealsWriteAction = {
      action: 'plan_meals',
      steps,
    };
    return savePreview(
      caller,
      householdId,
      'preview_create_recipe',
      payload,
      `Reuse "${recipe.name}" and add to ${steps.length} plan slot(s)`,
      steps.map(planStepLine),
    );
  }

  if (input.decision !== 'create_new') {
    const candidates = await findDedupeCandidates(caller.client, householdId, draft.name, draft.ingredients);
    if (candidates.length > 0) {
      return {
        kind: 'dedupe',
        summary: `Possible matches for "${draft.name}"`,
        message:
          'Choose decision: "reuse" with reuseRecipeId, or decision: "create_new" to create a household recipe.',
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          visibility: c.visibility,
          keyIngredients: c.ingredients.slice(0, 6).map((i) => i.name),
        })),
      };
    }
  }

  const planSteps: PlanStepPayload[] = [];
  for (const item of planInputs) {
    // Recipe id is unknown until commit; placeholder replaced on commit.
    const date = parseIsoDate(item.date, 'date');
    const day = dayFromIso(date);
    const slotKey = parseSlotKey(item.slotKey);
    const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
    const planId = await ensureMealPlanId(caller.client, householdId, weekStart);
    const existing = await findHouseholdSlot(caller.client, planId, day, slotKey);
    const existingRecipeId = (existing?.recipe_id as string | null) ?? undefined;
    const existingRecipeName = (existing?.recipe_name as string | null) ?? undefined;
    const filled = Boolean(existingRecipeId || existingRecipeName);
    const overwrite = Boolean(item.overwrite);
    if (filled && !overwrite) {
      return {
        kind: 'blocked',
        summary: `Cannot add to ${day} ${slotKey}`,
        message: `Slot already has ${existingRecipeName ?? 'a meal'}. Pass overwrite: true to replace it.`,
        existing: { recipeId: existingRecipeId, recipeName: existingRecipeName },
      };
    }
    planSteps.push({
      date,
      day,
      slotKey,
      recipeId: '__new__',
      recipeName: draft.name,
      overwrite: filled ? true : overwrite,
      existingRecipeId,
      existingRecipeName,
      slotId: existing?.id ? String(existing.id) : undefined,
    });
  }

  const payload: MealsWriteAction = {
    action: 'create_recipe',
    draft,
    plan: planSteps.length ? planSteps : undefined,
  };
  const steps = [
    `Create household recipe "${draft.name}"`,
    ...planSteps.map(planStepLine),
  ];
  return savePreview(
    caller,
    householdId,
    'preview_create_recipe',
    payload,
    planSteps.length
      ? `Create "${draft.name}" and add to ${planSteps.length} plan slot(s)`
      : `Create household recipe "${draft.name}"`,
    steps,
  );
}

export async function previewUpdateRecipe(
  caller: McpCaller,
  input: {
    recipeId: string;
    name?: string;
    ingredients?: { name: string; amount?: string }[];
    method?: string[];
    cuisine?: string;
    cookTime?: number;
    servings?: number;
    mealSlots?: string[];
    sourceUrl?: string;
    notes?: string;
    chefTip?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    vegetarian?: boolean;
    emoji?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const existing = await loadRecipeOrThrow(caller.client, householdId, input.recipeId);
  if (!existing.householdId) throw new Error('Catalog recipes cannot be updated here');
  const patch = draftFromInput({
    name: input.name ?? existing.name,
    ingredients: input.ingredients ?? existing.ingredients,
    method: input.method ?? existing.method,
    cuisine: input.cuisine ?? existing.cuisine,
    cookTime: input.cookTime ?? existing.cookTime,
    servings: input.servings ?? existing.servings,
    mealSlots: input.mealSlots ?? existing.mealSlots,
    sourceUrl: input.sourceUrl ?? existing.sourceUrl,
    notes: input.notes,
    chefTip: input.chefTip,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    vegetarian: input.vegetarian,
    emoji: input.emoji,
  });
  return savePreview(
    caller,
    householdId,
    'preview_update_recipe',
    { action: 'update_recipe', recipeId: existing.id, patch },
    `Update recipe "${existing.name}"`,
    [`Update household recipe ${existing.id}`],
  );
}

export async function previewDeleteRecipe(
  caller: McpCaller,
  input: { recipeId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const existing = await loadRecipeOrThrow(caller.client, householdId, input.recipeId);
  if (!existing.householdId) throw new Error('Catalog recipes cannot be deleted here');
  return savePreview(
    caller,
    householdId,
    'preview_delete_recipe',
    { action: 'delete_recipe', recipeId: existing.id, name: existing.name },
    `Delete recipe "${existing.name}"`,
    [`Delete household recipe ${existing.id}`],
  );
}

export async function previewImportRecipeFromUrl(
  caller: McpCaller,
  input: {
    url: string;
    decision?: 'create_new' | 'reuse';
    reuseRecipeId?: string;
    plan?: { date: string; slotKey: string; overwrite?: boolean }[];
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);

  if (input.decision === 'reuse') {
    return previewCreateRecipe(caller, {
      name: 'reuse',
      decision: 'reuse',
      reuseRecipeId: input.reuseRecipeId,
      plan: input.plan,
    });
  }

  const request = new Request('http://local/recipes/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caller.accessToken}` },
  });
  const created = await handleCreateRecipeImport(request, {
    url: input.url,
    householdId,
  });
  if (created.status >= 400 && !created.body.job) {
    throw new Error(created.body.error ?? 'Could not import that recipe');
  }
  let job = created.body.job;
  if (!job) throw new Error('Could not import that recipe');

  if (job.status === 'failed') {
    throw new Error(job.errorMessage ?? job.errorCode ?? 'Could not import that recipe');
  }

  const deadline = Date.now() + 55_000;
  while ((job.status === 'queued' || job.status === 'running') && Date.now() < deadline) {
    await sleep(500);
    const latest = await handleGetRecipeImport(job.id);
    if (!latest.body.job) break;
    job = latest.body.job;
  }

  if (job.status === 'failed') {
    throw new Error(job.errorMessage ?? job.errorCode ?? 'Could not import that recipe');
  }
  if (job.status !== 'succeeded' || !job.recipe) {
    throw new Error(job.errorMessage ?? 'Recipe import is still running. Try again shortly.');
  }

  const householdDraft = cleanRecipeToHouseholdDraft(job.recipe as CleanRecipe);
  const draft = draftFromInput({
    name: householdDraft.name,
    ingredients: householdDraft.ingredients,
    method: householdDraft.method,
    cuisine: householdDraft.cuisine,
    cookTime: householdDraft.cookTime,
    servings: householdDraft.servings,
    mealSlots: householdDraft.mealSlots,
    sourceUrl: householdDraft.sourceUrl,
    chefTip: householdDraft.chefTip,
    emoji: householdDraft.emoji,
    vegetarian: householdDraft.vegetarian,
  });

  if (input.decision !== 'create_new') {
    const candidates = await findDedupeCandidates(caller.client, householdId, draft.name, draft.ingredients);
    if (candidates.length > 0) {
      return {
        kind: 'dedupe',
        summary: `Possible matches for imported "${draft.name}"`,
        message:
          'Choose decision: "reuse" with reuseRecipeId, or decision: "create_new" to save the import as a new household recipe.',
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          visibility: c.visibility,
          keyIngredients: c.ingredients.slice(0, 6).map((i) => i.name),
        })),
      };
    }
  }

  const planSteps: PlanStepPayload[] = [];
  for (const item of input.plan ?? []) {
    const date = parseIsoDate(item.date, 'date');
    const day = dayFromIso(date);
    const slotKey = parseSlotKey(item.slotKey);
    const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
    const planId = await ensureMealPlanId(caller.client, householdId, weekStart);
    const existing = await findHouseholdSlot(caller.client, planId, day, slotKey);
    const existingRecipeId = (existing?.recipe_id as string | null) ?? undefined;
    const existingRecipeName = (existing?.recipe_name as string | null) ?? undefined;
    const filled = Boolean(existingRecipeId || existingRecipeName);
    if (filled && !item.overwrite) {
      return {
        kind: 'blocked',
        summary: `Cannot add to ${day} ${slotKey}`,
        message: `Slot already has ${existingRecipeName ?? 'a meal'}. Pass overwrite: true to replace it.`,
        existing: { recipeId: existingRecipeId, recipeName: existingRecipeName },
      };
    }
    planSteps.push({
      date,
      day,
      slotKey,
      recipeId: '__new__',
      recipeName: draft.name,
      overwrite: filled ? true : Boolean(item.overwrite),
      existingRecipeId,
      existingRecipeName,
      slotId: existing?.id ? String(existing.id) : undefined,
    });
  }

  return savePreview(
    caller,
    householdId,
    'preview_import_recipe_from_url',
    {
      action: 'import_recipe',
      draft,
      sourceUrl: draft.sourceUrl ?? input.url,
      plan: planSteps.length ? planSteps : undefined,
    },
    planSteps.length
      ? `Import "${draft.name}" and add to ${planSteps.length} plan slot(s)`
      : `Import "${draft.name}" as a household recipe`,
    [`Import from ${input.url}`, `Save household recipe "${draft.name}"`, ...planSteps.map(planStepLine)],
  );
}

export async function previewAddMeal(
  caller: McpCaller,
  input: { date: string; slotKey: string; recipeId: string; overwrite?: boolean },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  try {
    const step = await buildPlanStep(caller.client, householdId, input);
    return savePreview(
      caller,
      householdId,
      'preview_add_meal',
      { action: 'add_meal', step },
      planStepLine(step),
      [planStepLine(step)],
    );
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'slot_filled') {
      return {
        kind: 'blocked',
        summary: 'Slot already filled',
        message: err.message,
        existing: (err as Error & { existing?: { recipeId?: string; recipeName?: string } }).existing,
      };
    }
    throw err;
  }
}

export async function previewMoveMeal(
  caller: McpCaller,
  input: {
    fromDate: string;
    fromSlotKey: string;
    toDate: string;
    toSlotKey: string;
    overwrite?: boolean;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const fromDate = parseIsoDate(input.fromDate, 'fromDate');
  const fromDay = dayFromIso(fromDate);
  const fromSlotKey = parseSlotKey(input.fromSlotKey);
  const fromWeek = mondayWeekStart(new Date(`${fromDate}T12:00:00`));
  const fromPlanId = await ensureMealPlanId(caller.client, householdId, fromWeek);
  const fromSlot = await findHouseholdSlot(caller.client, fromPlanId, fromDay, fromSlotKey);
  if (!fromSlot?.recipe_id && !fromSlot?.recipe_name) throw new Error('Source meal slot is empty');
  const recipeId = String(fromSlot.recipe_id ?? '');
  if (!recipeId) throw new Error('Source meal has no recipe id');
  const recipeName = String(fromSlot.recipe_name ?? 'Meal');
  const to = await buildPlanStep(caller.client, householdId, {
    date: input.toDate,
    slotKey: input.toSlotKey,
    recipeId,
    overwrite: input.overwrite,
  });
  const from: PlanStepPayload = {
    date: fromDate,
    day: fromDay,
    slotKey: fromSlotKey,
    recipeId,
    recipeName,
    overwrite: false,
    slotId: fromSlot.id ? String(fromSlot.id) : undefined,
  };
  return savePreview(
    caller,
    householdId,
    'preview_move_meal',
    { action: 'move_meal', from, to },
    `Move "${recipeName}" from ${fromDay} ${fromSlotKey} to ${to.day} ${to.slotKey}`,
    [`Clear ${fromDay} ${fromSlotKey}`, planStepLine(to)],
  );
}

export async function previewRemoveMeal(
  caller: McpCaller,
  input: { date: string; slotKey: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const date = parseIsoDate(input.date, 'date');
  const day = dayFromIso(date);
  const slotKey = parseSlotKey(input.slotKey);
  const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
  const planId = await ensureMealPlanId(caller.client, householdId, weekStart);
  const existing = await findHouseholdSlot(caller.client, planId, day, slotKey);
  if (!existing?.recipe_id && !existing?.recipe_name) throw new Error('Meal slot is already empty');
  const step: PlanStepPayload = {
    date,
    day,
    slotKey,
    recipeId: String(existing.recipe_id ?? ''),
    recipeName: String(existing.recipe_name ?? 'Meal'),
    overwrite: false,
    slotId: existing.id ? String(existing.id) : undefined,
  };
  return savePreview(
    caller,
    householdId,
    'preview_remove_meal',
    { action: 'remove_meal', step },
    `Remove "${step.recipeName}" from ${day} ${slotKey}`,
    [`Clear ${day} ${slotKey}`],
  );
}

export async function previewPlanMeals(
  caller: McpCaller,
  input: {
    meals: { date: string; slotKey: string; recipeId: string; overwrite?: boolean }[];
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  if (!input.meals?.length) throw new Error('meals must include at least one slot');
  const steps: PlanStepPayload[] = [];
  for (const meal of input.meals) {
    try {
      steps.push(await buildPlanStep(caller.client, householdId, meal));
    } catch (err) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'slot_filled') {
        return {
          kind: 'blocked',
          summary: 'A plan slot is already filled',
          message: err.message,
          existing: (err as Error & { existing?: { recipeId?: string; recipeName?: string } }).existing,
        };
      }
      throw err;
    }
  }
  return savePreview(
    caller,
    householdId,
    'preview_plan_meals',
    { action: 'plan_meals', steps },
    `Plan ${steps.length} meal slot(s)`,
    steps.map(planStepLine),
  );
}

export async function previewAddToShoppingList(
  caller: McpCaller,
  input: { name: string; amount?: string; weekStart?: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const name = input.name.trim();
  if (!name) throw new Error('name is required');
  const weekStart = input.weekStart ? parseIsoDate(input.weekStart, 'weekStart') : mondayWeekStart();
  return savePreview(
    caller,
    householdId,
    'preview_add_to_shopping_list',
    {
      action: 'add_to_shopping_list',
      weekStart,
      name,
      amount: input.amount?.trim() || undefined,
    },
    `Add "${name}" to shopping list for week of ${weekStart}`,
    [`Add shopping item "${name}"${input.amount ? ` (${input.amount})` : ''}`],
  );
}

export async function commitMealsPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  if (!input.previewId) throw new Error('previewId is required');

  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool: await peekPreviewTool(caller.client, caller.userId, input.previewId),
  });
  if (!committed.ok) {
    throw new Error(`Preview ${committed.reason}`);
  }

  const payload = committed.preview.payload as MealsWriteAction;
  const executed = await executeWrite(caller.client, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

async function peekPreviewTool(
  client: SupabaseClient,
  userId: string,
  previewId: string,
): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function executeWrite(
  client: SupabaseClient,
  householdId: string,
  payload: MealsWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  switch (payload.action) {
    case 'create_recipe':
    case 'import_recipe': {
      const insert = recipeInsertRow(householdId, payload.draft);
      if (payload.action === 'import_recipe') {
        insert.source_url = payload.sourceUrl;
      }
      const { data, error } = await client.from('recipes').insert(insert).select('*').single();
      if (error) throw new Error(error.message);
      const recipe = recipeFromRow(data as Record<string, unknown>);
      const affectedIds = [recipe.id];
      const plan = payload.plan ?? [];
      for (const step of plan) {
        const placed = await assignSlot(client, householdId, { ...step, recipeId: recipe.id, recipeName: recipe.name });
        if (placed) affectedIds.push(placed);
      }
      return {
        affectedIds,
        result: { recipe, planned: plan.map((s) => ({ date: s.date, slotKey: s.slotKey })) },
      };
    }
    case 'update_recipe': {
      const insert = recipeInsertRow(householdId, payload.patch);
      const { household_id: _householdId, is_public: _isPublic, ...update } = insert;
      const { data, error } = await client
        .from('recipes')
        .update(update)
        .eq('id', payload.recipeId)
        .eq('household_id', householdId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(RECIPE_NOT_FOUND);
      const recipe = recipeFromRow(data as Record<string, unknown>);
      return { affectedIds: [recipe.id], result: { recipe } };
    }
    case 'delete_recipe': {
      const { error } = await client
        .from('recipes')
        .delete()
        .eq('id', payload.recipeId)
        .eq('household_id', householdId);
      if (error) throw new Error(error.message);
      return { affectedIds: [payload.recipeId], result: { deleted: payload.recipeId, name: payload.name } };
    }
    case 'add_meal': {
      const id = await assignSlot(client, householdId, payload.step);
      return { affectedIds: id ? [id] : [], result: { step: payload.step } };
    }
    case 'plan_meals': {
      const affectedIds: string[] = [];
      for (const step of payload.steps) {
        const id = await assignSlot(client, householdId, step);
        if (id) affectedIds.push(id);
      }
      return { affectedIds, result: { steps: payload.steps } };
    }
    case 'move_meal': {
      await clearSlot(client, householdId, payload.from);
      const id = await assignSlot(client, householdId, payload.to);
      return {
        affectedIds: [payload.from.slotId, id].filter((v): v is string => Boolean(v)),
        result: { from: payload.from, to: payload.to },
      };
    }
    case 'remove_meal': {
      await clearSlot(client, householdId, payload.step);
      return {
        affectedIds: payload.step.slotId ? [payload.step.slotId] : [],
        result: { cleared: payload.step },
      };
    }
    case 'add_to_shopping_list': {
      const { data, error } = await client
        .from('shopping_items')
        .insert({
          household_id: householdId,
          week_start: payload.weekStart,
          name: payload.name,
          amount: payload.amount ?? null,
          category: 'Other',
          checked: false,
          metadata: { manual: true, recipeSources: [], sharedMealCount: 0, mergedFrom: [] },
        })
        .select('id, name, amount')
        .single();
      if (error) throw new Error(error.message);
      return { affectedIds: [data.id as string], result: { item: data } };
    }
    default:
      throw new Error('Unknown write action');
  }
}

async function assignSlot(
  client: SupabaseClient,
  householdId: string,
  step: PlanStepPayload,
): Promise<string | null> {
  const weekStart = mondayWeekStart(new Date(`${step.date}T12:00:00`));
  const planId = await ensureMealPlanId(client, householdId, weekStart);
  const existing = await findHouseholdSlot(client, planId, step.day, step.slotKey);
  const now = new Date().toISOString();
  const row = {
    meal_plan_id: planId,
    household_id: householdId,
    day: step.day,
    slot_key: step.slotKey,
    recipe_id: step.recipeId,
    recipe_name: step.recipeName,
    emoji: null,
    protein: null,
    calories: null,
    carbs: null,
    fat: null,
    cook_time: null,
    hidden: false,
    audience_person_ids: [] as string[],
    side_recipe_ids: [] as string[],
    client_updated_at: now,
  };
  if (existing?.id) {
    const { data, error } = await client
      .from('meal_slots')
      .update(row)
      .eq('id', existing.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.id as string | undefined) ?? String(existing.id);
  }
  const { data, error } = await client.from('meal_slots').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function clearSlot(
  client: SupabaseClient,
  householdId: string,
  step: PlanStepPayload,
): Promise<void> {
  const weekStart = mondayWeekStart(new Date(`${step.date}T12:00:00`));
  const planId = await ensureMealPlanId(client, householdId, weekStart);
  const existing = step.slotId
    ? { id: step.slotId }
    : await findHouseholdSlot(client, planId, step.day, step.slotKey);
  if (!existing?.id) return;
  const { error } = await client
    .from('meal_slots')
    .update({
      recipe_id: null,
      recipe_name: null,
      emoji: null,
      protein: null,
      calories: null,
      carbs: null,
      fat: null,
      cook_time: null,
      side_recipe_ids: [],
      target_servings: null,
      client_updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
}

function planStepLine(step: PlanStepPayload): string {
  const base = `${step.day} ${step.slotKey}: ${step.recipeName || step.recipeId || 'meal'}`;
  if (step.overwrite && step.existingRecipeName) {
    return `${base} (overwrite "${step.existingRecipeName}")`;
  }
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { RecipeSummary };
