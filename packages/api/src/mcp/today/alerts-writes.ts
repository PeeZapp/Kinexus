import type { SupabaseClient } from '@supabase/supabase-js';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { ALERT_NOT_FOUND, loadOwnAlertOrThrow } from './alerts-reads.js';
import { resolveCallerHousehold } from './shared.js';

export type AlertsWriteAction =
  | { action: 'mark_alert_read'; alertId: string; title: string }
  | { action: 'mark_all_alerts_read' };

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
      kind: 'noop';
      summary: string;
      message: string;
      itemId?: string;
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: AlertsWriteAction,
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

export async function previewMarkAlertRead(
  caller: McpCaller,
  input: { alertId: string },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const alert = await loadOwnAlertOrThrow(caller.client, caller.userId, input.alertId);
  const title = String(alert.title ?? '');
  if (alert.read_at) {
    return {
      kind: 'noop',
      summary: 'Already read',
      message: `"${title}" is already marked read`,
      itemId: String(alert.id),
    };
  }
  return savePreview(
    caller,
    householdId,
    'preview_mark_alert_read',
    { action: 'mark_alert_read', alertId: String(alert.id), title },
    `Mark alert read: "${title}"`,
    [`Set read_at on alert ${alert.id}`],
  );
}

export async function previewMarkAllAlertsRead(caller: McpCaller): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const { count, error } = await caller.client
    .from('user_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', caller.userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);
  if ((count ?? 0) === 0) {
    return { kind: 'noop', summary: 'Nothing unread', message: 'No unread alerts' };
  }
  return savePreview(
    caller,
    householdId,
    'preview_mark_all_alerts_read',
    { action: 'mark_all_alerts_read' },
    `Mark all alerts read (${count})`,
    [`Set read_at on ${count} unread alert(s) for this user only`],
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
  payload: AlertsWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const now = new Date().toISOString();
  switch (payload.action) {
    case 'mark_alert_read': {
      const { data, error } = await caller.client
        .from('user_alerts')
        .update({ read_at: now })
        .eq('id', payload.alertId)
        .eq('user_id', caller.userId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(ALERT_NOT_FOUND);
      return { affectedIds: [payload.alertId], result: { alertId: payload.alertId, readAt: now } };
    }
    case 'mark_all_alerts_read': {
      const { data, error } = await caller.client
        .from('user_alerts')
        .update({ read_at: now })
        .eq('user_id', caller.userId)
        .is('read_at', null)
        .select('id');
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((row) => String((row as { id: string }).id));
      return { affectedIds: ids, result: { marked: ids.length, readAt: now } };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown alerts action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitAlertsPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');
  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);
  const payload = committed.preview.payload as AlertsWriteAction;
  const executed = await executeWrite(caller, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const ALERTS_PREVIEW_TOOLS = [
  'preview_mark_alert_read',
  'preview_mark_all_alerts_read',
] as const;
