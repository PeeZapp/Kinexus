import { parseStoredProviders } from '@kinexus/domain';
import { titleStreamsOn } from '@kinexus/domain';
import { serializeWatchlistProviders } from '@kinexus/domain';
import type { WatchlistMediaType } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { getWatchlistProvider } from './provider.js';

const MAX_USERS_PER_RUN = 120;
const MAX_TITLES_PER_USER = 250;
const MAX_PROVIDER_REFRESHES_PER_RUN = 180;

type WatchlistPrefRow = {
  user_id: string;
  provider_ids: number[];
};

type HouseholdRow = { id: string; country: string | null };

type WatchlistItemRow = { title_id: string; household_id: string; status: string };

type WatchlistTitleRow = {
  id: string;
  household_id: string;
  tmdb_id: number;
  media_type: string;
  title: string;
  providers: unknown;
  providers_country: string | null;
  providers_fetched_at: string | null;
};

type AvailabilityRow = { title_id: string; provider_ids: number[] };

type Result = {
  ok: boolean;
  processedUsers: number;
  processedTitles: number;
  refreshedProviders: number;
  createdAlerts: number;
  skipped?: string;
  lastError?: string;
};

function normalizeCountry(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return 'AU';
}

function isWatchlistMediaType(value: string): value is WatchlistMediaType {
  return value === 'movie' || value === 'tv';
}

function providerSetForOwnedStreamingOffers(providersRaw: unknown, ownedProviderIds: readonly number[]): number[] {
  const owned = new Set(ownedProviderIds.filter((id) => Number.isInteger(id) && id > 0));
  if (owned.size === 0) return [];
  const providers = parseStoredProviders(providersRaw);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const provider of providers) {
    if (provider.offerType !== 'flatrate' && provider.offerType !== 'ads' && provider.offerType !== 'free') continue;
    if (!owned.has(provider.providerId) || seen.has(provider.providerId)) continue;
    seen.add(provider.providerId);
    out.push(provider.providerId);
  }
  return out.sort((a, b) => a - b);
}

function providersNeedRefresh(
  title: Pick<WatchlistTitleRow, 'providers_fetched_at' | 'providers_country'>,
  country: string,
  now = Date.now(),
): boolean {
  const fetchedAt = title.providers_fetched_at;
  if (!fetchedAt) return true;
  if ((title.providers_country ?? '').toUpperCase() !== country.toUpperCase()) return true;
  const fetched = Date.parse(fetchedAt);
  if (!Number.isFinite(fetched)) return true;
  return now - fetched > 12 * 60 * 60 * 1000;
}

async function loadTargetUsers(admin: SupabaseClient): Promise<WatchlistPrefRow[]> {
  const { data, error } = await admin
    .from('user_watchlist_prefs')
    .select('user_id, provider_ids')
    .neq('provider_ids', '{}')
    .limit(MAX_USERS_PER_RUN);
  if (error) throw error;
  return (data ?? []) as WatchlistPrefRow[];
}

async function householdIdsForUser(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin.from('household_members').select('household_id').eq('user_id', userId);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.household_id).filter(Boolean))];
}

async function loadHouseholds(admin: SupabaseClient, householdIds: readonly string[]): Promise<Map<string, HouseholdRow>> {
  const map = new Map<string, HouseholdRow>();
  if (householdIds.length === 0) return map;
  const { data, error } = await admin.from('households').select('id, country').in('id', [...householdIds]);
  if (error) throw error;
  for (const row of (data ?? []) as HouseholdRow[]) {
    map.set(row.id, row);
  }
  return map;
}

async function loadUserDisabledWatchlistAlerts(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from('user_alert_prefs')
    .select('household_id')
    .eq('user_id', userId)
    .eq('segment', 'watchlist_available')
    .eq('enabled', false);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.household_id).filter(Boolean));
}

