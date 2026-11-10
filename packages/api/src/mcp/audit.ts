import type { SupabaseClient } from '@supabase/supabase-js';

import type { McpPlatform } from './platform.js';
import { logMcp } from './log.js';

export async function writeMcpAudit(
  client: SupabaseClient,
  row: {
    userId: string;
    householdId?: string | null;
    clientId?: string | null;
    platform?: McpPlatform | null;
    tool: string;
    mode: 'read' | 'write';
    success: boolean;
    errorKind?: string | null;
    affectedIds?: string[];
  },
): Promise<void> {
  const payload = {
    user_id: row.userId,
    household_id: row.householdId ?? null,
    client_id: row.clientId ?? null,
    platform: row.platform ?? null,
    tool: row.tool,
    mode: row.mode,
    success: row.success,
    error_kind: row.errorKind ?? null,
    affected_ids: row.affectedIds ?? [],
  };
  const { error } = await client.from('mcp_audit_log').insert(payload);
  if (error) {
    logMcp({ event: 'audit_write_failed', error: error.message, tool: row.tool });
  }
}
