import { describe, expect, it } from 'vitest';

import { mcpResult, SHOPPING_MCP_TOOLS } from './mcp.js';

describe('shopping mcp', () => {
  it('lists the shopping tools', async () => {
    const result = await mcpResult({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, SHOPPING_MCP_TOOLS, async () => null);
    expect(result.status).toBe(200);
    const tools = (result.body as { result: { tools: { name: string }[] } }).result.tools.map((tool) => tool.name);
    expect(tools).toEqual(['get_shopping_order', 'prepare_trolley']);
  });

  it('returns a tool result as text', async () => {
    const result = await mcpResult(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_shopping_order', arguments: {} } },
      SHOPPING_MCP_TOOLS,
      async () => ({ chainName: 'Woolworths', lines: [] }),
    );
    const text = (result.body as { result: { content: { text: string }[] } }).result.content[0]?.text ?? '';
    expect(JSON.parse(text).chainName).toBe('Woolworths');
  });

  it('accepts the initialized notification', async () => {
    const result = await mcpResult(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      SHOPPING_MCP_TOOLS,
      async () => null,
    );
    expect(result.status).toBe(202);
  });
});
