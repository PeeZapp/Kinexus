import {
  asWeekStart,
  bearerToken,
  connectorFromToken,
  createConnectorHandoff,
  createGroceryConnector,
  createGroceryHandoff,
  listGroceryConnectors,
  loadTrolleyOrder,
  readGroceryHandoff,
  revokeGroceryConnector,
} from './bot.js';
import {
  botGetFoodPrefs,
  botGetMealPlan,
  botGetPicks,
  botGetShoppingList,
  botMatchShoppingPrices,
  botPlanMeals,
  botRebuildShopping,
  botSearchRecipes,
  nextWeekRange,
} from './bot-ops.js';
import { BOT_MCP_TOOLS, mcpResult } from './mcp.js';
import { mcpConnectorUrl, publicSiteOriginFromRequest } from './public-origin.js';

function apiOrigin(request: Request): string {
  return publicSiteOriginFromRequest(request);
}

function connectorToken(request: Request): string {
  const header = bearerToken(request.headers.get('authorization'));
  if (header) return header;
  const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return bearerToken(params.get('token') || params.get('access_token'));
}

function asDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

export async function handleCreateGroceryConnector(
  userId: string,
  body: { householdId?: unknown; label?: unknown },
  request: Request,
) {
  try {
    const result = await createGroceryConnector(userId, body);
    if (!result.ok) return { status: result.status, body: { error: result.error } };
    const site = publicSiteOriginFromRequest(request);
    return {
      status: 200,
      body: { connector: result.connector, token: result.token, mcpUrl: mcpConnectorUrl(site, result.token) },
    };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not create a connector.' } };
  }
}

export async function handleListGroceryConnectors(userId: string, householdId: string) {
  try {
    const connectors = await listGroceryConnectors(userId, householdId);
    return { status: 200, body: { connectors } };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not load connectors.' } };
  }
}

export async function handleRevokeGroceryConnector(userId: string, connectorId: string) {
  try {
    const revoked = await revokeGroceryConnector(userId, connectorId);
    if (!revoked) return { status: 404, body: { error: 'That connector is already gone.' } };
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not revoke that connector.' } };
  }
}

export async function handleCreateGroceryHandoff(
  userId: string,
  body: { householdId?: unknown; weekStart?: unknown },
  request: Request,
) {
  try {
    const householdId = typeof body.householdId === 'string' ? body.householdId : '';
    const result = await createGroceryHandoff(userId, householdId, asWeekStart(body.weekStart), apiOrigin(request));
    if (!result.ok) return { status: result.status, body: { error: result.error } };
    return {
      status: 200,
      body: { reviewUrl: result.reviewUrl, shopUrl: result.shopUrl, order: result.order },
    };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not prepare the trolley.' } };
  }
}

export async function handleReadGroceryHandoff(token: string) {
  try {
    const result = await readGroceryHandoff(token);
    if (!result.ok) return { status: result.status, body: { error: result.error } };
    return { status: 200, body: { chainId: result.chainId, lines: result.lines, skipped: result.skipped } };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not open that trolley link.' } };
  }
}

export async function handleShoppingMcp(request: Request): Promise<{ status: number; body: unknown }> {
  const token = connectorToken(request);
  let connector: { householdId: string; userId: string; connectorId: string } | null = null;
  if (token) {
    try {
      connector = await connectorFromToken(token);
    } catch (err) {
      return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not check that connector.' } };
    }
  }
  const payload = await request.json().catch(() => null);
  const message = payload && typeof payload === 'object' ? (payload as { id?: unknown; method?: unknown }) : null;
  if (!connector) {
    return {
      status: 401,
      body: { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32001, message: 'Connect Grok Bot with a Kinexus token.' } },
    };
  }
  return mcpResult(payload, BOT_MCP_TOOLS, async (name, args) => {
    if (!connector) throw new Error('Connect Grok Bot with a Kinexus token.');
    const { householdId, userId } = connector;
    const weekStart = asWeekStart(args.weekStart);

    switch (name) {
      case 'get_food_prefs':
        return botGetFoodPrefs(householdId);
      case 'get_meal_plan': {
        const range = nextWeekRange();
        const fromDate = typeof args.fromDate === 'string' ? asDate(args.fromDate, 'fromDate') : range.fromDate;
        const toDate = typeof args.toDate === 'string' ? asDate(args.toDate, 'toDate') : range.toDate;
        return botGetMealPlan(householdId, { fromDate, toDate });
      }
      case 'search_recipes':
        return botSearchRecipes(householdId, {
          query: typeof args.query === 'string' ? args.query : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
      case 'get_picks':
        return botGetPicks(householdId, {
          personId: typeof args.personId === 'string' ? args.personId : undefined,
          slotKey: typeof args.slotKey === 'string' ? args.slotKey : undefined,
        });
      case 'plan_meals': {
        if (!Array.isArray(args.meals)) throw new Error('meals must be an array');
        const meals = args.meals.map((row) => {
          const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          return {
            date: asDate(rec.date, 'date'),
            slotKey: typeof rec.slotKey === 'string' ? rec.slotKey : '',
            recipeId: typeof rec.recipeId === 'string' ? rec.recipeId : '',
            overwrite: rec.overwrite === true,
          };
        });
        return botPlanMeals(userId, householdId, meals);
      }
      case 'get_shopping_list':
        return botGetShoppingList(householdId, weekStart);
      case 'rebuild_shopping_list':
        return botRebuildShopping(userId, householdId, weekStart);
      case 'match_shopping_prices':
        return botMatchShoppingPrices(userId, householdId, weekStart);
      case 'get_shopping_order': {
        const order = await loadTrolleyOrder(householdId, weekStart);
        if ('error' in order) throw new Error(order.error);
        return order;
      }
      case 'prepare_trolley': {
        const handoff = await createConnectorHandoff(householdId, weekStart, apiOrigin(request));
        if (!handoff.ok) throw new Error(handoff.error);
        return {
          reviewUrl: handoff.reviewUrl,
          shopUrl: handoff.shopUrl,
          order: handoff.order,
          instruction:
            'Open shopUrl in your browser. Sign in to the household supermarket account if needed, add the matched products, and complete checkout. If blocked, send reviewUrl to the household.',
        };
      }
      default:
        throw new Error(`Unknown tool ${name}`);
    }
  });
}
