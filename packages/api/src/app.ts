import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { createUserClient, readBearerToken, userFromRequest } from './auth.js';
import { corsOrigins } from './env.js';
import {
  handleAi,
  handleBudgetClassify,
  handleBudgetTransactionsRead,
  handleCollectibleLookup,
  handleCollectibleSearch,
  handleScrape,
  handleScrapeLink,
  handleScrapeProduct,
  handleScrapeReader,
  handleArchiveFrame,
  handleWatchlistCast,
  handleWatchlistDiscover,
  handleWatchlistImportMatch,
  handleWatchlistLookup,
  handleWatchlistPeople,
  handleWatchlistPersonMovies,
  handleWatchlistRecommend,
  handleWatchlistResolve,
  handleWatchlistSearch,
  handleWatchlistServices,
  type AiRequestBody,
} from './handlers.js';
import { handleListsImportLink } from './lists/import-link.js';
import { handleTrainImportLink } from './train/import-link.js';
import { cronAuthorized, handleEstimateRecipeCost, handleRefreshRecipeCosts } from './prices.js';
import { handleShareQuotes, handleCryptoQuotes, handleMetalQuotes } from './quotes.js';
import {
  handleCreateRecipeImport,
  handleGetRecipeImport,
  handleRecipeImportWork,
} from './recipes/handlers.js';
import { handleMirrorRecipeImage } from './recipes/source-image.js';
import { handleGetSharedWishlist } from './shared-wishlist.js';
import { handleGetSharedWorkout } from './shared-workout.js';
import { handleGetSharedTrainingPlan } from './shared-training-plan.js';
import { handleGetSharedWatchlist } from './shared-watchlist-link.js';
import { handleGetSharedReadlist } from './shared-readlist-link.js';
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
import {
  handleCompleteGoogleAvatarIntent,
  handleCreateGoogleAvatarIntent,
} from './profile-avatar-google.js';
import {
  handleCompleteFacebookAvatarIntent,
  handleCreateFacebookAvatarIntent,
  handleGetFacebookAvatarPicture,
} from './profile-avatar-facebook.js';
import { handleVerifyCreatorLinks } from './creators/verify-links.js';
import {
  handleBlockProfile,
  handleGetPublicCreatorProfile,
  handleReportProfile,
  handleSearchCreators,
  handleUpsertMyProfileMeta,
} from './creators/public-profile.js';
import { handleOverviewNews, handleOverviewPlaces, handleOverviewWeather } from './overview.js';
import { handleOverviewWordle } from './wordle.js';
import { handleGroceryCatalog, handleGroceryCompare } from './grocery/handlers.js';
import type { GroceryCatalogRequest, GroceryCompareRequest } from './grocery/compare.js';
import {
  handleCreateGroceryConnector,
  handleCreateGroceryHandoff,
  handleListGroceryConnectors,
  handleReadGroceryHandoff,
  handleRevokeGroceryConnector,
  handleShoppingMcp,
} from './grocery/bot-handlers.js';
import { handleMcpHttp } from './mcp/handler.js';
import {
  handleListMcpConnections,
  handleRegisterMcpConnection,
  handleRevokeMcpConnection,
} from './mcp/connections.js';
import { oauthAuthorizationServerBody, oauthProtectedResourceBody } from './mcp/oauth-metadata.js';
import { handleWeeklyCatalogueSelection } from './grocery/catalogue-select.js';
import { handleDailyCatalogueRefresh } from './grocery/catalogue-refresh.js';
import {
  handleBooksCollection,
  handleBooksCollections,
  handleBooksResolveUrl,
  handleBooksSearch,
  handleBooksWork,
} from './books/index.js';
import {
  handleAddReadlistItem,
  handleCreateReadlistList,
  handleDeleteReadlistList,
  handleDeleteReadlistReview,
  handleEnsureDefaultReadlist,
  handleGetReadlistRecommendations,
  handleReadlistExport,
  handleReadlistImportCommit,
  handleReadlistImportMatch,
  handleRemoveReadlistItem,
  handleRenameReadlistList,
  handleSetReadlistItemStatus,
  handleUpdateReadlistItem,
  handleUpsertReadlistProgress,
  handleUpsertReadlistReview,
} from './readlist/index.js';
import {
  handleDeleteAiKey,
  handleGetAiKey,
  handleGetAiKeyAccess,
  handlePutAiKeyAccess,
  handleSetAiKey,
} from './ai/keys.js';
import { resolveAiStatus } from './ai/resolve.js';
import { scrubErrorMessage } from './ai/scrub.js';

