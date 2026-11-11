import { describe, expect, it } from 'vitest';

import {
  AI_CHAT_PLATFORMS,
  buildAiChatSetupPrompt,
  connectWizardActions,
  COPY_GUIDE_LABEL,
  openTargetForPlatform,
  resolveAiChatOpenUrl,
  visibleAiChatPlatforms,
} from '@/src/features/connectors/platforms';

describe('AI chat platform registry', () => {
  it('enables ChatGPT, Claude, Perplexity, and Grok with required fields', () => {
    expect(AI_CHAT_PLATFORMS.map((p) => p.id)).toEqual(['chatgpt', 'claude', 'perplexity', 'grok']);
    for (const id of ['chatgpt', 'claude', 'perplexity', 'grok'] as const) {
      const row = AI_CHAT_PLATFORMS.find((p) => p.id === id);
      expect(row?.enabled).toBe(true);
      expect(row?.productionMcpUrl).toContain('/ai/mcp');
      expect(row?.setupPromptSettings.length).toBeGreaterThan(0);
      expect(row?.testPrompt.length).toBeGreaterThan(0);
      expect(row?.deepLink.length).toBeGreaterThan(0);
      expect(row?.appDeepLink).toBeUndefined();
    }
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'chatgpt')?.deepLink).toContain('chatgpt.com/plugins');
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'claude')?.deepLink).toContain('claude.ai/customize/connectors');
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'perplexity')?.deepLink).toContain('perplexity.ai/computer/plugins');
    expect(AI_CHAT_PLATFORMS.find((p) => p.id === 'grok')?.deepLink).toBe('https://grok.com/connectors');
  });

  it('shows only enabled platforms in production', () => {
    expect(visibleAiChatPlatforms(false).map((p) => p.id)).toEqual([
      'chatgpt',
      'claude',
      'perplexity',
      'grok',
    ]);
  });

  it('shows the same enabled set in __DEV__', () => {
    expect(visibleAiChatPlatforms(true).map((p) => p.id)).toEqual([
      'chatgpt',
      'claude',
      'perplexity',
      'grok',
    ]);
  });

  it('builds a guide per platform with URL code block instruction and platform settings', () => {
    const mcpUrl = 'https://example.test/ai/mcp';
    for (const platform of AI_CHAT_PLATFORMS) {
      const text = buildAiChatSetupPrompt(platform, mcpUrl);
      expect(text).toContain('code block');
      expect(text).toContain('```\n' + mcpUrl + '\n```');
      expect(text).toMatch(/step by step/i);
      expect(text).toContain(platform.testPrompt);
      for (const setting of platform.setupPromptSettings) {
        expect(text).toContain(setting);
      }
    }
    const claude = AI_CHAT_PLATFORMS.find((p) => p.id === 'claude')!;
    const claudeText = buildAiChatSetupPrompt(claude, mcpUrl);
    expect(claudeText).toContain('Sign in now');
    expect(claudeText).toContain('Register automatically');
    expect(claudeText).toContain('Streamable HTTP');

    const chatgpt = AI_CHAT_PLATFORMS.find((p) => p.id === 'chatgpt')!;
    const chatgptText = buildAiChatSetupPrompt(chatgpt, mcpUrl);
    expect(chatgptText).toMatch(/Business|Enterprise|Pro|Free|Plus/);
    expect(chatgptText).toMatch(/Developer [Mm]ode/);

    const perplexity = AI_CHAT_PLATFORMS.find((p) => p.id === 'perplexity')!;
    expect(buildAiChatSetupPrompt(perplexity, mcpUrl)).toMatch(/Pro|Max|Enterprise/);

    const grok = AI_CHAT_PLATFORMS.find((p) => p.id === 'grok')!;
    expect(buildAiChatSetupPrompt(grok, mcpUrl)).toMatch(/grok\.com\/connectors|Custom|paid|admin/i);
  });

  it('connect screen exposes exactly Copy guide, Open, and Copy URL', () => {
    for (const platform of AI_CHAT_PLATFORMS) {
      const actions = connectWizardActions(platform);
      expect(actions.copyGuide).toBe(COPY_GUIDE_LABEL);
      expect(actions.open).toBe(platform.openLabel);
      expect(actions.copyUrl).toBe(platform.copyUrlLabel);
      expect(actions.explainer).toContain(platform.name);
      expect(Object.keys(actions)).toEqual(['copyGuide', 'open', 'copyUrl', 'explainer']);
    }
  });

  it('Open falls back to the verified web URL when no app deep link is available', () => {
    for (const platform of AI_CHAT_PLATFORMS) {
      expect(resolveAiChatOpenUrl(platform, { isWeb: true })).toBe(platform.deepLink);
      expect(resolveAiChatOpenUrl(platform, { isWeb: false, canOpenApp: false })).toBe(platform.deepLink);
      expect(openTargetForPlatform(platform, 'https://example.test/ai/mcp', { isWeb: true })).toContain(
        platform.id === 'claude' ? 'claude.ai/customize/connectors' : new URL(platform.deepLink).hostname,
      );
    }
    const withApp = {
      ...AI_CHAT_PLATFORMS[0]!,
      appDeepLink: 'chatgpt://plugins',
    };
    expect(resolveAiChatOpenUrl(withApp, { isWeb: false, canOpenApp: true })).toBe('chatgpt://plugins');
    expect(resolveAiChatOpenUrl(withApp, { isWeb: true })).toBe(withApp.deepLink);
  });
});

