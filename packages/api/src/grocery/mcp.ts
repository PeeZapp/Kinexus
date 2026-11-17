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
      serverInfo: { name: 'kinexus-bot', version: '1.1.0' },
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

const weekStartProp = {
  weekStart: { type: 'string', description: 'Monday of the week, YYYY-MM-DD. Defaults to this week.' },
};

/** Grok Bot household-ops MCP (token connector). Broader than shopping-only. */
export const BOT_MCP_TOOLS: readonly McpTool[] = [
  {
    name: 'get_food_prefs',
    description: 'Household cuisines, allergies, and equipment for meal planning.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_meal_plan',
    description:
      'Read meal plan slots for a date range (YYYY-MM-DD). Defaults to next Monday–Sunday when omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        fromDate: { type: 'string', description: 'Start date YYYY-MM-DD (default next Monday)' },
        toDate: { type: 'string', description: 'End date YYYY-MM-DD (default next Sunday)' },
      },
    },
  },
  {
    name: 'search_recipes',
    description: 'Search household and catalog recipes by name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name fragment to search' },
        limit: { type: 'number', description: 'Max results (1–50, default 20)' },
      },
    },
  },
  {
    name: 'get_picks',
    description: 'Approved person/slot recipe picks for the household.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string' },
        slotKey: { type: 'string', description: 'e.g. dinner, lunch, breakfast' },
      },
    },
  },
  {
    name: 'plan_meals',
    description:
      'Write recipes into meal plan slots. Does not overwrite filled slots unless overwrite is true on that meal.',
    inputSchema: {
      type: 'object',
      properties: {
        meals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'YYYY-MM-DD' },
              slotKey: { type: 'string' },
              recipeId: { type: 'string' },
              overwrite: { type: 'boolean' },
            },
            required: ['date', 'slotKey', 'recipeId'],
          },
        },
      },
      required: ['meals'],
    },
  },
  {
    name: 'get_shopping_list',
    description: 'Read the household shopping list for a week.',
    inputSchema: { type: 'object', properties: weekStartProp },
  },
  {
    name: 'rebuild_shopping_list',
    description: 'Rebuild the shopping list from the meal plan for a week. Keeps manual items.',
    inputSchema: { type: 'object', properties: weekStartProp },
  },
  {
    name: 'match_shopping_prices',
    description: 'Match shopping list items to Coles/Woolworths catalogue products and save quotes for trolley.',
    inputSchema: { type: 'object', properties: weekStartProp },
  },
  {
    name: 'get_shopping_order',
    description:
      'Read the household shopping list for the preferred Coles or Woolworths shop. Includes matched catalogue products and items still unmatched.',
    inputSchema: { type: 'object', properties: weekStartProp },
  },
  {
    name: 'prepare_trolley',
    description:
      'Build shopUrl and reviewUrl for the matched shopping list. Open shopUrl in your browser, sign in to the household Coles/Woolworths account if needed, add products to the trolley, and complete checkout/delivery. If login, CAPTCHA, or payment blocks you, send reviewUrl to the household instead. Do not invent product IDs.',
    inputSchema: { type: 'object', properties: weekStartProp },
  },
];

/** @deprecated Prefer BOT_MCP_TOOLS */
export const SHOPPING_MCP_TOOLS = BOT_MCP_TOOLS;
