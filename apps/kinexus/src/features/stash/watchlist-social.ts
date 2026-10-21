import {
  canViewAudience,
  familyReviewAverage,
  funnyAliasFromSeed,
  type WatchlistAudience,
  type WatchlistGlobalReview,
  type WatchlistMediaType,
  type WatchlistPublicWatched,
} from '@kinexus/domain';

import { watchlistListFromRow } from '@/src/features/stash/watchlist-mappers';
import { supabase } from '@/src/lib/supabase';

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function ensureSocialAlias(userId: string): Promise<string> {
  if (!supabase) throw new Error('Not ready');
  const { data: existing, error } = await supabase
    .from('watchlist_social_aliases')
    .select('alias')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  if (existing?.alias) return existing.alias;
  const alias = funnyAliasFromSeed(userId);
  const { error: insertError } = await supabase.from('watchlist_social_aliases').insert({ user_id: userId, alias });
  if (insertError) {
    const again = await supabase.from('watchlist_social_aliases').select('alias').eq('user_id', userId).maybeSingle();
    if (again.data?.alias) return again.data.alias;
    throw new Error(insertError.message);
  }
  return alias;
}

export type GlobalSharedListCard = {
  id: string;
  name: string;
  blurb: string | null;
  audience: string;
  samplePosterPaths: string[];
  itemCount: number;
  createdBy: string | null;
  alias: string;
  averageScore: number | null;
  ratingCount: number;
  myScore: number | null;
};

async function listRatingsSummary(listIds: string[], viewerId: string | null) {
  if (!supabase || listIds.length === 0) {
    return new Map<string, { average: number | null; count: number; mine: number | null }>();
  }
  const { data, error } = await supabase.from('watchlist_global_list_ratings').select('*').in('list_id', listIds);
  throwIfError(error);
  const map = new Map<string, { average: number | null; count: number; mine: number | null }>();
  for (const id of listIds) map.set(id, { average: null, count: 0, mine: null });
  const byList = new Map<string, number[]>();
  for (const row of data ?? []) {
    const scores = byList.get(row.list_id) ?? [];
    scores.push(row.score);
    byList.set(row.list_id, scores);
    if (viewerId && row.user_id === viewerId) {
      const current = map.get(row.list_id)!;
      current.mine = row.score;
    }
  }
  for (const [listId, scores] of byList) {
    const sum = scores.reduce((acc, score) => acc + score, 0);
    map.set(listId, {
      average: Math.round((sum / scores.length) * 10) / 10,
      count: scores.length,
      mine: map.get(listId)?.mine ?? null,
    });
  }
  return map;
}

export async function fetchGlobalSharedCards(input: {
  viewerId: string | null;
  createdBy?: string | null;
}): Promise<GlobalSharedListCard[]> {
  if (!supabase) return [];
  let query = supabase
    .from('watchlist_lists')
    .select('*')
    .eq('visibility', 'global')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (input.createdBy) query = query.eq('created_by', input.createdBy);
  const { data, error } = await query;
  throwIfError(error);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const listIds = rows.map((row) => row.id);
  const userIds = [...new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
  const [{ data: items }, { data: aliases }, ratings] = await Promise.all([
    supabase.from('watchlist_items').select('list_id').in('list_id', listIds),
    userIds.length
      ? supabase.from('watchlist_social_aliases').select('user_id, alias').in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; alias: string }[] }),
    listRatingsSummary(listIds, input.viewerId),
  ]);
  const countByList = new Map<string, number>();
  for (const item of items ?? []) {
    countByList.set(item.list_id, (countByList.get(item.list_id) ?? 0) + 1);
  }
  const aliasByUser = new Map((aliases ?? []).map((row) => [row.user_id, row.alias]));
  return rows.map((row) => {
    const list = watchlistListFromRow(row);
    const rating = ratings.get(row.id);
    return {
      id: list.id,
      name: list.name,
      blurb: list.blurb,
      audience: list.audience,
      samplePosterPaths: list.samplePosterPaths,
      itemCount: countByList.get(list.id) ?? 0,
      createdBy: list.createdBy,
      alias: list.createdBy
        ? (aliasByUser.get(list.createdBy) ?? funnyAliasFromSeed(list.createdBy))
        : 'Mystery Viewer',
      averageScore: rating?.average ?? null,
      ratingCount: rating?.count ?? 0,
      myScore: rating?.mine ?? null,
    };
  });
}

export async function rateGlobalList(input: { listId: string; userId: string; score: number }): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  await ensureSocialAlias(input.userId);
  const { error } = await supabase.from('watchlist_global_list_ratings').upsert(
    { list_id: input.listId, user_id: input.userId, score: input.score },
    { onConflict: 'list_id,user_id' },
  );
  throwIfError(error);
}

export async function fetchGlobalLists() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('watchlist_lists')
    .select('*')
    .eq('visibility', 'global')
    .order('updated_at', { ascending: false })
    .limit(60);
  throwIfError(error);
  return data ?? [];
}

