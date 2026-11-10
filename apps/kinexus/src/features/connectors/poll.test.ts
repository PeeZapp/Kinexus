import { describe, expect, it } from 'vitest';

import type { McpConnection } from '@/src/features/connectors/connections-api';
import {
  findNewConnection,
  POLL_TIMEOUT_MS,
  shouldShowWaitingHint,
  shouldStopPolling,
  WAITING_HINT_AFTER_MS,
} from '@/src/features/connectors/poll';

function conn(id: string): McpConnection {
  return {
    id,
    clientId: id,
    clientName: null,
    platform: 'chatgpt',
    scopes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: null,
    revokedAt: null,
  };
}

describe('connect polling', () => {
  it('stops when closed, found, or after 2 minutes', () => {
    const startedAt = 1_000;
    expect(shouldStopPolling({ startedAt, now: startedAt + 1_000, closed: true, found: false })).toBe(true);
    expect(shouldStopPolling({ startedAt, now: startedAt + 1_000, closed: false, found: true })).toBe(true);
    expect(
      shouldStopPolling({ startedAt, now: startedAt + POLL_TIMEOUT_MS, closed: false, found: false }),
    ).toBe(true);
    expect(
      shouldStopPolling({ startedAt, now: startedAt + POLL_TIMEOUT_MS - 1, closed: false, found: false }),
    ).toBe(false);
  });

  it('shows the waiting hint only after ~60s', () => {
    const startedAt = 5_000;
    expect(shouldShowWaitingHint({ startedAt, now: startedAt + WAITING_HINT_AFTER_MS - 1 })).toBe(false);
    expect(shouldShowWaitingHint({ startedAt, now: startedAt + WAITING_HINT_AFTER_MS })).toBe(true);
  });

  it('detects a connection id that was not in the baseline', () => {
    const baseline = new Set(['a']);
    expect(findNewConnection(baseline, [conn('a')])).toBeUndefined();
    expect(findNewConnection(baseline, [conn('a'), conn('b')])?.id).toBe('b');
  });

  it('can require a matching platform id', () => {
    const baseline = new Set(['a']);
    const rows = [
      { ...conn('a'), platform: 'chatgpt' },
      { ...conn('b'), platform: 'claude' },
    ];
    expect(findNewConnection(baseline, rows, 'chatgpt')).toBeUndefined();
    expect(findNewConnection(baseline, rows, 'claude')?.id).toBe('b');
  });
});
