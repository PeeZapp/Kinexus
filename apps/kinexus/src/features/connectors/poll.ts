import type { McpConnection } from '@/src/features/connectors/connections-api';

export const POLL_INTERVAL_MS = 3_000;
export const POLL_TIMEOUT_MS = 120_000;
export const WAITING_HINT_AFTER_MS = 60_000;

export function shouldStopPolling(input: {
  startedAt: number;
  now: number;
  closed: boolean;
  found: boolean;
}): boolean {
  if (input.closed || input.found) return true;
  return input.now - input.startedAt >= POLL_TIMEOUT_MS;
}

export function shouldShowWaitingHint(input: { startedAt: number; now: number }): boolean {
  return input.now - input.startedAt >= WAITING_HINT_AFTER_MS;
}

export function findNewConnection(
  baselineIds: ReadonlySet<string>,
  connections: readonly McpConnection[],
  platformId?: string,
): McpConnection | undefined {
  return connections.find(
    (row) => !baselineIds.has(row.id) && (!platformId || row.platform === platformId),
  );
}
