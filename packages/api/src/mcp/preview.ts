import { createHash, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

const PREVIEW_TTL_MS = 10 * 60 * 1000;

export type McpPreviewRow = {
  id: string;
  user_id: string;
  household_id: string;
  tool: string;
  payload: unknown;
  expires_at: string;
  committed_at: string | null;
};

export function previewExpiresAt(now = Date.now()): string {
  return new Date(now + PREVIEW_TTL_MS).toISOString();
}

export function hashPreviewPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
}

export async function createWritePreview(
  client: SupabaseClient,
  opts: {
    userId: string;
    householdId: string;
    clientId?: string | null;
    tool: string;
    payload: unknown;
  },
): Promise<{ previewId: string; expiresAt: string }> {
  const id = randomUUID();
  const expiresAt = previewExpiresAt();
  const { error } = await client.from('mcp_previews').insert({
    id,
    user_id: opts.userId,
    household_id: opts.householdId,
    client_id: opts.clientId ?? null,
    tool: opts.tool,
    payload: opts.payload ?? {},
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { previewId: id, expiresAt };
}

export type CommitPreviewResult =
  | { ok: true; preview: McpPreviewRow }
  | { ok: false; reason: 'missing' | 'expired' | 'mismatched' | 'already_committed' };

/**
 * Commit a write preview. Rejects missing, expired, already-committed, or tool/payload mismatches.
 */
export async function commitWritePreview(
  client: SupabaseClient,
  opts: {
    userId: string;
    previewId: string;
    tool: string;
    payload?: unknown;
  },
): Promise<CommitPreviewResult> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('id, user_id, household_id, tool, payload, expires_at, committed_at')
    .eq('id', opts.previewId)
    .eq('user_id', opts.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false, reason: 'missing' };

  const preview = data as McpPreviewRow;
  if (preview.committed_at) return { ok: false, reason: 'already_committed' };
  if (new Date(preview.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  if (preview.tool !== opts.tool) return { ok: false, reason: 'mismatched' };
  if (opts.payload !== undefined && hashPreviewPayload(preview.payload) !== hashPreviewPayload(opts.payload)) {
    return { ok: false, reason: 'mismatched' };
  }

  const { data: updated, error: updateError } = await client
    .from('mcp_previews')
    .update({ committed_at: new Date().toISOString() })
    .eq('id', preview.id)
    .eq('user_id', opts.userId)
    .is('committed_at', null)
    .select('id, user_id, household_id, tool, payload, expires_at, committed_at')
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updated) return { ok: false, reason: 'already_committed' };
  return { ok: true, preview: updated as McpPreviewRow };
}
