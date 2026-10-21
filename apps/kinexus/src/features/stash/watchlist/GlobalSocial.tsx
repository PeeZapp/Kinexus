import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  WATCHLIST_GLOBAL_LIST_HIGH_SCORE,
  audienceLabel,
  canViewAudience,
  tmdbImageUrl,
  type WatchlistAudience,
  type WatchlistGlobalReview,
  type WatchlistMediaType,
  type WatchlistTitle,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { Sheet } from '@/src/features/meals/meals-kit';
import {
  deleteGlobalReview,
  fetchGlobalListBundle,
  fetchGlobalReviewsForTitle,
  fetchGlobalSharedCards,
  rateGlobalList,
  voteGlobalReview,
  type GlobalSharedListCard,
} from '@/src/features/stash/watchlist-social';
import { watchlistTitleFromRow } from '@/src/features/stash/watchlist-mappers';
import { WatchlistSocialProfileSheet } from '@/src/features/stash/watchlist/WatchlistSocialProfile';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type ShelfFilter = 'all' | 'high';

function SharedListCard({
  card,
  wide,
  onPress,
  onOpenAuthor,
}: {
  card: GlobalSharedListCard;
  wide?: boolean;
  onPress: () => void;
  onOpenAuthor: () => void;
}) {
  const posters = card.samplePosterPaths.slice(0, 4);
  while (posters.length < 4) posters.push('');
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.strip}>
        {posters.map((path, index) => {
          const uri = path ? tmdbImageUrl(path, 'w185') : null;
          return uri ? (
            <Image key={`${card.id}-${path}-${index}`} source={{ uri }} style={styles.stripPoster} />
          ) : (
            <View key={`${card.id}-empty-${index}`} style={styles.stripPoster} />
          );
        })}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {card.itemCount} titles
          {card.averageScore != null ? ` · ${card.averageScore}/10` : ''}
          {` · ${audienceLabel(card.audience as WatchlistAudience)}`}
          {card.blurb ? ` · ${card.blurb}` : ''}
        </Text>
        <Pressable onPress={onOpenAuthor}>
          <Text style={styles.includes} numberOfLines={1}>
            by {card.alias}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function GlobalListsSection({
  allowedAudience,
  viewerId,
  wide,
  onOpen,
}: {
  allowedAudience: WatchlistAudience;
  viewerId: string | null;
  wide?: boolean;
  onOpen: (id: string) => void;
}) {
  const [cards, setCards] = useState<GlobalSharedListCard[]>([]);
  const [filter, setFilter] = useState<ShelfFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ userId: string; alias: string } | null>(null);

  const reload = useCallback(async () => {
    const rows = await fetchGlobalSharedCards({ viewerId });
    setCards(rows.filter((card) => canViewAudience(allowedAudience, card.audience as WatchlistAudience)));
  }, [allowedAudience, viewerId]);

  useEffect(() => {
    let cancelled = false;
    void reload()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load shared lists');
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const visible = useMemo(() => {
    if (filter === 'high') {
      return cards.filter(
        (card) => card.averageScore != null && card.averageScore >= WATCHLIST_GLOBAL_LIST_HIGH_SCORE,
      );
    }
    return cards;
  }, [cards, filter]);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.kicker}>Shared with everyone</Text>
        <Text style={styles.blurb}>
          Lists other people published for everyone. Age limits still apply. Tap a funny name to see more from them.
        </Text>
      </View>
      <View style={styles.wrap}>
        <Pill label="All lists" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Pill
          label={`Highly rated (${WATCHLIST_GLOBAL_LIST_HIGH_SCORE}+)`}
          active={filter === 'high'}
          onPress={() => setFilter('high')}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {visible.length === 0 ? (
        <EmptyState
          title={filter === 'high' ? 'No highly rated lists yet' : 'No shared lists yet'}
          body={
            filter === 'high'
              ? 'Rate a few shared lists, or switch back to all lists.'
              : 'Share one of your lists with Everyone — add a title, blurb, and sample posters first.'
          }
        />
      ) : (
        <View style={[styles.cards, wide && styles.cardsWide]}>
          {visible.map((card) => (
            <SharedListCard
              key={card.id}
              card={card}
              wide={wide}
              onPress={() => onOpen(card.id)}
              onOpenAuthor={() => {
                if (!card.createdBy) return;
                setProfile({ userId: card.createdBy, alias: card.alias });
              }}
            />
          ))}
        </View>
      )}
      <WatchlistSocialProfileSheet
        visible={Boolean(profile)}
        userId={profile?.userId ?? null}
        aliasHint={profile?.alias}
        viewerId={viewerId}
        allowedAudience={allowedAudience}
        onClose={() => setProfile(null)}
        onOpenList={onOpen}
      />
    </View>
  );
}

