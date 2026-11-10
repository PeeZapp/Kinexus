import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canEditList,
  canManageWatchlist,
  canViewList,
  canViewWatchlist,
  normalizeCountryCode,
  serializeWatchlistProviders,
  type HouseholdRole,
  type StashList,
  type WatchedScope,
  type WatchlistList,
  type WatchlistResolvedTitle,
} from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import {
  resolveCallerHousehold,
  withMcpAudit,
  type CallerHousehold,
} from '../meals/shared.js';

export const WATCHLIST_NOT_FOUND = 'Watchlist not found';
export const WATCHLIST_ITEM_NOT_FOUND = 'Watchlist item not found';
export const WISHLIST_NOT_FOUND = 'Wishlist not found';
export const WISHLIST_ITEM_NOT_FOUND = 'Wishlist item not found';
export const TITLE_NOT_FOUND = 'Title not found';
export const WRITE_DENIED = 'You cannot change this list';

export { resolveCallerHousehold, withMcpAudit };
export type { CallerHousehold };

const ROLE_SET = new Set<string>(['owner', 'admin', 'adult', 'teen', 'child']);

export function asHouseholdRole(role: string): HouseholdRole | null {
  return ROLE_SET.has(role) ? (role as HouseholdRole) : null;
}

export async function resolveCallerPersonId(
  client: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('household_people')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function resolveCallerCountry(client: SupabaseClient, householdId: string): Promise<string> {
  const { data, error } = await client.from('households').select('country').eq('id', householdId).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeCountryCode(typeof data?.country === 'string' ? data.country : 'AU');
}

export type AccessOpts = {
  role: HouseholdRole | null;
  userId: string;
  personId: string | null;
};

export function accessOpts(role: string, userId: string, personId: string | null): AccessOpts {
  return { role: asHouseholdRole(role), userId, personId };
}

export function assertCanViewWatchlist(list: WatchlistList, opts: AccessOpts): void {
  if (!canViewWatchlist(list, opts)) throw new Error(WATCHLIST_NOT_FOUND);
}

export function assertCanManageWatchlist(list: WatchlistList, opts: AccessOpts): void {
  if (!canViewWatchlist(list, opts)) throw new Error(WATCHLIST_NOT_FOUND);
  if (!canManageWatchlist(list, opts)) throw new Error(WRITE_DENIED);
}

export function assertCanViewWishlist(list: Pick<StashList, 'createdBy' | 'visibility' | 'personIds'>, opts: AccessOpts): void {
  if (!canViewList(list, opts)) throw new Error(WISHLIST_NOT_FOUND);
}

export function assertCanEditWishlist(list: Pick<StashList, 'createdBy' | 'visibility' | 'personIds'>, opts: AccessOpts): void {
  if (!canViewList(list, opts)) throw new Error(WISHLIST_NOT_FOUND);
  if (!canEditList(list, opts)) throw new Error(WRITE_DENIED);
}

export function titleFieldsFromResolved(resolved: WatchlistResolvedTitle) {
  return {
    title: resolved.title,
    year: resolved.year,
    overview: resolved.overview,
    poster_path: resolved.posterPath,
    backdrop_path: resolved.backdropPath,
    imdb_id: resolved.imdbId,
    source_url: resolved.sourceUrl,
    tmdb_watch_url: resolved.tmdbWatchUrl,
    trailer_url: resolved.trailerUrl,
    content_rating: resolved.contentRating,
    audience: resolved.audience,
    providers: serializeWatchlistProviders(resolved.providers),
    providers_country: resolved.providersCountry,
    providers_fetched_at: new Date().toISOString(),
  };
}

export function storeNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Unknown store';
  } catch {
    return 'Unknown store';
  }
}

export function parseWatchedScope(value: string): WatchedScope {
  if (value === 'family' || value === 'private') return value;
  throw new Error('scope must be family or private');
}

export async function withListsAudit<T>(
  caller: McpCaller,
  opts: { tool: string; mode: 'read' | 'write'; householdId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  return withMcpAudit(caller, opts, run);
}

export const URL_CHECK_TIMEOUT_MS = 8_000;

/** HEAD then GET; returns true when the URL responds with a non-5xx status. */
export async function urlIsReachable(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);
  try {
    const head = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (head.status > 0 && head.status < 500) return true;
  } catch {
    // fall through to GET
  } finally {
    clearTimeout(timer);
  }

  const getController = new AbortController();
  const getTimer = setTimeout(() => getController.abort(), URL_CHECK_TIMEOUT_MS);
  try {
    const get = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: getController.signal,
      headers: { Range: 'bytes=0-0' },
    });
    return get.status > 0 && get.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(getTimer);
  }
}
