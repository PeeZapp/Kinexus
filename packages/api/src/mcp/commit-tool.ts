import { z } from 'zod';

import type { McpToolDefinition } from './registry.js';
import type { McpCaller } from './context.js';
import { writeMcpAudit } from './audit.js';
import { hasScope } from './scopes.js';
import { commitMealsPreview } from './meals/writes.js';
import { resolveCallerHousehold } from './meals/shared.js';
import { commitFitnessPreview } from './fitness/writes.js';
import { commitListsPreview, LISTS_PREVIEW_TOOLS } from './lists/writes.js';
import { commitReadlistPreview, READLIST_PREVIEW_TOOLS } from './readlist/writes.js';

const MEALS_PREVIEW_TOOLS = new Set([
  'preview_create_recipe',
  'preview_update_recipe',
  'preview_delete_recipe',
  'preview_import_recipe_from_url',
  'preview_add_meal',
  'preview_move_meal',
  'preview_remove_meal',
  'preview_plan_meals',
  'preview_add_to_shopping_list',
]);

const FITNESS_PREVIEW_TOOLS = new Set([
  'preview_create_workout',
  'preview_update_workout',
  'preview_delete_workout',
  'preview_create_custom_exercise',
  'preview_update_custom_exercise',
  'preview_create_training_plan',
  'preview_fill_plan_day',
  'preview_set_plan_day_workout',
  'preview_update_plan_day',
  'preview_clear_plan_day',
  'preview_move_plan_day',
  'preview_delete_training_plan',
  'preview_log_workout_session',
  'preview_mark_plan_day_status',
  'preview_save_plan_workout_to_library',
]);

const LISTS_PREVIEW_TOOL_SET = new Set<string>(LISTS_PREVIEW_TOOLS);
const READLIST_PREVIEW_TOOL_SET = new Set<string>(READLIST_PREVIEW_TOOLS);

const commitInput = z.object({ previewId: z.string() });
const commitOutput = z.object({
  ok: z.literal(true),
  tool: z.string(),
  affectedIds: z.array(z.string()),
  result: z.record(z.unknown()),
});

async function peekPreviewTool(caller: McpCaller, previewId: string): Promise<string> {
  const { data, error } = await caller.client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', caller.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

/**
 * Single confirmation tool for all write previews (meals + fitness + lists + readlist).
 * Routes by the stored preview tool name and checks the matching write scope.
 */
export const commitTool: McpToolDefinition<typeof commitInput, typeof commitOutput> = {
  name: 'commit',
  title: 'Commit write preview',
  description:
    'Commit a write preview after the user confirms. Works for meals, fitness, lists, and readlist previews. Rejects missing, expired, mismatched, or already-committed previews. One confirmation applies all steps in the preview.',
  inputSchema: commitInput,
  outputSchema: commitOutput,
  scope: null,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: async (args, caller) => {
    const householdId = await householdIdOrNull(caller);
    try {
      const tool = await peekPreviewTool(caller, args.previewId);
      let result: { ok: true; tool: string; affectedIds: string[]; result: Record<string, unknown> };

      if (MEALS_PREVIEW_TOOLS.has(tool)) {
        if (!hasScope(caller.scopes, 'meals:write')) throw new Error('Missing scope meals:write');
        result = await commitMealsPreview(caller, args);
      } else if (FITNESS_PREVIEW_TOOLS.has(tool)) {
        if (!hasScope(caller.scopes, 'fitness:write')) throw new Error('Missing scope fitness:write');
        result = await commitFitnessPreview(caller, args);
      } else if (LISTS_PREVIEW_TOOL_SET.has(tool)) {
        const writeScope = tool.includes('wishlist') || tool.includes('price_update') ? 'wishlists:write' : 'watchlists:write';
        if (!hasScope(caller.scopes, writeScope)) throw new Error(`Missing scope ${writeScope}`);
        result = await commitListsPreview(caller, args);
      } else if (READLIST_PREVIEW_TOOL_SET.has(tool)) {
        // Readlist reuses watchlists:write so existing connections keep access without reconnect.
        if (!hasScope(caller.scopes, 'watchlists:write')) throw new Error('Missing scope watchlists:write');
        result = await commitReadlistPreview(caller, args);
      } else {
        throw new Error(`Unknown preview tool "${tool}"`);
      }

      await writeMcpAudit(caller.client, {
        userId: caller.userId,
        householdId,
        clientId: caller.clientId,
        platform: caller.platform,
        tool: 'commit',
        mode: 'write',
        success: true,
        affectedIds: result.affectedIds,
      });
      return result;
    } catch (err) {
      await writeMcpAudit(caller.client, {
        userId: caller.userId,
        householdId,
        clientId: caller.clientId,
        platform: caller.platform,
        tool: 'commit',
        mode: 'write',
        success: false,
        errorKind: err instanceof Error ? err.message.slice(0, 80) : 'error',
      });
      throw err;
    }
  },
};
