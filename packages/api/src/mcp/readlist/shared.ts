import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canManageReadlist,
  canViewReadlist,
  isReadStatus,
  type HouseholdRole,
  type ReadlistList,
  type ReadStatus,
} from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import {
  resolveCallerHousehold,
  withMcpAudit,
  type CallerHousehold,
} from '../meals/shared.js';

export const READLIST_NOT_FOUND = 'Readlist not found';
export const READLIST_ITEM_NOT_FOUND = 'Readlist item not found';
export const BOOK_NOT_FOUND = 'Book not found';
export const WRITE_DENIED = 'You cannot change this readlist';

export { resolveCallerHousehold, withMcpAudit };
export type { CallerHousehold };

const ROLE_SET = new Set<string>(['owner', 'admin', 'adult', 'teen', 'child']);

export function asHouseholdRole(role: string): HouseholdRole | null {
  return ROLE_SET.has(role) ? (role as HouseholdRole) : null;
}

export async function resolveCallerPersonId(
  client: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('household_people')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export type AccessOpts = {
  role: HouseholdRole | null;
  userId: string;
  personId: string | null;
};

export function accessOpts(role: string, userId: string, personId: string | null): AccessOpts {
  return { role: asHouseholdRole(role), userId, personId };
}

export function assertCanViewReadlist(list: ReadlistList, opts: AccessOpts): void {
  if (!canViewReadlist(list, opts)) throw new Error(READLIST_NOT_FOUND);
}

export function assertCanManageReadlist(list: ReadlistList, opts: AccessOpts): void {
  if (!canViewReadlist(list, opts)) throw new Error(READLIST_NOT_FOUND);
  if (!canManageReadlist(list, opts)) throw new Error(WRITE_DENIED);
}

export function parseReadStatus(value: string | undefined, fallback: ReadStatus = 'want_to_read'): ReadStatus {
  const raw = (value ?? fallback).trim();
  if (!isReadStatus(raw)) throw new Error('status must be want_to_read, reading, or finished');
  return raw;
}

/** MCP shelf labels (Want to read / Reading / Read). */
export function mcpStatusLabel(status: ReadStatus): string {
  if (status === 'reading') return 'Reading';
  if (status === 'finished') return 'Read';
  return 'Want to read';
}

export function authorNamesFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
      const name = (entry as { name: string }).name.trim();
      if (name) out.push(name);
    }
  }
  return out;
}

export function authorIdsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { openLibraryAuthorId?: unknown }).openLibraryAuthorId;
    if (typeof id === 'string' && id.trim()) out.push(id.trim().toUpperCase());
  }
  return out;
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function withReadlistAudit<T>(
  caller: McpCaller,
  opts: { tool: string; mode: 'read' | 'write'; householdId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  return withMcpAudit(caller, opts, run);
}
