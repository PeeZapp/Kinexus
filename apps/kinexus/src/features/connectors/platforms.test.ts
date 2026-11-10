import { describe, expect, it } from 'vitest';

import { AI_CHAT_PLATFORMS, visibleAiChatPlatforms } from '@/src/features/connectors/platforms';

describe('AI chat platform registry', () => {
  it('enables ChatGPT (#23), Claude (#22), and Perplexity (#24)', () => {
    expect(AI_CHAT_PLATFORMS.map((p) => p.id)).toEqual(['chatgpt', 'claude', 'perplexity']);
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'claude')?.enabled).toBe(true);
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'chatgpt')?.enabled).toBe(true);
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'perplexity')?.enabled).toBe(true);
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'chatgpt')?.deepLink).toContain('chatgpt.com/plugins');
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'claude')?.deepLink).toContain('claude.ai/customize/connectors');
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'perplexity')?.deepLink).toContain('perplexity.ai/computer/plugins');
  });

  it('shows only enabled platforms in production', () => {
    expect(visibleAiChatPlatforms(false).map((p) => p.id)).toEqual(['chatgpt', 'claude', 'perplexity']);
  });

  it('shows the same enabled set in __DEV__', () => {
    expect(visibleAiChatPlatforms(true).map((p) => p.id)).toEqual(['chatgpt', 'claude', 'perplexity']);
  });
});
