import { describe, expect, it } from 'vitest';

import { connectionForPlatform } from '@/src/features/connectors/claude';
import {
  PERPLEXITY_COPY_URL_LABEL,
  PERPLEXITY_OPEN_LABEL,
  PERPLEXITY_PLAN_NOTICE,
  PERPLEXITY_PRODUCTION_MCP_URL,
  PERPLEXITY_SETUP_STEPS,
  PERPLEXITY_TEST_PROMPT,
  PERPLEXITY_TIPS,
  perplexityInstallDeepLink,
} from '@/src/features/connectors/perplexity';
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

describe('Perplexity connector wizard', () => {
  it('enables Perplexity with plan line, Copy URL, and Open Perplexity deep link', () => {
    const perplexity = AI_CHAT_PLATFORMS.find((p) => p.id === 'perplexity');
    expect(perplexity?.enabled).toBe(true);
    expect(PERPLEXITY_COPY_URL_LABEL).toBe('Copy URL');
    expect(PERPLEXITY_OPEN_LABEL).toBe('Open Perplexity');
    expect(perplexity?.deepLink).toBe(perplexityInstallDeepLink());
    expect(perplexity?.deepLink).toContain('perplexity.ai/computer/plugins');
    expect(PERPLEXITY_PRODUCTION_MCP_URL).toContain('/ai/mcp');
    expect(PERPLEXITY_SETUP_STEPS).toHaveLength(4);
    expect(PERPLEXITY_PLAN_NOTICE).toBe('Needs Perplexity Pro, Max or Enterprise');
    expect(PERPLEXITY_TIPS.some((t) => /Pro|Max|Enterprise/i.test(t))).toBe(true);
    expect(PERPLEXITY_TIPS.some((t) => /admin|custom connectors/i.test(t))).toBe(true);
    expect(PERPLEXITY_TIPS.some((t) => /remove|re-add/i.test(t))).toBe(true);
    expect(PERPLEXITY_TEST_PROMPT.length).toBeGreaterThan(0);
  });

  it('flips to Connected when an mcp_connections row appears for Perplexity', () => {
    const baseline = new Set<string>(['a']);
    expect(findNewConnection(baseline, [conn({ id: 'a', platform: 'perplexity' })], 'perplexity')).toBeUndefined();
    const found = findNewConnection(
      baseline,
      [conn({ id: 'a', platform: 'claude' }), conn({ id: 'b', platform: 'perplexity' })],
      'perplexity',
    );
    expect(found?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'perplexity' })], 'perplexity')?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'claude' })], 'perplexity')).toBeUndefined();
  });
});
