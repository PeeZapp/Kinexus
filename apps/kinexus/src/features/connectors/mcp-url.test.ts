import { describe, expect, it } from 'vitest';

import { buildAiChatMcpUrl } from '@/src/features/connectors/mcp-url';

describe('buildAiChatMcpUrl', () => {
  it('uses the site origin path /ai/mcp', () => {
    expect(buildAiChatMcpUrl({ pageOrigin: 'https://kinexus.example' })).toBe('https://kinexus.example/ai/mcp');
  });

  it('falls back to the local API origin', () => {
    expect(buildAiChatMcpUrl({})).toBe('http://localhost:5301/ai/mcp');
  });

  it('uses /ai/mcp rather than the grocery MCP path', () => {
    const url = buildAiChatMcpUrl({ apiUrl: 'http://localhost:5301' });
    expect(url).toBe('http://localhost:5301/ai/mcp');
    expect(url.includes('/ai/mcp')).toBe(true);
    expect(url.replace(/\/ai\/mcp$/, '')).toBe('http://localhost:5301');
  });
});
