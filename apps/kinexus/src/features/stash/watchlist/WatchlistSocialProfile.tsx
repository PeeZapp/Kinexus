import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  mediaTypeLabel,
  tmdbImageUrl,
  type WatchlistAudience,
  type WatchlistGlobalReview,
  type WatchlistPublicWatched,
} from '@kinexus/domain';

import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { Sheet } from '@/src/features/meals/meals-kit';
import {
  fetchWatchlistSocialProfile,
  type GlobalSharedListCard,
  type WatchlistSocialProfile,
} from '@/src/features/stash/watchlist-social';

function PosterRow({
  title,
  year,
  mediaType,
  posterPath,
  trailing,
}: {
  title: string;
  year: number | null;
  mediaType: 'movie' | 'tv';
  posterPath: string | null;
  trailing?: string | null;
}) {
  const poster = tmdbImageUrl(posterPath, 'w92');
  return (
    <View style={styles.row}>
      {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {year ? `${year} · ` : ''}
          {mediaTypeLabel(mediaType)}
          {trailing ? ` · ${trailing}` : ''}
        </Text>
      </View>
    </View>
  );
}

function ListCard({ card, onPress }: { card: GlobalSharedListCard; onPress: () => void }) {
  const posters = [...card.samplePosterPaths];
  while (posters.length < 4) posters.push('');
  return (
    <Pressable onPress={onPress} style={styles.listCard}>
      <View style={styles.strip}>
        {posters.map((path, index) => {
          const uri = path ? tmdbImageUrl(path, 'w185') : null;
          return uri ? (
            <Image key={`${card.id}-${index}`} source={{ uri }} style={styles.stripPoster} />
          ) : (
            <View key={`${card.id}-empty-${index}`} style={styles.stripPoster} />
          );
        })}
      </View>
      <View style={styles.listBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {card.itemCount} titles
          {card.averageScore != null ? ` · ${card.averageScore}/10` : ''}
          {card.blurb ? ` · ${card.blurb}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export function WatchlistSocialProfileSheet({
  visible,
  userId,
  aliasHint,
  viewerId,
  allowedAudience,
  onClose,
  onOpenList,
}: {
  visible: boolean;
  userId: string | null;
  aliasHint?: string | null;
  viewerId: string | null;
  allowedAudience: WatchlistAudience;
  onClose: () => void;
  onOpenList: (listId: string) => void;
}) {
  const [profile, setProfile] = useState<WatchlistSocialProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    void fetchWatchlistSocialProfile({ userId, viewerId, allowedAudience })
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load that profile');
      });
    return () => {
      cancelled = true;
    };
  }, [allowedAudience, userId, viewerId, visible]);

  const alias = profile?.alias ?? aliasHint ?? 'Profile';
  const watched = profile?.watched ?? [];
  const lists = profile?.lists ?? [];
  const reviews = profile?.reviews ?? [];

  return (
    <Sheet visible={visible} title={alias} onClose={onClose} wide>
      <View style={styles.stack}>
        <Text style={styles.blurb}>
          Public watchlist profile. Funny names are assigned once and never change — real names stay hidden.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.kicker}>Watched</Text>
        {watched.length === 0 ? (
          <EmptyState title="No public watched titles" body="Titles they mark watched publicly will show up here." />
        ) : (
          watched.map((item: WatchlistPublicWatched) => (
            <PosterRow
              key={item.id}
              title={item.title}
              year={item.year}
              mediaType={item.mediaType}
              posterPath={item.posterPath}
              trailing={item.score != null ? `${item.score}/10` : null}
            />
          ))
        )}

        <Text style={styles.kicker}>Shared lists</Text>
        {lists.length === 0 ? (
          <EmptyState title="No shared lists" body="Lists they publish for everyone will show up here." />
        ) : (
          lists.map((card) => (
            <ListCard
              key={card.id}
              card={card}
              onPress={() => {
                onClose();
                onOpenList(card.id);
              }}
            />
          ))
        )}

        <Text style={styles.kicker}>Reviews</Text>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" body="Public reviews they write will show up here." />
        ) : (
          reviews.map((review: WatchlistGlobalReview) => (
            <View key={review.id} style={styles.reviewBlock}>
              <PosterRow
                title={review.title?.trim() || (review.mediaType === 'tv' ? 'Series' : 'Movie')}
                year={review.year}
                mediaType={review.mediaType}
                posterPath={review.posterPath}
                trailing={`${review.score}/10`}
              />
              {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: space.lg },
  blurb: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  kicker: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 8 },
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
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  strip: { flexDirection: 'row', height: 100, backgroundColor: colors.bgHover },
  stripPoster: { flex: 1, height: '100%', backgroundColor: colors.bg },
  listBody: { gap: 4, padding: 12 },
  reviewBlock: { gap: 6 },
  reviewBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
});

