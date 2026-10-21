import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  mediaTypeLabel,
  tmdbImageUrl,
  type WatchlistList,
  type WatchlistMediaType,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  loadWatchlistPersonMovies,
  loadWatchlistTitleCast,
  type WatchlistCastMember,
  type WatchlistPersonCredit,
} from '@/src/features/stash/watchlist-api';

export type { WatchlistCastMember };

export function TitleCast({
  tmdbId,
  mediaType,
  active,
  onPick,
}: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  active: boolean;
  onPick: (person: WatchlistCastMember) => void;
}) {
  const [cast, setCast] = useState<WatchlistCastMember[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setCast([]);
    setPhase('loading');
    setMessage(null);
    void loadWatchlistTitleCast(tmdbId, mediaType)
      .then((rows) => {
        if (cancelled) return;
        setCast(rows);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCast([]);
        setPhase('error');
        setMessage(err instanceof Error ? err.message : 'Could not load the cast');
      });
    return () => {
      cancelled = true;
    };
  }, [active, mediaType, tmdbId]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Top cast</Text>
      {phase === 'loading' ? <Text style={styles.quiet}>Loading cast…</Text> : null}
      {phase === 'error' ? <Text style={styles.quiet}>{message}</Text> : null}
      {phase === 'ready' && cast.length === 0 ? <Text style={styles.quiet}>Cast isn’t listed for this title.</Text> : null}
      {cast.length > 0 ? (
        <View style={styles.row}>
          {cast.map((person) => {
            const photo = tmdbImageUrl(person.profilePath, 'w185');
            return (
              <Pressable
                key={person.id}
                onPress={() => onPick(person)}
                accessibilityRole="button"
                accessibilityLabel={person.character ? `${person.name}, ${person.character}` : person.name}
                style={styles.person}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.initial}>{person.name.slice(0, 1)}</Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={2}>
                  {person.name}
                </Text>
                {person.character ? (
                  <Text style={styles.role} numberOfLines={2}>
                    {person.character}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function PersonMovies({
  person,
  backLabel,
  onBack,
  excludeMovieId,
  lists,
  defaultListId,
  titleOnList,
  onAdd,
  busy,
  error,
}: {
  person: WatchlistCastMember;
  backLabel: string;
  onBack: () => void;
  excludeMovieId: number | null;
  lists: readonly WatchlistList[];
  defaultListId: string | null;
  titleOnList: (listId: string, mediaType: WatchlistMediaType, tmdbId: number) => boolean;
  onAdd: (hit: WatchlistSearchHit, listId: string) => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
}) {
  const [movies, setMovies] = useState<WatchlistPersonCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(defaultListId);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setListId(defaultListId && lists.some((list) => list.id === defaultListId) ? defaultListId : (lists[0]?.id ?? null));
    setAdded(new Set());
  }, [defaultListId, lists, person.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setMovies([]);
    void loadWatchlistPersonMovies(person.id)
      .then((payload) => {
        if (cancelled) return;
        setMovies(payload.results.filter((movie) => movie.tmdbId !== excludeMovieId));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load movies');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [excludeMovieId, person.id]);

  const selected = lists.find((list) => list.id === listId) ?? null;

  async function addMovie(movie: WatchlistPersonCredit) {
    if (!listId || addingId != null) return;
    setAddingId(movie.tmdbId);
    try {
      const ok = await onAdd(movie, listId);
      if (ok) {
        setAdded((current) => {
          const next = new Set(current);
          next.add(`${listId}:${movie.tmdbId}`);
          return next;
        });
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <View style={styles.movies}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={6}>
        <Text style={styles.back}>Back to {backLabel}</Text>
      </Pressable>
      {person.character ? <Text style={styles.quiet}>Plays {person.character}</Text> : null}
      <Text style={styles.quiet}>Other movies. Add any of them to a watchlist.</Text>
      {lists.length > 1 ? (
        <View style={styles.pills}>
          {lists.map((list) => (
            <Pill key={list.id} label={list.name} active={list.id === listId} onPress={() => setListId(list.id)} />
          ))}
        </View>
      ) : selected ? (
        <Text style={styles.quiet}>Adding to {selected.name}</Text>
      ) : (
        <Text style={styles.quiet}>Create a watchlist first, then you can add these movies.</Text>
      )}
      {loading ? <Text style={styles.quiet}>Loading movies…</Text> : null}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {!loading && !loadError && movies.length === 0 ? <Text style={styles.quiet}>No other movies listed.</Text> : null}
      {movies.map((movie) => {
        const poster = tmdbImageUrl(movie.posterPath, 'w92');
        const onList =
          listId != null && (titleOnList(listId, movie.mediaType, movie.tmdbId) || added.has(`${listId}:${movie.tmdbId}`));
        const adding = addingId === movie.tmdbId;
        return (
          <View key={movie.tmdbId} style={styles.hit}>
            {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
            <View style={styles.hitCopy}>
              <Text style={styles.hitName} numberOfLines={2}>
                {movie.title}
              </Text>
              <Text style={styles.hitMeta} numberOfLines={1}>
                {movie.year ? `${movie.year} · ` : ''}
                {mediaTypeLabel(movie.mediaType)}
                {movie.role ? ` · ${movie.role}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => void addMovie(movie)}
              disabled={!listId || onList || adding || busy}
              accessibilityRole="button"
              hitSlop={6}>
              <Text style={[styles.add, (onList || !listId) && styles.addDone]}>
                {adding ? 'Adding…' : onList ? 'On list' : 'Add'}
              </Text>
            </Pressable>
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  quiet: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  person: { width: 84, gap: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.textMuted, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  role: { color: colors.textMuted, fontSize: 11, lineHeight: 14 },
  movies: { gap: 12, paddingTop: 4, paddingBottom: space.md },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  poster: { width: 36, height: 52, borderRadius: radius.sm, backgroundColor: colors.bgHover },
  hitCopy: { flex: 1, minWidth: 0, gap: 2 },
  hitName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hitMeta: { color: colors.textMuted, fontSize: 12 },
  add: { color: colors.accent, fontSize: 13, fontWeight: '800', paddingHorizontal: 8 },
  addDone: { color: colors.textDim, fontWeight: '700' },
});
