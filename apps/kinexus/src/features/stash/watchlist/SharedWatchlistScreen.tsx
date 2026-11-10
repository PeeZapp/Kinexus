import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { tmdbImageUrl, type WatchlistSearchHit } from '@kinexus/domain';

import { creatorProfileHref } from '@/src/features/creators/creators-api';
import { fetchSharedWatchlist, type SharedWatchlistResponse } from '@/src/features/share/share-api';
import { StashPhoto } from '@/src/features/stash/StashShared';
import { useWatchlistSync } from '@/src/features/stash/use-watchlist-sync';
import { Btn } from '@/src/features/household/ui';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

export function SharedWatchlistScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const watchlist = useWatchlistSync();
  const [data, setData] = useState<SharedWatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const signedIn = Boolean(user && !user.isDevBypass && activeHousehold);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token.trim()) {
        setError('Missing share link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await fetchSharedWatchlist(token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function addToMine() {
    if (!data || !signedIn || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const existing = watchlist.lists.find(
        (list) => list.name.trim().toLowerCase() === data.name.trim().toLowerCase() && list.kind === 'custom',
      );
      const listId =
        existing?.id ??
        (await watchlist.createList(data.name, { visibility: 'household', personIds: [] }));
      for (const title of data.titles) {
        const hit: WatchlistSearchHit = {
          tmdbId: title.tmdbId,
          mediaType: title.mediaType,
          title: title.title,
          year: title.year,
          overview: null,
          posterPath: title.posterPath,
          backdropPath: null,
          imdbId: null,
        };
        await watchlist.addTitleToList(listId, hit, { status: 'want' });
      }
      setStatus('Added to your watchlist');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to your watchlist');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading shared list" />;
  if (error && !data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.brand}>Kinexus</Text>
          <ErrorBanner message={error} />
          <EmptyState title="List not found" body="This share link is invalid or the list is no longer shared." />
        </View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <EmptyState title="List not found" body="This share link is invalid or the list is no longer shared." />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Kinexus</Text>
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.ownerUsername ? (
          <>
            <Text
              onPress={() => router.push(creatorProfileHref(data.ownerUsername!) as Href)}
              style={styles.ownerLink}
              accessibilityRole="link">
              @{data.ownerUsername}
            </Text>
            {' · '}
          </>
        ) : null}
        {data.titles.length} title{data.titles.length === 1 ? '' : 's'}
      </Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <ErrorBanner message={error} />
      {signedIn ? <Btn label="Add to my watchlist" onPress={() => void addToMine()} busy={busy} /> : null}

      {data.titles.length === 0 ? (
        <EmptyState title="This list is empty" body="Nothing has been added yet." />
      ) : (
        <View style={styles.stack}>
          {data.titles.map((title) => (
            <View key={`${title.mediaType}-${title.tmdbId}`} style={styles.card}>
              <StashPhoto
                uri={title.posterPath ? tmdbImageUrl(title.posterPath, 'w185') : null}
                fallback={title.mediaType === 'tv' ? '📺' : '🎬'}
                size={88}
              />
              <View style={styles.cardBody}>
                <Text style={styles.type}>{title.mediaType === 'tv' ? 'Series' : 'Movie'}</Text>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {title.title}
                </Text>
                {title.year ? <Text style={styles.year}>{title.year}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 15 },
  ownerLink: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  status: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: 14,
  },
  cardBody: { flex: 1, gap: 4, minWidth: 0 },
  type: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  year: { color: colors.textMuted, fontSize: 13 },
});