export function GlobalListSheet({
  visible,
  listId,
  allowedAudience,
  viewerId,
  onClose,
  onOpenList,
  onAddTitle,
}: {
  visible: boolean;
  listId: string | null;
  allowedAudience: WatchlistAudience;
  viewerId: string | null;
  onClose: () => void;
  onOpenList?: (listId: string) => void;
  onAddTitle: (hit: {
    tmdbId: number;
    mediaType: WatchlistMediaType;
    title: string;
    year: number | null;
    overview: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    imdbId: string | null;
  }) => void;
}) {
  const [name, setName] = useState('Shared list');
  const [blurb, setBlurb] = useState<string | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [titles, setTitles] = useState<WatchlistTitle[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!listId) return;
    const [bundle, cards] = await Promise.all([
      fetchGlobalListBundle(listId),
      fetchGlobalSharedCards({ viewerId }),
    ]);
    if (!bundle.list) return;
    const card = cards.find((row) => row.id === listId) ?? null;
    setName(bundle.list.name);
    setBlurb(bundle.list.blurb);
    setAlias(card?.alias ?? null);
    setAuthorId(card?.createdBy ?? bundle.list.created_by ?? null);
    setAverageScore(card?.averageScore ?? null);
    setMyScore(card?.myScore ?? null);
    setTitles(
      bundle.titles
        .map(watchlistTitleFromRow)
        .filter((title) => !title.audience || canViewAudience(allowedAudience, title.audience)),
    );
  }, [allowedAudience, listId, viewerId]);

  useEffect(() => {
    if (!visible || !listId) return;
    let cancelled = false;
    void reload()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load that list');
      });
    return () => {
      cancelled = true;
    };
  }, [listId, reload, visible]);

  return (
    <Sheet visible={visible} title={name} onClose={onClose} wide>
      <View style={styles.stack}>
        {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
        <View style={styles.wrap}>
          <Text style={styles.cardMeta}>
            {titles.length} titles
            {averageScore != null ? ` · ${averageScore}/10` : ''}
          </Text>
          {alias && authorId ? (
            <Pressable onPress={() => setProfileOpen(true)}>
              <Text style={styles.includes}>by {alias}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.label}>Rate this list</Text>
        <View style={styles.wrap}>
          {SCORES.map((value) => (
            <Pill
              key={value}
              label={String(value)}
              active={myScore === value}
              onPress={() => {
                if (!viewerId || !listId) return;
                setBusy(true);
                void rateGlobalList({ listId, userId: viewerId, score: value })
                  .then(reload)
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not rate that list'))
                  .finally(() => setBusy(false));
              }}
            />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {titles.length === 0 ? (
          <EmptyState title="Nothing to show" body="This list is empty or fully age-restricted for you." />
        ) : (
          titles.map((title) => {
            const poster = tmdbImageUrl(title.posterPath, 'w92');
            return (
              <View key={title.id} style={styles.row}>
                {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
                <View style={styles.rowCopy}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {title.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {title.year ? `${title.year} · ` : ''}
                    {title.mediaType === 'tv' ? 'Series' : 'Movie'}
                  </Text>
                </View>
                <Btn
                  label="Add"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    onAddTitle({
                      tmdbId: title.tmdbId,
                      mediaType: title.mediaType,
                      title: title.title,
                      year: title.year,
                      overview: title.overview,
                      posterPath: title.posterPath,
                      backdropPath: title.backdropPath,
                      imdbId: title.imdbId,
                    })
                  }
                />
              </View>
            );
          })
        )}
        <WatchlistSocialProfileSheet
          visible={profileOpen}
          userId={authorId}
          aliasHint={alias}
          viewerId={viewerId}
          allowedAudience={allowedAudience}
          onClose={() => setProfileOpen(false)}
          onOpenList={(id) => {
            setProfileOpen(false);
            if (id === listId) return;
            onClose();
            onOpenList?.(id);
          }}
        />
      </View>
    </Sheet>
  );
}

export function GlobalReviewsBlock({
  tmdbId,
  mediaType,
  userId,
  allowedAudience,
  onOpenList,
  busy,
  onBusy,
  refreshKey = 0,
  onOwnReview,
}: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  userId: string | null;
  allowedAudience: WatchlistAudience;
  onOpenList?: (listId: string) => void;
  busy?: boolean;
  onBusy?: (busy: boolean) => void;
  refreshKey?: number;
  onOwnReview?: (review: { score: number; body: string | null; updatedAt: string } | null) => void;
}) {
  const [average, setAverage] = useState<number | null>(null);
  const [reviews, setReviews] = useState<WatchlistGlobalReview[]>([]);
  const [profile, setProfile] = useState<{ userId: string; alias: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const data = await fetchGlobalReviewsForTitle(tmdbId, mediaType, userId);
    setAverage(data.average);
    setReviews(data.reviews);
    const mine = userId ? data.reviews.find((review) => review.userId === userId) : null;
    onOwnReview?.(mine ? { score: mine.score, body: mine.body, updatedAt: mine.updatedAt } : null);
  }

  useEffect(() => {
    let cancelled = false;
    void reload()
      .then(() => {
        if (cancelled) return;
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load reviews');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, refreshKey, tmdbId, userId]);

  async function run(action: () => Promise<void>) {
    onBusy?.(true);
    try {
      await action();
      await reload();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that');
    } finally {
      onBusy?.(false);
    }
  }

  return (
    <View style={styles.publicBlock}>
      <View style={styles.publicHead}>
        <Text style={styles.publicLabel}>Public</Text>
        {average != null ? <Text style={styles.publicAvg}>{average}</Text> : null}
      </View>
      {reviews.length === 0 ? <Text style={styles.publicEmpty}>No public scores yet.</Text> : null}
      {reviews.map((review) => (
        <View key={review.id} style={styles.publicRow}>
          <Pressable
            onPress={() => setProfile({ userId: review.userId, alias: review.alias })}
            accessibilityRole="button"
            style={styles.publicPerson}>
            <Text style={styles.publicAlias} numberOfLines={1}>
              {review.alias}
            </Text>
            <Text style={styles.publicScore}>{review.score}</Text>
          </Pressable>
          {review.body ? (
            <Text style={styles.publicBody} numberOfLines={2}>
              {review.body}
            </Text>
          ) : null}
          <View style={styles.publicVotes}>
            <Pressable
              onPress={() => {
                if (!userId || busy) return;
                void run(() => voteGlobalReview({ userId, reviewId: review.id, vote: 1 }));
              }}
              disabled={!userId || busy}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: review.myVote === 1 }}>
              <Text style={[styles.publicVote, review.myVote === 1 && styles.publicVoteOn]}>▲ {review.upvotes}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!userId || busy) return;
                void run(() => voteGlobalReview({ userId, reviewId: review.id, vote: -1 }));
              }}
              disabled={!userId || busy}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: review.myVote === -1 }}>
              <Text style={[styles.publicVote, review.myVote === -1 && styles.publicVoteDown]}>▼ {review.downvotes}</Text>
            </Pressable>
            {userId && review.userId === userId ? (
              <Pressable
                onPress={() => void run(() => deleteGlobalReview(review.id))}
                disabled={busy}
                hitSlop={6}
                accessibilityRole="button">
                <Text style={styles.publicRemove}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <WatchlistSocialProfileSheet
        visible={Boolean(profile)}
        userId={profile?.userId ?? null}
        aliasHint={profile?.alias}
        viewerId={userId}
        allowedAudience={allowedAudience}
        onClose={() => setProfile(null)}
        onOpenList={(listId) => {
          setProfile(null);
          onOpenList?.(listId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  heading: { gap: 4 },
  kicker: { color: colors.text, fontSize: 18, fontWeight: '800' },
  blurb: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  cards: { gap: space.md },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  cardWide: { width: 320 },
  strip: { flexDirection: 'row', height: 132, backgroundColor: colors.bgHover },
  stripPoster: { flex: 1, height: '100%', backgroundColor: colors.bg },
  cardBody: { gap: 4, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  includes: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  stack: { gap: 12, paddingBottom: space.lg },
  preview: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  hitName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  reviewRow: { gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  error: { color: colors.danger, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  poster: { width: 36, height: 52, borderRadius: 4, backgroundColor: colors.bg },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  publicBlock: { gap: 6 },
  publicHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  publicLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  publicAvg: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  publicEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  publicRow: {
    gap: 4,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  publicPerson: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  publicAlias: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, fontWeight: '600' },
  publicScore: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  publicBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  publicVotes: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  publicVote: { color: colors.textMuted, fontSize: 13, fontWeight: '700', minHeight: 28, lineHeight: 28 },
  publicVoteOn: { color: colors.accent },
  publicVoteDown: { color: colors.danger },
  publicRemove: { color: colors.danger, fontSize: 13, fontWeight: '700', minHeight: 28, lineHeight: 28 },
});
