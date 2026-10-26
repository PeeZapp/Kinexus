/** Stateless Streamable HTTP: each POST is a finished JSON-RPC response. No session is kept in memory. */

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type JsonRpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

export async function mcpResult(
  body: unknown,
  tools: readonly McpTool[],
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<{ status: number; body: unknown } | { status: 202; body: null }> {
  const message = body && typeof body === 'object' ? (body as JsonRpc) : null;
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { status: 400, body: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } } };
  }
  if (message.id == null && message.method.startsWith('notifications/')) return { status: 202, body: null };

  const id = message.id ?? null;
  try {
    const result = await dispatch(message.method, message.params, tools, call);
    return { status: 200, body: { jsonrpc: '2.0', id, result } };
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Tool failed';
    return { status: 200, body: { jsonrpc: '2.0', id, error: { code: -32603, message: messageText } } };
  }
}

async function dispatch(
  method: string,
  params: unknown,
  tools: readonly McpTool[],
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<unknown> {
  if (method === 'initialize') {
    return {
      protocolVersion: '2025-03-26',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'kinexus-shopping', version: '1.0.0' },
    };
  }
  if (method === 'tools/list') return { tools };
  if (method === 'tools/call') {
    const rec = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
    const name = typeof rec.name === 'string' ? rec.name : '';
    const args = rec.arguments && typeof rec.arguments === 'object' ? (rec.arguments as Record<string, unknown>) : {};
    const tool = tools.find((row) => row.name === name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    const value = await call(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(value) }] };
  }
  if (method === 'ping') return {};
  throw new Error(`Unsupported method ${method}`);
}

export const SHOPPING_MCP_TOOLS: readonly McpTool[] = [
  {
    name: 'get_shopping_order',
    description: 'Read the household shopping list for the preferred Coles or Woolworths shop. Includes matched catalogue products and items still unmatched.',
    inputSchema: {
      type: 'object',
      properties: {
        weekStart: { type: 'string', description: 'Monday of the list, YYYY-MM-DD. Defaults to this week.' },
      },
    },
  },
  {
    name: 'prepare_trolley',
    description:
      'Build a one-time link that adds the matched shopping list to the household Coles or Woolworths trolley in the user browser. Does not pay or choose a delivery slot. Give the user reviewUrl.',
    inputSchema: {
      type: 'object',
      properties: {
        weekStart: { type: 'string', description: 'Monday of the list, YYYY-MM-DD. Defaults to this week.' },
      },
    },
  },
];
