import { describe, expect, it } from 'vitest';

import { inferMcpPlatform } from './platform.js';

describe('inferMcpPlatform', () => {
  it('maps known client names including Grok', () => {
    expect(inferMcpPlatform('ChatGPT')).toBe('chatgpt');
    expect(inferMcpPlatform('Claude')).toBe('claude');
    expect(inferMcpPlatform('Perplexity')).toBe('perplexity');
    expect(inferMcpPlatform('Grok')).toBe('grok');
    expect(inferMcpPlatform('xAI Grok')).toBe('grok');
    expect(inferMcpPlatform('MCP Inspector')).toBe('inspector');
    expect(inferMcpPlatform('Unknown')).toBe('other');
  });
});
