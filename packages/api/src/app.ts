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
  handleScrapeReader,
  handleArchiveFrame,
  handleWatchlistCast,
  handleWatchlistDiscover,
  handleWatchlistLookup,
  handleWatchlistPeople,
  handleWatchlistPersonMovies,
  handleWatchlistRecommend,
  handleWatchlistResolve,
  handleWatchlistSearch,
  handleWatchlistServices,
  type AiRequestBody,
} from './handlers.js';
import { cronAuthorized, handleEstimateRecipeCost, handleRefreshRecipeCosts } from './prices.js';
import { handleShareQuotes, handleCryptoQuotes, handleMetalQuotes } from './quotes.js';
import {
  handleCreateRecipeImport,
  handleGetRecipeImport,
  handleRecipeImportWork,
} from './recipes/handlers.js';
import { handleMirrorRecipeImage } from './recipes/source-image.js';
import { handleGetSharedWishlist } from './shared-wishlist.js';
import { handleEnrichPendingProducts } from './stash/enrich-pending.js';
import { handleCalendarObservances } from './calendar-observances.js';
import {
  handleGoogleCalendars,
  handleGoogleConnectCallback,
  handleGoogleConnectStart,
  handleGoogleDeleteEvent,
  handleGoogleDisconnect,
  handleGooglePersonalDay,
  handleGooglePushEvent,
  handleGoogleSettings,
  handleGoogleStatus,
} from './google-calendar.js';
import { handleVerifyCreatorLinks } from './creators/verify-links.js';
import { handleOverviewNews, handleOverviewPlaces, handleOverviewWeather } from './overview.js';
import { handleOverviewWordle } from './wordle.js';
import { handleGroceryCompare } from './grocery/handlers.js';
import type { GroceryCompareRequest } from './grocery/compare.js';

function registerMealsRoutes(router: Hono) {
  router.get('/health', (c) => c.json({ ok: true }));

  router.get('/stash/shared/:token', async (c) => {
    const result = await handleGetSharedWishlist(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/stash/enrich', async (c) => {
    const result = await handleEnrichPendingProducts(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

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
  router.post('/recipes/mirror-image', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleMirrorRecipeImage(c.req.raw, body as { recipeId?: unknown });
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

  router.post('/creators/verify-links', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleVerifyCreatorLinks(body as { urls?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/scrape-reader', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleScrapeReader(body as { url?: string });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/archive-frame', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) {
      return c.html(`<!DOCTYPE html><html><body style="font:14px system-ui;padding:24px">${authed.error}</body></html>`, authed.status);
    }
    const result = await handleArchiveFrame(c.req.query('url'));
    return c.body(result.body, result.status as ContentfulStatusCode, {
      'Content-Type': result.contentType,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  router.post('/ai', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleAi(body as AiRequestBody);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/compare', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGroceryCompare(body as GroceryCompareRequest);
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

  router.post('/quotes/crypto', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCryptoQuotes(body as { symbols?: unknown; currency?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/quotes/metals', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleMetalQuotes(body as { metals?: unknown; currency?: unknown });
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

  router.post('/watchlist/people', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistPeople(body as { query?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/cast', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistCast(body as { tmdbId?: unknown; mediaType?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/person', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistPersonMovies(body as { personId?: unknown });
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

  router.post('/overview/places', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleOverviewPlaces(body as { query?: unknown; latitude?: unknown; longitude?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/overview/weather', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleOverviewWeather(body as { latitude?: unknown; longitude?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/overview/news', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleOverviewNews(
      body as { interests?: unknown; topicPriorities?: unknown; sportPriorities?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/overview/wordle', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleOverviewWordle(body as { date?: unknown; guesses?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/observances', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCalendarObservances(body as { country?: unknown; from?: unknown; to?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/connect', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGoogleConnectStart(c.req.raw, authed.user.id);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/calendar/google/callback', async (c) => {
    const result = await handleGoogleConnectCallback(c.req.raw);
    return c.redirect(result.location, result.status as 302);
  });

  router.get('/calendar/google/status', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGoogleStatus(authed.user.id);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/calendars', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGoogleCalendars(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/settings', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGoogleSettings(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/disconnect', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGoogleDisconnect(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/push', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGooglePushEvent(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/delete', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGoogleDeleteEvent(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/calendar/google/personal', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGooglePersonalDay(authed.user.id, body as Record<string, unknown>);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/services', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistServices(body as { country?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/recommend', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistRecommend(
      body as { seeds?: unknown; exclude?: unknown; country?: unknown; providerIds?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/discover', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistDiscover(
      body as { mediaType?: unknown; genreId?: unknown; mode?: unknown; country?: unknown; providerIds?: unknown },
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
