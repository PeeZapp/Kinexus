import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  itemStatusLabel,
  mediaTypeLabel,
  normalizeStreamingProviderIds,
  tmdbImageUrl,
  watchlistTitleKey,
  type HouseholdPerson,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistMediaType,
  type WatchlistRecommendScope,
  type WatchlistRecommendSeed,
  type WatchlistSearchHit,
  type WatchlistSuggestion,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import { discoverWatchlistTitles, recommendWatchlistTitles, searchWatchlistCatalog } from '@/src/features/stash/watchlist-api';

export type WatchlistIdeasMode = 'next' | 'surprise' | 'like';

export type WatchlistIdeaSource = {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  imdbId: string | null;
  status: WatchlistItemStatus;
};

const PICK_LIMIT = 10;

function hitToSuggestion(hit: WatchlistSearchHit): WatchlistSuggestion {
  return { ...hit, publicScore: null, reason: null };
}

function sourceToSuggestion(row: WatchlistIdeaSource): WatchlistSuggestion {
  return {
    tmdbId: row.tmdbId,
    mediaType: row.mediaType,
    title: row.title,
    year: row.year,
    overview: row.overview,
    posterPath: row.posterPath,
    backdropPath: row.backdropPath,
    imdbId: row.imdbId,
    publicScore: null,
    reason: itemStatusLabel(row.status),
  };
}

