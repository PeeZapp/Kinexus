import { describe, expect, it } from 'vitest';

import { connectionForPlatform } from '@/src/features/connectors/claude';
import {
  GROK_COPY_URL_LABEL,
  GROK_OPEN_LABEL,
  GROK_PRODUCTION_MCP_URL,
  GROK_SETUP_PROMPT_SETTINGS,
  GROK_TEST_PROMPT,
  GROK_TIPS,
  grokInstallDeepLink,
} from '@/src/features/connectors/grok';
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

describe('Grok connector wizard', () => {
  it('enables Grok with required fields, Copy URL, and Open Grok web link', () => {
    const grok = AI_CHAT_PLATFORMS.find((p) => p.id === 'grok');
    expect(grok?.enabled).toBe(true);
    expect(GROK_COPY_URL_LABEL).toBe('Copy URL');
    expect(GROK_OPEN_LABEL).toBe('Open Grok');
    expect(grok?.deepLink).toBe(grokInstallDeepLink());
    expect(grok?.deepLink).toBe('https://grok.com/connectors');
    expect(grok?.appDeepLink).toBeUndefined();
    expect(GROK_PRODUCTION_MCP_URL).toContain('/ai/mcp');
    expect(GROK_TIPS.some((t) => /paid/i.test(t))).toBe(true);
    expect(GROK_TIPS.some((t) => /admin|provision/i.test(t))).toBe(true);
    expect(GROK_TIPS.some((t) => /remove|re-add/i.test(t))).toBe(true);
    expect(GROK_SETUP_PROMPT_SETTINGS.length).toBeGreaterThan(0);
    expect(GROK_TEST_PROMPT.length).toBeGreaterThan(0);
    expect(grok?.testPrompt).toBe(GROK_TEST_PROMPT);
    expect(grok?.productionMcpUrl).toBe(GROK_PRODUCTION_MCP_URL);
  });

  it('flips to Connected when an mcp_connections row appears for Grok', () => {
    const baseline = new Set<string>(['a']);
    expect(findNewConnection(baseline, [conn({ id: 'a', platform: 'grok' })], 'grok')).toBeUndefined();
    const found = findNewConnection(
      baseline,
      [conn({ id: 'a', platform: 'claude' }), conn({ id: 'b', platform: 'grok' })],
      'grok',
    );
    expect(found?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'grok' })], 'grok')?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'claude' })], 'grok')).toBeUndefined();
  });
});
