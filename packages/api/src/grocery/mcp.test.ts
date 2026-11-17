import { describe, expect, it } from 'vitest';

import { BOT_MCP_TOOLS, mcpResult, SHOPPING_MCP_TOOLS } from './mcp.js';

describe('bot mcp', () => {
  it('lists Sunday ops tools', async () => {
    const result = await mcpResult({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, BOT_MCP_TOOLS, async () => null);
    expect(result.status).toBe(200);
    const tools = (result.body as { result: { tools: { name: string }[] } }).result.tools.map((tool) => tool.name);
    expect(tools).toEqual([
      'get_food_prefs',
      'get_meal_plan',
      'search_recipes',
      'get_picks',
      'plan_meals',
      'get_shopping_list',
      'rebuild_shopping_list',
      'match_shopping_prices',
      'get_shopping_order',
      'prepare_trolley',
    ]);
    expect(SHOPPING_MCP_TOOLS).toBe(BOT_MCP_TOOLS);
  });

  it('returns a tool result as text', async () => {
    const result = await mcpResult(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_shopping_order', arguments: {} } },
      BOT_MCP_TOOLS,
      async () => ({ chainName: 'Woolworths', lines: [] }),
    );
    const text = (result.body as { result: { content: { text: string }[] } }).result.content[0]?.text ?? '';
    expect(JSON.parse(text).chainName).toBe('Woolworths');
  });

  it('accepts the initialized notification', async () => {
    const result = await mcpResult(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      BOT_MCP_TOOLS,
      async () => null,
    );
    expect(result.status).toBe(202);
  });

  it('names the server kinexus-bot', async () => {
    const result = await mcpResult({ jsonrpc: '2.0', id: 3, method: 'initialize', params: {} }, BOT_MCP_TOOLS, async () => null);
    expect((result.body as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe('kinexus-bot');
  });
});