function registerMealsRoutes(router: Hono) {
  router.get('/health', (c) => c.json({ ok: true }));

  router.get('/stash/shared/:token', async (c) => {
    const result = await handleGetSharedWishlist(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/train/shared/:token', async (c) => {
    const result = await handleGetSharedWorkout(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/train/shared-plan/:token', async (c) => {
    const result = await handleGetSharedTrainingPlan(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/watchlist/shared/:token', async (c) => {
    const result = await handleGetSharedWatchlist(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/readlist/shared/:token', async (c) => {
    const result = await handleGetSharedReadlist(c.req.param('token'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/u/:key', async (c) => {
    const result = await handleGetPublicCreatorProfile(c.req.raw, c.req.param('key'), {
      kind: c.req.query('kind'),
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor'),
    });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/creators/search', async (c) => {
    const result = await handleSearchCreators(c.req.raw, c.req.query('q'), c.req.query('limit'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.put('/me/profile-meta', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleUpsertMyProfileMeta(c.req.raw, body as { bio?: unknown; links?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/u/:key/report', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleReportProfile(c.req.raw, c.req.param('key'), body as { reason?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/u/:key/block', async (c) => {
    const result = await handleBlockProfile(c.req.raw, c.req.param('key'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/stash/enrich', async (c) => {
    const result = await handleEnrichPendingProducts(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/grocery/catalogue/select', async (c) => {
    const result = await handleWeeklyCatalogueSelection(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/grocery/catalogue/refresh', async (c) => {
    const result = await handleDailyCatalogueRefresh(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/recipes/import', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCreateRecipeImport(c.req.raw, body as { url?: unknown; householdId?: unknown });
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
    const result = await handleAi(authed.user.id, body as AiRequestBody);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/ai/status', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const householdId = c.req.query('householdId')?.trim() ?? '';
    if (!householdId) return c.json({ error: 'householdId is required' }, 400);
    try {
      const body = await resolveAiStatus(authed.user.id, householdId);
      return c.json(body, 200);
    } catch (err) {
      const message = scrubErrorMessage(err);
      const status = message.includes('Not a member') ? 403 : 400;
      return c.json({ error: message }, status);
    }
  });

  router.get('/ai/keys', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGetAiKey(authed.user.id, c.req.query('householdId') ?? '', c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/ai/keys', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleSetAiKey(authed.user.id, body as { householdId?: unknown; key?: unknown; provider?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.delete('/ai/keys', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleDeleteAiKey(authed.user.id, body as { householdId?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/ai/keys/access', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGetAiKeyAccess(authed.user.id, c.req.query('householdId') ?? '', c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.put('/ai/keys/access', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handlePutAiKeyAccess(
      authed.user.id,
      body as { householdId?: unknown; userId?: unknown; allowed?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/compare', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGroceryCompare(body as GroceryCompareRequest);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/catalog', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleGroceryCatalog(body as GroceryCatalogRequest);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/connectors', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCreateGroceryConnector(authed.user.id, body as { householdId?: unknown; label?: unknown }, c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/grocery/connectors', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleListGroceryConnectors(authed.user.id, c.req.query('householdId') ?? '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/connectors/revoke', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = (await c.req.json().catch(() => ({}))) as { connectorId?: unknown };
    const result = await handleRevokeGroceryConnector(authed.user.id, typeof body.connectorId === 'string' ? body.connectorId : '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/grocery/handoff', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCreateGroceryHandoff(authed.user.id, body as { householdId?: unknown; weekStart?: unknown }, c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/grocery/handoff', async (c) => {
    const result = await handleReadGroceryHandoff(c.req.query('token') ?? '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.on(['GET', 'POST', 'DELETE', 'OPTIONS'], '/ai/mcp', async (c) => {
    return handleMcpHttp(c.req.raw);
  });

  router.get('/mcp/connections', async (c) => {
    const result = await handleListMcpConnections(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/mcp/connections', async (c) => {
    const result = await handleRegisterMcpConnection(c.req.raw);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.delete('/mcp/connections/:id', async (c) => {
    const result = await handleRevokeMcpConnection(c.req.raw, c.req.param('id'));
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/.well-known/oauth-protected-resource', (c) => {
    return c.json(oauthProtectedResourceBody(c.req.raw));
  });

  router.get('/.well-known/oauth-protected-resource/ai/mcp', (c) => {
    return c.json(oauthProtectedResourceBody(c.req.raw));
  });

  router.get('/.well-known/oauth-authorization-server', async (c) => {
    return c.json(await oauthAuthorizationServerBody());
  });

  router.on(['GET', 'DELETE'], '/mcp', (c) => {
    c.header('Allow', 'POST');
    return c.json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'This MCP server is stateless. POST each JSON-RPC request.' } },
      405,
    );
  });

  router.post('/mcp', async (c) => {
    const result = await handleShoppingMcp(c.req.raw);
    if (result.status === 202) return c.body(null, 202);
    const accept = c.req.header('accept') ?? '';
    const sseOnly = accept.includes('text/event-stream') && !accept.includes('application/json');
    if (sseOnly && result.status === 200) {
      return c.body(`event: message\ndata: ${JSON.stringify(result.body)}\n\n`, 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
    }
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
    const result = await handleBudgetClassify(
      authed.user.id,
      body as { merchants?: unknown; categories?: unknown; householdId?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/budget/transactions/read', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleBudgetTransactionsRead(
      authed.user.id,
      body as { householdId?: unknown; localDate?: unknown; images?: unknown },
    );
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

  // Optional Google profile photo (backend only). Distinct from Calendar OAuth.
  router.post('/profile/avatar/google/intent', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleCreateGoogleAvatarIntent(authed.user.id);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/profile/avatar/google/complete', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCompleteGoogleAvatarIntent(
      authed.user.id,
      body as { intentId?: unknown; googleAccessToken?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  // Optional Facebook profile photo. Distinct from sign-in; linkIdentity is client-side.
  router.post('/profile/avatar/facebook/intent', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleCreateFacebookAvatarIntent(authed.user.id);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/profile/avatar/facebook/complete', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCompleteFacebookAvatarIntent(
      authed.user.id,
      body as { intentId?: unknown; facebookAccessToken?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/profile/avatar/facebook/picture', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGetFacebookAvatarPicture(authed.user.id);
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
      body as {
        seeds?: unknown;
        exclude?: unknown;
        country?: unknown;
        providerIds?: unknown;
        personIds?: unknown;
      },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/watchlist/discover', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistDiscover(
      body as {
        mediaType?: unknown;
        genreId?: unknown;
        mode?: unknown;
        country?: unknown;
        providerIds?: unknown;
        personIds?: unknown;
      },
      c.req.raw,
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

  router.post('/watchlist/import/match', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleWatchlistImportMatch(
      authed.user.id,
      body as { rows?: unknown; country?: unknown },
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/lists/import/link', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleListsImportLink(body as { url?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/train/import/link', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const token = readBearerToken(c.req.raw);
    const client = token ? createUserClient(token) : undefined;
    const result = await handleTrainImportLink(body as { url?: unknown }, {
      client,
      userId: authed.user.id,
    });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/books/search', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleBooksSearch(c.req.query('q') ?? '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/books/collections', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleBooksCollections();
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/books/collections/:id', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleBooksCollection(c.req.param('id') ?? '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/books/work/:id', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleBooksWork(c.req.param('id') ?? '');
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/books/resolve-url', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleBooksResolveUrl(body as { url?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/ensure-default', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleEnsureDefaultReadlist(
      authed.user.id,
      body as { householdId?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/readlist/recommendations', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleGetReadlistRecommendations(
      authed.user.id,
      { householdId: c.req.query('householdId') },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/import/match', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleReadlistImportMatch(authed.user.id, body as { rows?: unknown });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/import/commit', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleReadlistImportCommit(
      authed.user.id,
      body as { listId?: unknown; rows?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.get('/readlist/export', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const result = await handleReadlistExport(
      authed.user.id,
      { listId: c.req.query('listId'), format: c.req.query('format') },
      c.req.raw,
    );
    if (result.status !== 200 || !('text' in result)) {
      return c.json(result.body, result.status as ContentfulStatusCode);
    }
    return c.body(result.text, 200, {
      'Content-Type': `${result.mimeType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${result.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    });
  });

  router.post('/readlist/lists', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleCreateReadlistList(
      authed.user.id,
      body as {
        householdId?: unknown;
        name?: unknown;
        visibility?: unknown;
        personIds?: unknown;
      },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.patch('/readlist/lists', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleRenameReadlistList(
      authed.user.id,
      body as { listId?: unknown; name?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.delete('/readlist/lists', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleDeleteReadlistList(
      authed.user.id,
      body as { listId?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/items', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleAddReadlistItem(
      authed.user.id,
      body as {
        listId?: unknown;
        workId?: unknown;
        preferredEditionFormat?: unknown;
        status?: unknown;
      },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.patch('/readlist/items', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleUpdateReadlistItem(
      authed.user.id,
      body as {
        itemId?: unknown;
        preferredEditionId?: unknown;
        clearPreferredEdition?: unknown;
      },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.delete('/readlist/items', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleRemoveReadlistItem(
      authed.user.id,
      body as { itemId?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/items/status', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleSetReadlistItemStatus(
      authed.user.id,
      body as { itemId?: unknown; status?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/progress', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleUpsertReadlistProgress(
      authed.user.id,
      body as {
        workId?: unknown;
        editionId?: unknown;
        pagesRead?: unknown;
        percent?: unknown;
        secondsListened?: unknown;
      },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/readlist/reviews', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleUpsertReadlistReview(
      authed.user.id,
      body as { workId?: unknown; score?: unknown; body?: unknown },
      c.req.raw,
    );
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.delete('/readlist/reviews', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleDeleteReadlistReview(
      authed.user.id,
      body as { workId?: unknown },
      c.req.raw,
    );
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
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'Mcp-Session-Id',
      'Last-Event-ID',
      'mcp-protocol-version',
    ],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'],
  }),
);

app.route('/', meals);
app.route('/api', meals);
