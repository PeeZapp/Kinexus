import type { SupabaseClient } from '@supabase/supabase-js';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { loadTalkItemOrThrow } from './talk-reads.js';
import {
  TALK_ITEM_LIMIT,
  TALK_ITEM_NOT_FOUND,
  TALK_LIST_FULL,
  cleanTalkBody,
  resolveCallerHousehold,
} from './shared.js';

export type TalkWriteAction =
  | { action: 'add_talk_item'; body: string }
  | { action: 'set_talk_item_done'; itemId: string; done: boolean; body: string }
  | { action: 'remove_talk_item'; itemId: string; body: string };

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
      kind: 'blocked';
      summary: string;
      message: string;
    }
  | {
      kind: 'noop';
      summary: string;
      message: string;
      itemId?: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: TalkWriteAction,
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

export async function previewAddTalkItem(
  caller: McpCaller,
  input: { body: string },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const body = cleanTalkBody(input.body);
  if (!body) {
    return { kind: 'blocked', summary: 'Could not add talk item', message: 'Write something to talk about.' };
  }

  const { count, error } = await caller.client
    .from('household_talk_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= TALK_ITEM_LIMIT) {
    return { kind: 'blocked', summary: 'Talk list full', message: TALK_LIST_FULL };
  }

  return savePreview(
    caller,
    householdId,
    'preview_add_talk_item',
    { action: 'add_talk_item', body },
    `Add talk item: "${body}"`,
    ['Insert household talk item', 'Notify household (talk segment)'],
  );
}

export async function previewSetTalkItemDone(
  caller: McpCaller,
  input: { itemId: string; done: boolean },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const item = await loadTalkItemOrThrow(caller.client, householdId, input.itemId);
  const body = String(item.body ?? '');
  if (Boolean(item.done) === input.done) {
    return {
      kind: 'noop',
      summary: input.done ? 'Already done' : 'Already open',
      message: `"${body}" is already ${input.done ? 'done' : 'open'}`,
      itemId: String(item.id),
    };
  }

  return savePreview(
    caller,
    householdId,
    'preview_set_talk_item_done',
    {
      action: 'set_talk_item_done',
      itemId: String(item.id),
      done: input.done,
      body,
    },
    `${input.done ? 'Mark done' : 'Reopen'}: "${body}"`,
    [`Set talk item ${item.id} done=${input.done}`],
  );
}

export async function previewRemoveTalkItem(
  caller: McpCaller,
  input: { itemId: string },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const item = await loadTalkItemOrThrow(caller.client, householdId, input.itemId);
  const body = String(item.body ?? '');

  return savePreview(
    caller,
    householdId,
    'preview_remove_talk_item',
    {
      action: 'remove_talk_item',
      itemId: String(item.id),
      body,
    },
    `Remove talk item: "${body}"`,
    [`Delete talk item ${item.id}`],
  );
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
  caller: McpCaller,
  householdId: string,
  payload: TalkWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const client = caller.client;

  switch (payload.action) {
    case 'add_talk_item': {
      const { count, error: countError } = await client
        .from('household_talk_items')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) >= TALK_ITEM_LIMIT) throw new Error(TALK_LIST_FULL);

      const { data, error } = await client
        .from('household_talk_items')
        .insert({
          household_id: householdId,
          body: payload.body,
          created_by: caller.userId,
        })
        .select('id, body, done, created_by, created_at')
        .single();
      if (error) throw new Error(error.message);
      const itemId = String((data as { id: string }).id);
      try {
        await client.rpc('notify_household_alert', {
          p_household_id: householdId,
          p_segment: 'talk',
          p_title: payload.body.slice(0, 160),
          p_body: null,
          p_href: '/today',
          p_payload: { talkItemId: itemId },
        });
      } catch {
        // Non-blocking — same as app client.
      }
      return {
        affectedIds: [itemId],
        result: {
          itemId,
          body: String((data as { body: string }).body),
          done: Boolean((data as { done: boolean }).done),
        },
      };
    }
    case 'set_talk_item_done': {
      const { data, error } = await client
        .from('household_talk_items')
        .update({ done: payload.done })
        .eq('id', payload.itemId)
        .eq('household_id', householdId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(TALK_ITEM_NOT_FOUND);
      return {
        affectedIds: [payload.itemId],
        result: { itemId: payload.itemId, done: payload.done },
      };
    }
    case 'remove_talk_item': {
      const { data, error } = await client
        .from('household_talk_items')
        .delete()
        .eq('id', payload.itemId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(TALK_ITEM_NOT_FOUND);
      return { affectedIds: [payload.itemId], result: { deleted: payload.itemId } };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown talk action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitTalkPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');

  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);

  const payload = committed.preview.payload as TalkWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const TALK_PREVIEW_TOOLS = [
  'preview_add_talk_item',
  'preview_set_talk_item_done',
  'preview_remove_talk_item',
] as const;
