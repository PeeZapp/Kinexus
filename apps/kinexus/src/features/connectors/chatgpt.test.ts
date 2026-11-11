import { describe, expect, it } from 'vitest';

import {
  CHATGPT_COPY_URL_LABEL,
  CHATGPT_OPEN_LABEL,
  CHATGPT_PLAN_NOTICE,
  CHATGPT_PRODUCTION_MCP_URL,
  CHATGPT_SETUP_PROMPT_SETTINGS,
  CHATGPT_TEST_PROMPT,
  CHATGPT_TIPS,
  chatgptInstallDeepLink,
} from '@/src/features/connectors/chatgpt';
import { connectionForPlatform } from '@/src/features/connectors/claude';
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

describe('ChatGPT connector wizard', () => {
  it('enables ChatGPT with Copy URL / Open ChatGPT web Plugins link', () => {
    const chatgpt = AI_CHAT_PLATFORMS.find((p) => p.id === 'chatgpt');
    expect(chatgpt?.enabled).toBe(true);
    expect(CHATGPT_COPY_URL_LABEL).toBe('Copy URL');
    expect(CHATGPT_OPEN_LABEL).toBe('Open ChatGPT');
    expect(chatgpt?.deepLink).toBe(chatgptInstallDeepLink());
    expect(chatgpt?.deepLink).toContain('chatgpt.com/plugins');
    expect(chatgpt?.appDeepLink).toBeUndefined();
    expect(CHATGPT_PRODUCTION_MCP_URL).toContain('/ai/mcp');
    expect(CHATGPT_PLAN_NOTICE).toMatch(/Business|Enterprise/i);
    expect(CHATGPT_TIPS.some((t) => /Business|Enterprise|Pro/i.test(t))).toBe(true);
    expect(CHATGPT_SETUP_PROMPT_SETTINGS.some((s) => /Developer [Mm]ode/i.test(s))).toBe(true);
    expect(CHATGPT_TEST_PROMPT.length).toBeGreaterThan(0);
  });

  it('flips to Connected when an mcp_connections row appears for ChatGPT', () => {
    const baseline = new Set<string>(['a']);
    expect(findNewConnection(baseline, [conn({ id: 'a', platform: 'chatgpt' })], 'chatgpt')).toBeUndefined();
    const found = findNewConnection(
      baseline,
      [conn({ id: 'a', platform: 'claude' }), conn({ id: 'b', platform: 'chatgpt' })],
      'chatgpt',
    );
    expect(found?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'chatgpt' })], 'chatgpt')?.id).toBe('b');
    expect(connectionForPlatform([conn({ id: 'b', platform: 'claude' })], 'chatgpt')).toBeUndefined();
  });
});