async function loadUserTitleIds(
  admin: SupabaseClient,
  householdIds: readonly string[],
): Promise<WatchlistItemRow[]> {
  if (householdIds.length === 0) return [];
  const { data, error } = await admin
    .from('watchlist_items')
    .select('title_id, household_id, status')
    .in('household_id', [...householdIds])
    .in('status', ['want', 'watching'])
    .limit(MAX_TITLES_PER_USER * 2);
  if (error) throw error;
  return (data ?? []) as WatchlistItemRow[];
}

async function loadTitles(admin: SupabaseClient, titleIds: readonly string[]): Promise<WatchlistTitleRow[]> {
  if (titleIds.length === 0) return [];
  const chunk = 200;
  const out: WatchlistTitleRow[] = [];
  for (let i = 0; i < titleIds.length; i += chunk) {
    const slice = titleIds.slice(i, i + chunk);
    const { data, error } = await admin
      .from('watchlist_titles')
      .select('id, household_id, tmdb_id, media_type, title, providers, providers_country, providers_fetched_at')
      .in('id', slice);
    if (error) throw error;
    out.push(...((data ?? []) as WatchlistTitleRow[]));
  }
  return out;
}

async function loadAvailability(
  admin: SupabaseClient,
  userId: string,
  titleIds: readonly string[],
): Promise<Map<string, AvailabilityRow>> {
  const map = new Map<string, AvailabilityRow>();
  if (titleIds.length === 0) return map;
  const chunk = 200;
  for (let i = 0; i < titleIds.length; i += chunk) {
    const slice = titleIds.slice(i, i + chunk);
    const { data, error } = await admin
      .from('user_watchlist_availability')
      .select('title_id, provider_ids')
      .eq('user_id', userId)
      .in('title_id', slice);
    if (error) throw error;
    for (const row of (data ?? []) as AvailabilityRow[]) {
      map.set(row.title_id, row);
    }
  }
  return map;
}

async function refreshProvidersIfNeeded(
  admin: SupabaseClient,
  title: WatchlistTitleRow,
  country: string,
  provider: ReturnType<typeof getWatchlistProvider>,
): Promise<{ refreshed: boolean; title: WatchlistTitleRow }> {
  if (!providersNeedRefresh(title, country)) return { refreshed: false, title };
  const mediaType = isWatchlistMediaType(title.media_type) ? title.media_type : null;
  if (!mediaType) return { refreshed: false, title };
  const resolved = await provider.lookupWatchlistTitle({ tmdbId: title.tmdb_id, mediaType, country });
  const serialized = serializeWatchlistProviders(resolved.providers);
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from('watchlist_titles')
    .update({
      providers: serialized as unknown,
      providers_country: resolved.providersCountry,
      providers_fetched_at: nowIso,
    })
    .eq('id', title.id);
  if (error) throw error;
  return {
    refreshed: true,
    title: {
      ...title,
      providers: serialized,
      providers_country: resolved.providersCountry,
      providers_fetched_at: nowIso,
    },
  };
}

async function insertWatchlistAvailableAlert(admin: SupabaseClient, input: {
  userId: string;
  householdId: string;
  titleId: string;
  title: string;
  providerIds: number[];
}): Promise<void> {
  const providersLabel = input.providerIds.slice(0, 3).join(', ');
  const body = input.providerIds.length > 0 ? `Now streaming · ${providersLabel}` : null;
  const { error } = await admin.from('user_alerts').insert({
    user_id: input.userId,
    household_id: input.householdId,
    actor_user_id: null,
    segment: 'watchlist_available',
    title: input.title.slice(0, 160),
    body,
    href: '/lists/watchlist',
    payload: { titleId: input.titleId, providerIds: input.providerIds } as unknown,
  });
  if (error) throw error;
}

async function upsertAvailability(admin: SupabaseClient, input: {
  userId: string;
  titleId: string;
  providerIds: number[];
}): Promise<void> {
  const { error } = await admin.from('user_watchlist_availability').upsert(
    {
      user_id: input.userId,
      title_id: input.titleId,
      provider_ids: input.providerIds,
    },
    { onConflict: 'user_id,title_id' },
  );
  if (error) throw error;
}

