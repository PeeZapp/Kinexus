import {
  isWatchAdult,
  isWatchlistMediaType,
  isWatchlistScore,
  maxAllowedCertification,
  mergePeopleTaste,
  watchlistTitleKey,
  type AuCertification,
  type MergedPeopleTaste,
  type PeopleTasteRating,
  type WatchlistMediaType,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createUserClient, readBearerToken } from './auth.js';

export type WatchlistWatchingContext = {
  personIds: string[];
  maxCertification: AuCertification;
  allowMissingCertification: boolean;
  taste: MergedPeopleTaste;
  watchedKeys: Set<string>;
  dislikedKeys: Set<string>;
};

type PersonRow = {
  id: string;
  birthday: string | null;
  person_type: 'adult' | 'child' | 'other';
  household_id: string;
};

type ReviewRow = {
  person_id: string;
  score: number;
  watchlist_titles:
    | { tmdb_id: number; media_type: string }
    | { tmdb_id: number; media_type: string }[]
    | null;
};

type WatchedRow = {
  status: string;
  watchlist_titles:
    | { tmdb_id: number; media_type: string }
    | { tmdb_id: number; media_type: string }[]
    | null;
};

function asTitle(
  value: ReviewRow['watchlist_titles'] | WatchedRow['watchlist_titles'],
): { tmdbId: number; mediaType: WatchlistMediaType } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  const tmdbId = Number(row.tmdb_id);
  const mediaType = typeof row.media_type === 'string' ? row.media_type : '';
  if (!isWatchlistMediaType(mediaType) || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return { tmdbId, mediaType };
}

export function parsePersonIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (typeof row !== 'string') continue;
    const id = row.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 24) break;
  }
  return ids;
}

export async function loadWatchlistWatchingContext(
  request: Request,
  personIds: readonly string[],
): Promise<WatchlistWatchingContext | { error: string; status: 400 | 401 | 500 }> {
  if (personIds.length === 0) {
    return { error: 'personIds required', status: 400 };
  }
  const token = readBearerToken(request);
  if (!token) return { error: 'Sign in required', status: 401 };
  let client: SupabaseClient;
  try {
    client = createUserClient(token);
  } catch {
    return { error: 'API auth is not configured', status: 500 };
  }

  const { data: people, error: peopleError } = await client
    .from('household_people')
    .select('id, birthday, person_type, household_id')
    .in('id', [...personIds]);
  if (peopleError) return { error: 'Could not load household people', status: 500 };
  const rows = (people ?? []) as PersonRow[];
  if (rows.length === 0) return { error: 'Those people are not in your household', status: 400 };

  const householdIds = [...new Set(rows.map((row) => row.household_id))];
  if (householdIds.length !== 1) {
    return { error: 'Pick people from one household', status: 400 };
  }
  const householdId = householdIds[0]!;
  const selectedIds = rows.map((row) => row.id);

  const [{ data: reviews }, { data: watched }] = await Promise.all([
    client
      .from('watchlist_reviews')
      .select('person_id, score, watchlist_titles(tmdb_id, media_type)')
      .eq('household_id', householdId)
      .in('person_id', selectedIds),
    client
      .from('watchlist_items')
      .select('status, watchlist_titles(tmdb_id, media_type)')
      .eq('household_id', householdId)
      .eq('status', 'watched'),
  ]);

  const ratings: PeopleTasteRating[] = [];
  for (const review of (reviews ?? []) as ReviewRow[]) {
    if (!isWatchlistScore(Number(review.score))) continue;
    const title = asTitle(review.watchlist_titles);
    if (!title) continue;
    ratings.push({
      personId: review.person_id,
      tmdbId: title.tmdbId,
      mediaType: title.mediaType,
      score: Number(review.score),
    });
  }

  const taste = mergePeopleTaste(
    selectedIds.map((id) => ({ id })),
    ratings,
  );
  const watchedKeys = new Set<string>();
  for (const item of (watched ?? []) as WatchedRow[]) {
    const title = asTitle(item.watchlist_titles);
    if (!title) continue;
    watchedKeys.add(watchlistTitleKey(title.mediaType, title.tmdbId));
  }
  const dislikedKeys = new Set(
    taste.dislikedTitles.map((row) => watchlistTitleKey(row.mediaType, row.tmdbId)),
  );

  return {
    personIds: selectedIds,
    maxCertification: maxAllowedCertification(
      rows.map((row) => ({ birthday: row.birthday, personType: row.person_type })),
    ),
    allowMissingCertification: rows.every((row) =>
      isWatchAdult({ birthday: row.birthday, personType: row.person_type }),
    ),
    taste,
    watchedKeys,
    dislikedKeys,
  };
}