export function IdeasSheet({
  visible,
  mode,
  people,
  defaultPersonId,
  seedsFor,
  library,
  country,
  recommendScope,
  providerIds,
  saved,
  lists,
  defaultListId,
  onAdd,
  onClose,
  busy,
  error,
}: {
  visible: boolean;
  mode: WatchlistIdeasMode | null;
  people: HouseholdPerson[];
  defaultPersonId: string | null;
  seedsFor: (personId: string) => WatchlistRecommendSeed[];
  library: readonly WatchlistIdeaSource[];
  country: string;
  recommendScope: WatchlistRecommendScope;
  providerIds: readonly number[];
  saved: readonly { tmdbId: number; mediaType: WatchlistMediaType }[];
  lists: WatchlistList[];
  defaultListId: string | null;
  onAdd: (hit: WatchlistSearchHit, listId: string) => Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [personId, setPersonId] = useState<string | null>(defaultPersonId);
  const [mediaType, setMediaType] = useState<WatchlistMediaType>('movie');
  const [query, setQuery] = useState('');
  const [searchHits, setSearchHits] = useState<WatchlistSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<WatchlistSuggestion[]>([]);
  const [results, setResults] = useState<WatchlistSuggestion[]>([]);
  const [band, setBand] = useState<number | null>(null);
  const [phase, setPhase] = useState<'browse' | 'results'>('browse');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(defaultListId);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [surpriseNonce, setSurpriseNonce] = useState(0);
  const serviceIds = recommendScope === 'subscribed' ? normalizeStreamingProviderIds(providerIds) : [];
  const needsServices = recommendScope === 'subscribed' && serviceIds.length === 0;
  const serviceKey = serviceIds.join(',');
  const serviceFilter = useMemo(() => {
    const ids = serviceKey ? serviceKey.split(',').map(Number) : [];
    return ids.length > 0 ? { country, providerIds: ids } : {};
  }, [country, serviceKey]);

  useEffect(() => {
    if (!visible) return;
    setPersonId(defaultPersonId);
    setMediaType('movie');
    setQuery('');
    setSearchHits([]);
    setSearching(false);
    setSearchMessage(null);
    setPicked([]);
    setResults([]);
    setBand(null);
    setPhase('browse');
    setLocalError(null);
    setListId(defaultListId ?? lists[0]?.id ?? null);
    setSurpriseNonce(0);
  }, [mode, visible]);

  useEffect(() => {
    if (!visible || mode !== 'like') return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchHits((current) => (current.length === 0 ? current : []));
      setSearching((current) => (current ? false : current));
      setSearchMessage((current) => (current == null ? current : null));
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchMessage(null);
        try {
          const results = await searchWatchlistCatalog(trimmed, country);
          if (cancelled) return;
          setSearchHits(results);
          setSearchMessage(results.length === 0 ? 'No titles matched. Try a shorter name or a year.' : null);
        } catch (err) {
          if (cancelled) return;
          setSearchHits([]);
          setSearchMessage(err instanceof Error ? err.message : 'Search failed');
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [country, mode, query, visible]);

  useEffect(() => {
    if (!visible || mode !== 'surprise') return;
    if (needsServices) {
      setResults([]);
      setLoading(false);
      setLocalError('Choose the streaming services you have, or set recommendations to show all.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLocalError(null);
    void discoverWatchlistTitles({ mediaType, genreId: null, mode: 'surprise', ...serviceFilter })
      .then((rows) => {
        if (!cancelled) {
          setResults(rows);
          if (rows.length === 0 && serviceIds.length > 0) {
            setLocalError('Nothing on your services matched. Add another service, or set recommendations to show all.');
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResults([]);
        setLocalError(err instanceof Error ? err.message : 'Could not load a title');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, mode, needsServices, serviceFilter, serviceIds.length, surpriseNonce, visible]);

  useEffect(() => {
    if (!visible || mode !== 'next' || !personId) return;
    if (needsServices) {
      setResults([]);
      setBand(null);
      setLoading(false);
      setLocalError('Choose the streaming services you have, or set recommendations to show all.');
      return;
    }
    const seeds = seedsFor(personId);
    if (seeds.length === 0) {
      setResults([]);
      setBand(null);
      setLocalError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLocalError(null);
    void recommendWatchlistTitles({ seeds, exclude: [...saved], ...serviceFilter })
      .then((payload) => {
        if (cancelled) return;
        setResults(payload.results);
        setBand(payload.band);
        if (payload.results.length === 0 && serviceIds.length > 0) {
          setLocalError('Nothing on your services matched. Add another service, or set recommendations to show all.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResults([]);
        setLocalError(err instanceof Error ? err.message : 'Could not build recommendations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, needsServices, personId, saved, seedsFor, serviceFilter, serviceIds.length, visible]);

  function togglePick(hit: WatchlistSuggestion) {
    const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
    setPicked((current) => {
      if (current.some((item) => watchlistTitleKey(item.mediaType, item.tmdbId) === key)) {
        return current.filter((item) => watchlistTitleKey(item.mediaType, item.tmdbId) !== key);
      }
      if (current.length >= PICK_LIMIT) return current;
      return [...current, hit];
    });
    setLocalError(null);
  }

  async function recommendFromPicks() {
    if (needsServices) {
      setLocalError('Choose the streaming services you have, or set recommendations to show all.');
      return;
    }
    if (picked.length < 3) {
      setLocalError('Pick at least 3 titles you like.');
      return;
    }
    setLoading(true);
    setLocalError(null);
    try {
      const payload = await recommendWatchlistTitles({
        seeds: picked.map((hit) => ({
          tmdbId: hit.tmdbId,
          mediaType: hit.mediaType,
          title: hit.title,
          userScore: 8,
        })),
        exclude: [...saved],
        ...serviceFilter,
      });
      setResults(payload.results);
      setBand(payload.band);
      setPhase('results');
      if (payload.results.length === 0 && serviceIds.length > 0) {
        setLocalError('Nothing on your services matched. Add another service, or set recommendations to show all.');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not build recommendations');
    } finally {
      setLoading(false);
    }
  }

  function anotherSurprise() {
    setSurpriseNonce((value) => value + 1);
  }

  async function addHit(hit: WatchlistSuggestion) {
    if (!listId) return;
    const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
    setAddingKey(key);
    try {
      await onAdd(hit, listId);
    } finally {
      setAddingKey(null);
    }
  }

  const title =
    mode === 'surprise' ? 'Surprise me' : mode === 'like' ? 'Something like this' : 'What should I watch next';
  const likeBrowse = mode === 'like' && phase === 'browse';
  const showResults = mode === 'next' || mode === 'surprise' || phase === 'results';
  const seeds = personId ? seedsFor(personId) : [];
  const savedKeys = new Set(saved.map((row) => watchlistTitleKey(row.mediaType, row.tmdbId)));
  const pickedKeys = new Set(picked.map((hit) => watchlistTitleKey(hit.mediaType, hit.tmdbId)));
  const needle = query.trim().toLowerCase();
  const libraryRows = (needle
    ? library.filter((row) => row.title.toLowerCase().includes(needle))
    : library
  )
    .map(sourceToSuggestion)
    .filter((hit) => !pickedKeys.has(watchlistTitleKey(hit.mediaType, hit.tmdbId)));
  const visibleSearch = searchHits
    .map(hitToSuggestion)
    .filter((hit) => !pickedKeys.has(watchlistTitleKey(hit.mediaType, hit.tmdbId)));

  return (
    <Sheet
      visible={visible && mode != null}
      title={title}
      onClose={onClose}
      wide
      header={
        likeBrowse ? (
          <View style={styles.pinned}>
            <Text style={styles.hint}>
              Search for a movie or show, or pick from titles you have watched and lists you already keep. Choose at least 3.
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search movies and shows"
              placeholderTextColor={colors.textDim}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <Text style={styles.hint}>
              {picked.length} of {PICK_LIMIT} selected
            </Text>
            <Btn
              label="Recommend from these"
              onPress={() => void recommendFromPicks()}
              busy={loading}
              disabled={picked.length < 3 || loading}
            />
            {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
          </View>
        ) : undefined
      }>
      <View style={styles.stack}>
        {mode === 'next' ? (
          <>
            <Text style={styles.hint}>
              Uses your high scores and what the household has watched, then finds titles in a similar public-score band.
            </Text>
            {people.length > 1 ? (
              <View style={styles.wrap}>
                {people.map((person) => (
                  <Pill
                    key={person.id}
                    label={person.name}
                    active={personId === person.id}
                    onPress={() => setPersonId(person.id)}
                  />
                ))}
              </View>
            ) : null}
            {!loading && seeds.length === 0 ? (
              <Text style={styles.hint}>
                Review a few titles you liked, or mark some as watched. Something like this can start from titles you search for or already have.
              </Text>
            ) : null}
          </>
        ) : null}

        {likeBrowse ? (
          <>
            {picked.map((hit) => {
              const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
              return (
                <SuggestionRow key={`picked-${key}`} hit={hit} action="Remove" onPress={() => togglePick(hit)} />
              );
            })}
            {query.trim().length >= 2 ? (
              <>
                <Text style={styles.section}>Search</Text>
                {searching && visibleSearch.length === 0 ? <Text style={styles.hint}>Searching…</Text> : null}
                {searchMessage ? <Text style={styles.hint}>{searchMessage}</Text> : null}
                {visibleSearch.map((hit) => {
                  const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
                  const full = picked.length >= PICK_LIMIT;
                  return (
                    <SuggestionRow
                      key={`search-${key}`}
                      hit={hit}
                      action={full ? 'Full' : 'Pick'}
                      disabled={full}
                      onPress={() => togglePick(hit)}
                    />
                  );
                })}
              </>
            ) : null}
            <Text style={styles.section}>From your lists</Text>
            {libraryRows.length === 0 ? (
              <Text style={styles.hint}>
                {library.length === 0
                  ? 'Nothing watched or saved yet. Search above to add a title you like.'
                  : 'None of your titles match that search.'}
              </Text>
            ) : (
              libraryRows.map((hit) => {
                const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
                const full = picked.length >= PICK_LIMIT;
                return (
                  <SuggestionRow
                    key={`library-${key}`}
                    hit={hit}
                    action={full ? 'Full' : 'Pick'}
                    disabled={full}
                    onPress={() => togglePick(hit)}
                  />
                );
              })
            )}
          </>
        ) : null}

        {showResults ? (
          <>
            {serviceIds.length > 0 ? <Text style={styles.hint}>Limited to titles on your services.</Text> : null}
            {mode === 'like' ? (
              <Btn label="Back to the list" variant="ghost" onPress={() => setPhase('browse')} />
            ) : null}
            {band != null ? (
              <Text style={styles.hint}>
                Public scores near {band.toFixed(1)}, the range of titles you rate highly.
              </Text>
            ) : null}
            {mode === 'surprise' ? (
              <>
                <View style={styles.wrap}>
                  <Pill label="Movies" active={mediaType === 'movie'} onPress={() => setMediaType('movie')} />
                  <Pill label="Series" active={mediaType === 'tv'} onPress={() => setMediaType('tv')} />
                </View>
                <Btn label="Another" variant="secondary" onPress={anotherSurprise} busy={loading} disabled={loading} />
              </>
            ) : null}
            {results.map((hit) => {
              const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
              const onList = savedKeys.has(key);
              return (
                <SuggestionRow
                  key={key}
                  hit={hit}
                  action={addingKey === key ? 'Adding…' : onList ? 'On list' : 'Add'}
                  disabled={onList || addingKey === key || !listId}
                  onPress={() => void addHit(hit)}
                />
              );
            })}
            {lists.length > 0 && results.length > 0 ? (
              <View style={styles.wrap}>
                {lists.map((list) => (
                  <Pill key={list.id} label={list.name} active={listId === list.id} onPress={() => setListId(list.id)} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {loading && results.length === 0 && mode !== 'like' ? <Text style={styles.hint}>Looking…</Text> : null}
        {!likeBrowse && (localError || error) ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        {busy ? <Text style={styles.hint}>Saving…</Text> : null}
      </View>
    </Sheet>
  );
}

function SuggestionRow({
  hit,
  action,
  disabled,
  onPress,
}: {
  hit: WatchlistSuggestion;
  action: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const poster = tmdbImageUrl(hit.posterPath, 'w92');
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.hit}>
      {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {hit.title}
        </Text>
        <Text style={styles.hint} numberOfLines={2}>
          {hit.year ? `${hit.year} · ` : ''}
          {mediaTypeLabel(hit.mediaType)}
          {hit.publicScore != null ? ` · ${hit.publicScore.toFixed(1)} public` : ''}
          {hit.reason ? ` · ${hit.reason}` : ''}
        </Text>
      </View>
      <Text style={styles.action}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pinned: { gap: 8 },
  search: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  section: { color: colors.text, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  hit: {
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
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  action: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
