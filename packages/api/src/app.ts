import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { userFromRequest } from './auth.js';
import { corsOrigins } from './env.js';
import {
  handleAi,
  handleBudgetClassify,
  handleCollectibleLookup,
  handleCollectibleSearch,
  handleScrape,
  handleScrapeLink,
  handleScrapeProduct,
  handleWatchlistLookup,
  handleWatchlistResolve,
  handleWatchlistSearch,
  type AiRequestBody,
} from './handlers.js';
import { cronAuthorized, handleEstimateRecipeCost, handleRefreshRecipeCosts } from './prices.js';
import { handleShareQuotes } from './quotes.js';
import {
  handleCreateRecipeImport,
  handleGetRecipeImport,
  handleRecipeImportWork,
} from './recipes/handlers.js';

function registerMealsRoutes(router: Hono) {
  router.get('/health', (c) => c.json({ ok: true }));

  router.post('/recipes/import', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCreateRecipeImport(c.req.raw, body as { url?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });
  router.post('/recipes/import/work', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleRecipeImportWork(c.req.raw, body as { id?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });
  router.get('/recipes/:id', async (c) => {
    const result = await handleGetRecipeImport(c.req.param('id'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/scrape', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleScrape(body as { url?: string });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/scrape-product', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleScrapeProduct(body as { url?: string });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/scrape-link', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleScrapeLink(body as { url?: string });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/ai', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleAi(body as AiRequestBody);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/prices/estimate', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleEstimateRecipeCost(authed.user.id, body as { recipeId?: string; householdId?: string; force?: boolean });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/prices/refresh', async (c) => {
    if (cronAuthorized(c.req.raw)) {
      const result = await handleRefreshRecipeCosts(c.req.raw);
      return c.json(result.body, result.status as ContentfulStatusCode);
    }
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleRefreshRecipeCosts(c.req.raw, authed.user.id);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });
  router.post('/prices/refresh', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (cronAuthorized(c.req.raw)) {
      const result = await handleRefreshRecipeCosts(c.req.raw, undefined, body);
      return c.json(result.body, result.status as ContentfulStatusCode);
    }
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleRefreshRecipeCosts(c.req.raw, authed.user.id, body);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/quotes', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleShareQuotes(body as { symbols?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/collectibles/search', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCollectibleSearch(body as { kind?: unknown; query?: unknown; currency?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/collectibles/lookup', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCollectibleLookup(
      body as { kind?: unknown; catalogId?: unknown; sourceUrl?: unknown; currency?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/budget/classify', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleBudgetClassify(body as { merchants?: unknown; categories?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/search', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistSearch(body as { query?: unknown; country?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/lookup', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistLookup(
      body as { tmdbId?: unknown; mediaType?: unknown; country?: unknown; sourceUrl?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/resolve', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistResolve(body as { url?: unknown; country?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });
}

const meals = new Hono();
registerMealsRoutes(meals);

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: corsOrigins(),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.route('/', meals);
app.route('/api', meals);
