import { describe, expect, it } from 'vitest';

import {
  CLAUDE_COPY_URL_LABEL,
  CLAUDE_OPEN_LABEL,
  CLAUDE_PRODUCTION_MCP_URL,
  CLAUDE_SETUP_STEPS,
  CLAUDE_TEST_PROMPT,
  CLAUDE_TIPS,
  claudeInstallDeepLink,
  connectionForPlatform,
} from '@/src/features/connectors/claude';
import { AI_CHAT_PLATFORMS } from '@/src/features/connectors/platforms';
import { findNewConnection } from '@/src/features/connectors/poll';
import type { McpConnection } from '@/src/features/connectors/connections-api';

function conn(partial: Partial<McpConnection> & Pick<McpConnection, 'id' | 'platform'>): McpConnection {
  return {
    clientId: partial.id,
    clientName: null,
    scopes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: null,
    revokedAt: null,
    ...partial,
  };
}

describe('Claude connector wizard', () => {
  it('enables Claude with Copy URL / Open Claude deep link to production MCP', () => {
    const claude = AI_CHAT_PLATFORMS.find((p) => p.id === 'claude');
    expect(claude?.enabled).toBe(true);
    expect(CLAUDE_COPY_URL_LABEL).toBe('Copy URL');
    expect(CLAUDE_OPEN_LABEL).toBe('Open Claude');
    expect(claude?.deepLink).toBe(claudeInstallDeepLink());
    expect(claude?.deepLink).toContain('modal=add-custom-connector');
    expect(claude?.deepLink).toContain(encodeURIComponent(CLAUDE_PRODUCTION_MCP_URL));
    expect(CLAUDE_SETUP_STEPS).toHaveLength(4);
    expect(CLAUDE_TIPS.some((t) => /Free plan/i.test(t))).toBe(true);
    expect(CLAUDE_TEST_PROMPT.length).toBeGreaterThan(0);
  });

  it('flips to Connected when an mcp_connections row appears for Claude', () => {
    const baseline = new Set<string>(['a']);
    expect(findNewConnection(baseline, [conn({ id: 'a', platform: 'claude' })], 'claude')).toBeUndefined();
    const found = findNewConnection(
      baseline,
      [conn({ id: 'a', platform: 'chatgpt' }), conn({ id: 'b', platform: 'claude' })],
      'claude',
    );
    expect(found?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'claude' })], 'claude')?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'chatgpt' })], 'claude')).toBeUndefined();
  });
});
