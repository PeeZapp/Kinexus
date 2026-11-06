import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

export type SharedWatchlistTitle = {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number | null;
  posterPath: string | null;
};

export type SharedWatchlistPayload = {
  name: string;
  ownerUsername: string | null;
  titles: SharedWatchlistTitle[];
};

export type SharedWatchlistLinkDeps = {
  isConfigured: () => boolean;
  createClient: () => ReturnType<typeof createServiceClient>;
};

const defaultDeps: SharedWatchlistLinkDeps = {
  isConfigured: isServiceRoleConfigured,
  createClient: createServiceClient,
};

function asUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function handleGetSharedWatchlist(
  token: string,
  deps: SharedWatchlistLinkDeps = defaultDeps,
): Promise<{ status: number; body: SharedWatchlistPayload | { error: string } }> {
  const trimmed = token.trim();
  if (!trimmed) return { status: 400, body: { error: 'Share token required' } };
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'Shared watchlists are not configured' } };
  }

  const client = deps.createClient();
  const { data: list, error: listError } = await client
    .from('watchlist_lists')
    .select('id, name, created_by, is_shared, kind')
    .eq('share_token', trimmed)
    .eq('is_shared', true)
    .maybeSingle();

  if (listError) return { status: 500, body: { error: listError.message } };
  if (!list || list.kind !== 'custom') {
    return { status: 404, body: { error: 'List not found or not shared' } };
  }

  let ownerUsername: string | null = null;
  if (list.created_by) {
    const { data: profiles } = await client.rpc('public_profiles', { p_ids: [list.created_by] });
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    ownerUsername = asUsername(profile?.username) ?? asUsername(profile?.global_handle);
  }

  const { data: items, error: itemsError } = await client
    .from('watchlist_items')
    .select('title_id')
    .eq('list_id', list.id);
  if (itemsError) return { status: 500, body: { error: itemsError.message } };

  const titleIds = [...new Set((items ?? []).map((row) => row.title_id))];
  if (titleIds.length === 0) {
    return { status: 200, body: { name: list.name, ownerUsername, titles: [] } };
  }

  const { data: titles, error: titlesError } = await client
    .from('watchlist_titles')
    .select('tmdb_id, media_type, title, year, poster_path')
    .in('id', titleIds);
  if (titlesError) return { status: 500, body: { error: titlesError.message } };

  const mapped: SharedWatchlistTitle[] = (titles ?? [])
    .map((row) => {
      const mediaType: 'movie' | 'tv' = row.media_type === 'tv' ? 'tv' : 'movie';
      return {
        tmdbId: row.tmdb_id,
        mediaType,
        title: row.title,
        year: row.year,
        posterPath: row.poster_path,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    status: 200,
    body: {
      name: list.name,
      ownerUsername,
      titles: mapped,
    },
  };
}
