import type { McpCaller } from '../context.js';
import {
  resolveCallerHousehold,
  withMcpAudit,
  type CallerHousehold,
} from '../meals/shared.js';

export const TALK_ITEM_NOT_FOUND = 'Talk item not found';
export const TALK_LIST_FULL = 'The talk list is full. Clear a few first.';
export const TALK_ITEM_LIMIT = 40;

export { resolveCallerHousehold, withMcpAudit };
export type { CallerHousehold };

export async function withTodayAudit<T>(
  caller: McpCaller,
  opts: { tool: string; mode: 'read' | 'write'; householdId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  return withMcpAudit(caller, opts, run);
}

export function cleanTalkBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 120);
}