export async function fetchGlobalListBundle(listId: string) {
  if (!supabase) return { list: null, items: [], titles: [] };
  const { data: list, error } = await supabase.from('watchlist_lists').select('*').eq('id', listId).maybeSingle();
  throwIfError(error);
  if (!list || list.visibility !== 'global') return { list: null, items: [], titles: [] };
  const { data: items, error: itemsError } = await supabase.from('watchlist_items').select('*').eq('list_id', listId);
  throwIfError(itemsError);
  const titleIds = (items ?? []).map((item) => item.title_id);
  if (titleIds.length === 0) return { list, items: items ?? [], titles: [] };
  const { data: titles, error: titlesError } = await supabase.from('watchlist_titles').select('*').in('id', titleIds);
  throwIfError(titlesError);
  return { list, items: items ?? [], titles: titles ?? [] };
}

export async function fetchGlobalReviewsForTitle(
  tmdbId: number,
  mediaType: WatchlistMediaType,
  viewerId: string | null,
): Promise<{ average: number | null; reviews: WatchlistGlobalReview[] }> {
  if (!supabase) return { average: null, reviews: [] };
  const { data: rows, error } = await supabase
    .from('watchlist_global_reviews')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .order('updated_at', { ascending: false })
    .limit(80);
  throwIfError(error);
  const reviews = rows ?? [];
  if (reviews.length === 0) return { average: null, reviews: [] };
  const userIds = [...new Set(reviews.map((row) => row.user_id))];
  const { data: aliases } = await supabase.from('watchlist_social_aliases').select('user_id, alias').in('user_id', userIds);
  const aliasByUser = new Map((aliases ?? []).map((row) => [row.user_id, row.alias]));
  const reviewIds = reviews.map((row) => row.id);
  const { data: votes } = await supabase.from('watchlist_global_review_votes').select('*').in('review_id', reviewIds);
  const voteRows = votes ?? [];
  const mapped: WatchlistGlobalReview[] = reviews.map((row) => {
    const forReview = voteRows.filter((vote) => vote.review_id === row.id);
    const mine = viewerId ? forReview.find((vote) => vote.user_id === viewerId) : null;
    return {
      id: row.id,
      userId: row.user_id,
      alias: aliasByUser.get(row.user_id) ?? funnyAliasFromSeed(row.user_id),
      tmdbId: row.tmdb_id,
      mediaType: row.media_type,
      title: row.title,
      year: row.year,
      posterPath: row.poster_path,
      score: row.score,
      body: row.body,
      upvotes: forReview.filter((vote) => vote.vote === 1).length,
      downvotes: forReview.filter((vote) => vote.vote === -1).length,
      myVote: mine?.vote === 1 ? 1 : mine?.vote === -1 ? -1 : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
  return { average: familyReviewAverage(mapped.map((review) => review.score)), reviews: mapped };
}

function mapReviewRow(
  row: {
    id: string;
    user_id: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string | null;
    year: number | null;
    poster_path: string | null;
    score: number;
    body: string | null;
    created_at: string;
    updated_at: string;
  },
  alias: string,
  voteRows: { review_id: string; user_id: string; vote: number }[],
  viewerId: string | null,
): WatchlistGlobalReview {
  const forReview = voteRows.filter((vote) => vote.review_id === row.id);
  const mine = viewerId ? forReview.find((vote) => vote.user_id === viewerId) : null;
  return {
    id: row.id,
    userId: row.user_id,
    alias,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    score: row.score,
    body: row.body,
    upvotes: forReview.filter((vote) => vote.vote === 1).length,
    downvotes: forReview.filter((vote) => vote.vote === -1).length,
    myVote: mine?.vote === 1 ? 1 : mine?.vote === -1 ? -1 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchGlobalReviewsByUser(userId: string, viewerId: string | null): Promise<WatchlistGlobalReview[]> {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from('watchlist_global_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  const reviews = rows ?? [];
  if (reviews.length === 0) return [];
  const { data: aliasRow } = await supabase.from('watchlist_social_aliases').select('alias').eq('user_id', userId).maybeSingle();
  const alias = aliasRow?.alias ?? funnyAliasFromSeed(userId);
  const reviewIds = reviews.map((row) => row.id);
  const { data: votes } = await supabase.from('watchlist_global_review_votes').select('*').in('review_id', reviewIds);
  const voteRows = votes ?? [];
  return reviews.map((row) => mapReviewRow(row, alias, voteRows, viewerId));
}

export async function upsertPublicWatched(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  score?: number | null;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  await ensureSocialAlias(input.userId);
  const { error } = await supabase.from('watchlist_public_watched').upsert(
    {
      user_id: input.userId,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      title: input.title.trim(),
      year: input.year,
      poster_path: input.posterPath,
      score: input.score ?? null,
    },
    { onConflict: 'user_id,tmdb_id,media_type' },
  );
  throwIfError(error);
}

export async function clearPublicWatchedScore(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  const { error } = await supabase
    .from('watchlist_public_watched')
    .update({ score: null })
    .eq('user_id', input.userId)
    .eq('tmdb_id', input.tmdbId)
    .eq('media_type', input.mediaType);
  throwIfError(error);
}

export async function removePublicWatched(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  const { error } = await supabase
    .from('watchlist_public_watched')
    .delete()
    .eq('user_id', input.userId)
    .eq('tmdb_id', input.tmdbId)
    .eq('media_type', input.mediaType);
  throwIfError(error);
}

export type WatchlistSocialProfile = {
  userId: string;
  alias: string;
  lists: GlobalSharedListCard[];
  watched: WatchlistPublicWatched[];
  reviews: WatchlistGlobalReview[];
};

export async function fetchWatchlistSocialProfile(input: {
  userId: string;
  viewerId: string | null;
  allowedAudience: WatchlistAudience;
}): Promise<WatchlistSocialProfile> {
  if (!supabase) {
    return { userId: input.userId, alias: funnyAliasFromSeed(input.userId), lists: [], watched: [], reviews: [] };
  }
  const [{ data: aliasRow }, lists, reviews, { data: watchedRows, error: watchedError }] = await Promise.all([
    supabase.from('watchlist_social_aliases').select('alias').eq('user_id', input.userId).maybeSingle(),
    fetchGlobalSharedCards({ viewerId: input.viewerId, createdBy: input.userId }),
    fetchGlobalReviewsByUser(input.userId, input.viewerId),
    supabase
      .from('watchlist_public_watched')
      .select('*')
      .eq('user_id', input.userId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);
  throwIfError(watchedError);
  const watched: WatchlistPublicWatched[] = (watchedRows ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    score: row.score,
    updatedAt: row.updated_at,
  }));
  return {
    userId: input.userId,
    alias: aliasRow?.alias ?? lists[0]?.alias ?? funnyAliasFromSeed(input.userId),
    lists: lists.filter((list) => canViewAudience(input.allowedAudience, list.audience as WatchlistAudience)),
    watched,
    reviews,
  };
}

export async function saveGlobalReview(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
  score: number;
  body: string;
  title?: string | null;
  year?: number | null;
  posterPath?: string | null;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  await ensureSocialAlias(input.userId);
  const body = input.body.trim() || null;
  const title = input.title?.trim() || null;
  const patch = {
    score: input.score,
    body,
    title,
    year: input.year ?? null,
    poster_path: input.posterPath ?? null,
  };
  const { data: existing, error } = await supabase
    .from('watchlist_global_reviews')
    .select('id')
    .eq('user_id', input.userId)
    .eq('tmdb_id', input.tmdbId)
    .eq('media_type', input.mediaType)
    .maybeSingle();
  throwIfError(error);
  if (existing?.id) {
    const { error: updateError } = await supabase.from('watchlist_global_reviews').update(patch).eq('id', existing.id);
    throwIfError(updateError);
  } else {
    const { error: insertError } = await supabase.from('watchlist_global_reviews').insert({
      user_id: input.userId,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      ...patch,
    });
    throwIfError(insertError);
  }
  if (title) {
    await upsertPublicWatched({
      userId: input.userId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      title,
      year: input.year ?? null,
      posterPath: input.posterPath ?? null,
      score: input.score,
    });
  }
}

export async function deleteGlobalReview(reviewId: string): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  const { error } = await supabase.from('watchlist_global_reviews').delete().eq('id', reviewId);
  throwIfError(error);
}

export async function deleteGlobalReviewForTitle(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  const { error } = await supabase
    .from('watchlist_global_reviews')
    .delete()
    .eq('user_id', input.userId)
    .eq('tmdb_id', input.tmdbId)
    .eq('media_type', input.mediaType);
  throwIfError(error);
}

export async function isTitleOnPublicProfile(input: {
  userId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<boolean> {
  if (!supabase) return false;
  const [{ data: watched, error: watchedError }, { data: review, error: reviewError }] = await Promise.all([
    supabase
      .from('watchlist_public_watched')
      .select('id')
      .eq('user_id', input.userId)
      .eq('tmdb_id', input.tmdbId)
      .eq('media_type', input.mediaType)
      .maybeSingle(),
    supabase
      .from('watchlist_global_reviews')
      .select('id')
      .eq('user_id', input.userId)
      .eq('tmdb_id', input.tmdbId)
      .eq('media_type', input.mediaType)
      .maybeSingle(),
  ]);
  throwIfError(watchedError);
  throwIfError(reviewError);
  return Boolean(watched?.id || review?.id);
}

export async function voteGlobalReview(input: {
  userId: string;
  reviewId: string;
  vote: -1 | 1;
}): Promise<void> {
  if (!supabase) throw new Error('Not ready');
  const { data: existing, error } = await supabase
    .from('watchlist_global_review_votes')
    .select('vote')
    .eq('review_id', input.reviewId)
    .eq('user_id', input.userId)
    .maybeSingle();
  throwIfError(error);
  if (existing?.vote === input.vote) {
    const { error: delError } = await supabase
      .from('watchlist_global_review_votes')
      .delete()
      .eq('review_id', input.reviewId)
      .eq('user_id', input.userId);
    throwIfError(delError);
    return;
  }
  const { error: upsertError } = await supabase.from('watchlist_global_review_votes').upsert(
    { review_id: input.reviewId, user_id: input.userId, vote: input.vote },
    { onConflict: 'review_id,user_id' },
  );
  throwIfError(upsertError);
}