export async function runWatchlistAvailabilityCheck(admin: SupabaseClient): Promise<Result> {
  const prefs = await loadTargetUsers(admin);
  if (prefs.length === 0) {
    return {
      ok: true,
      processedUsers: 0,
      processedTitles: 0,
      refreshedProviders: 0,
      createdAlerts: 0,
      skipped: 'No users with provider_ids configured',
    };
  }

  const provider = getWatchlistProvider(null, { mcp: true });
  let refreshedProviders = 0;
  let createdAlerts = 0;
  let processedTitles = 0;

  for (const pref of prefs) {
    const userId = pref.user_id;
    const ownedProviderIds = Array.isArray(pref.provider_ids) ? pref.provider_ids : [];
    if (ownedProviderIds.length === 0) continue;

    const householdIds = await householdIdsForUser(admin, userId);
    if (householdIds.length === 0) continue;
    const disabledHouseholds = await loadUserDisabledWatchlistAlerts(admin, userId);
    const householdsById = await loadHouseholds(admin, householdIds);

    const items = await loadUserTitleIds(admin, householdIds);
    const uniqueTitleIds: string[] = [];
    const seen = new Set<string>();
    for (const row of items) {
      if (!row.title_id || seen.has(row.title_id)) continue;
      seen.add(row.title_id);
      uniqueTitleIds.push(row.title_id);
      if (uniqueTitleIds.length >= MAX_TITLES_PER_USER) break;
    }
    if (uniqueTitleIds.length === 0) continue;

    const titles = await loadTitles(admin, uniqueTitleIds);
    const availability = await loadAvailability(admin, userId, uniqueTitleIds);

    for (const title of titles) {
      processedTitles += 1;

      if (disabledHouseholds.has(title.household_id)) {
        await upsertAvailability(admin, { userId, titleId: title.id, providerIds: [] });
        continue;
      }

      const household = householdsById.get(title.household_id);
      const country = normalizeCountry(household?.country);

      let nextTitle = title;
      if (refreshedProviders < MAX_PROVIDER_REFRESHES_PER_RUN) {
        const refreshed = await refreshProvidersIfNeeded(admin, title, country, provider);
        if (refreshed.refreshed) refreshedProviders += 1;
        nextTitle = refreshed.title;
      }

      const streamingOwned = providerSetForOwnedStreamingOffers(nextTitle.providers, ownedProviderIds);
      const prev = availability.get(nextTitle.id)?.provider_ids ?? [];
      const prevHad = prev.length > 0;
      const nowHas = streamingOwned.length > 0;

      // Guard: providers JSON could be in an unexpected shape; treat as not available.
      const providerHit = titleStreamsOn(parseStoredProviders(nextTitle.providers), ownedProviderIds);
      const safeNowHas = nowHas && providerHit;

      if (!prevHad && safeNowHas) {
        await insertWatchlistAvailableAlert(admin, {
          userId,
          householdId: nextTitle.household_id,
          titleId: nextTitle.id,
          title: nextTitle.title,
          providerIds: streamingOwned,
        });
        createdAlerts += 1;
      }

      await upsertAvailability(admin, { userId, titleId: nextTitle.id, providerIds: safeNowHas ? streamingOwned : [] });
    }
  }

  return {
    ok: true,
    processedUsers: prefs.length,
    processedTitles,
    refreshedProviders,
    createdAlerts,
  };
}

export async function handleWatchlistAvailabilityCheck(
  request: Request,
): Promise<{ status: number; body: Result | { error: string } }> {
  if (!cronAuthorized(request)) return { status: 401, body: { error: 'Unauthorized' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Watchlist availability check is not configured' } };
  }
  try {
    const admin = createServiceClient();
    const result = await runWatchlistAvailabilityCheck(admin);
    return { status: 200, body: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Watchlist availability check failed';
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}

