import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  WATCHLIST_ITEM_STATUSES,
  itemStatusLabel,
  mediaTypeLabel,
  parseWatchlistUrl,
  titleYearLabel,
  tmdbImageUrl,
  watchlistListError,
  watchlistVisibilityLabel,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
  type WatchlistVisibility,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import { lookupWatchlistCatalog, resolveWatchlistLink, searchWatchlistCatalog } from '@/src/features/stash/watchlist-api';
import { ProviderChips, openExternal } from '@/src/features/stash/watchlist/WatchlistShared';

export function AddWatchlistSheet({
  visible,
  defaultVisibility = 'household',
  onClose,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  defaultVisibility?: WatchlistVisibility;
  onClose: () => void;
  onSave: (name: string, visibility: WatchlistVisibility) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<WatchlistVisibility>(defaultVisibility);
  useEffect(() => {
    if (!visible) return;
    setName('');
    setVisibility(defaultVisibility);
  }, [defaultVisibility, visible]);
  return (
    <Sheet visible={visible} title="New watchlist" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Weekend movies, my queue…" autoCapitalize="words" />
        <Text style={styles.label}>Who can see this</Text>
        <View style={styles.wrap}>
          <Pill label="Household" active={visibility === 'household'} onPress={() => setVisibility('household')} />
          <Pill label="Personal" active={visibility === 'personal'} onPress={() => setVisibility('personal')} />
        </View>
        <Text style={styles.hint}>
          {visibility === 'personal'
            ? 'Only you can see this list. Other household members keep their own personal lists.'
            : 'Everyone in the household can see and add to this list.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label="Create list" onPress={() => void onSave(name, visibility)} busy={busy} disabled={!name.trim()} />
      </View>
    </Sheet>
  );
}

export function WatchlistSettingsSheet({
  visible,
  name,
  onNameChange,
  visibility,
  onVisibilityChange,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  visible: boolean;
  name: string;
  onNameChange: (v: string) => void;
  visibility: WatchlistVisibility;
  onVisibilityChange: (v: WatchlistVisibility) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <Sheet visible={visible} title="List settings" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={onNameChange} />
        <Text style={styles.label}>Who can see this</Text>
        <View style={styles.wrap}>
          <Pill label="Household" active={visibility === 'household'} onPress={() => onVisibilityChange('household')} />
          <Pill label="Personal" active={visibility === 'personal'} onPress={() => onVisibilityChange('personal')} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label="Save" onPress={() => void onSave()} busy={busy} disabled={!name.trim()} />
        {onDelete ? <Btn label="Delete list" variant="danger" onPress={() => void onDelete()} /> : null}
      </View>
    </Sheet>
  );
}

export function AddTitleSheet({
  visible,
  lists,
  defaultListId,
  country,
  onClose,
  onAdd,
  busy,
  error,
}: {
  visible: boolean;
  lists: WatchlistList[];
  defaultListId: string | null;
  country: string;
  onClose: () => void;
  onAdd: (hit: WatchlistSearchHit, listId: string, status: WatchlistItemStatus, sourceUrl?: string | null) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<WatchlistSearchHit[]>([]);
  const [picked, setPicked] = useState<WatchlistSearchHit | null>(null);
  const [resolved, setResolved] = useState<WatchlistResolvedTitle | null>(null);
  const [listId, setListId] = useState<string | null>(defaultListId);
  const [status, setStatus] = useState<WatchlistItemStatus>('want');
  const [searching, setSearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setHits([]);
    setPicked(null);
    setResolved(null);
    setListId(defaultListId ?? lists[0]?.id ?? null);
    setStatus('want');
    setLocalError(null);
    setSourceUrl(null);
  }, [defaultListId, lists, visible]);

  async function runSearch() {
    setLocalError(null);
    setPicked(null);
    setResolved(null);
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const parsed = parseWatchlistUrl(trimmed);
        const listError = watchlistListError(parsed);
        if (listError) {
          setHits([]);
          setLocalError(listError);
          return;
        }
        setSourceUrl(trimmed);
        const results = await resolveWatchlistLink(trimmed, country);
        setHits(results);
        if (results.length === 1 && results[0]) {
          await pickHit(results[0], trimmed);
        } else if (results.length === 0) {
          setLocalError('No title matched that link. Try searching by name.');
        }
      } else {
        setSourceUrl(null);
        const results = await searchWatchlistCatalog(trimmed, country);
        setHits(results);
        if (results.length === 0) setLocalError('No titles matched. Try a shorter name or a year.');
      }
    } catch (err) {
      setHits([]);
      setLocalError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function pickHit(hit: WatchlistSearchHit, url?: string | null) {
    setPicked(hit);
    setLocalError(null);
    try {
      const next = await lookupWatchlistCatalog({
        tmdbId: hit.tmdbId,
        mediaType: hit.mediaType,
        country,
        sourceUrl: url ?? sourceUrl,
      });
      setResolved(next);
    } catch {
      setResolved(null);
    }
  }

  const selectedList = lists.find((list) => list.id === listId) ?? null;

  return (
    <Sheet visible={visible} title="Add a title" onClose={onClose} wide>
      <View style={styles.stack}>
        <Field
          label="Search or paste a link"
          value={query}
          onChangeText={setQuery}
          placeholder="The Bear, or an IMDb / RT URL"
          autoCapitalize="none"
          onSubmitEditing={() => void runSearch()}
        />
        <Text style={styles.hint}>
          Search TMDB, or paste a movie/series page from IMDb, TMDB, Rotten Tomatoes, Letterboxd, or JustWatch.
        </Text>
        <Btn label="Search" onPress={() => void runSearch()} busy={searching} disabled={!query.trim() || searching} />
        {hits.length > 0 && !picked ? (
          <View style={styles.hits}>
            {hits.map((hit) => {
              const poster = tmdbImageUrl(hit.posterPath, 'w92');
              return (
                <Pressable key={`${hit.mediaType}-${hit.tmdbId}`} onPress={() => void pickHit(hit)} style={styles.hit}>
                  {poster ? <Image source={{ uri: poster }} style={styles.hitPoster} /> : <View style={styles.hitPoster} />}
                  <View style={styles.hitCopy}>
                    <Text style={styles.hitName}>{hit.title}</Text>
                    <Text style={styles.hint}>{titleYearLabel(hit)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {picked ? (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{picked.title}</Text>
            <Text style={styles.hint}>
              {picked.year ? `${picked.year} · ` : ''}
              {mediaTypeLabel(picked.mediaType)}
            </Text>
            {picked.overview ? (
              <Text style={styles.overview} numberOfLines={4}>
                {picked.overview}
              </Text>
            ) : null}
            <ProviderChips providers={resolved?.providers ?? []} />
            {lists.length > 0 ? (
              <>
                <Text style={styles.label}>Add to</Text>
                <View style={styles.wrap}>
                  {lists.map((list) => (
                    <Pill
                      key={list.id}
                      label={`${list.name} (${watchlistVisibilityLabel(list.visibility)})`}
                      active={listId === list.id}
                      onPress={() => setListId(list.id)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.hint}>Create a watchlist first, then add titles to it.</Text>
            )}
            <Text style={styles.label}>Status</Text>
            <View style={styles.wrap}>
              {WATCHLIST_ITEM_STATUSES.map((item) => (
                <Pill key={item} label={itemStatusLabel(item)} active={status === item} onPress={() => setStatus(item)} />
              ))}
            </View>
          </View>
        ) : null}
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <Btn
          label={selectedList ? `Add to ${selectedList.name}` : 'Add title'}
          onPress={() => picked && listId && void onAdd(picked, listId, status, sourceUrl)}
          busy={busy}
          disabled={!picked || !listId || busy}
        />
      </View>
    </Sheet>
  );
}

export function TitleSheet({
  visible,
  entry,
  country,
  onClose,
  onStatus,
  onSaveNotes,
  onRemove,
  onRefresh,
  busy,
  error,
}: {
  visible: boolean;
  entry: WatchlistEntry | null;
  country: string;
  onClose: () => void;
  onStatus: (status: WatchlistItemStatus) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onRefresh: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [notes, setNotes] = useState(entry?.item.notes ?? '');
  useEffect(() => {
    if (!visible) return;
    setNotes(entry?.item.notes ?? '');
  }, [entry, visible]);
  if (!entry) return null;
  const poster = tmdbImageUrl(entry.title.posterPath, 'w185');
  return (
    <Sheet visible={visible} title={entry.title.title} onClose={onClose} wide>
      <View style={styles.stack}>
        <View style={styles.hero}>
          {poster ? <Image source={{ uri: poster }} style={styles.heroPoster} /> : <View style={styles.heroPoster} />}
          <View style={styles.heroCopy}>
            <Text style={styles.previewTitle}>{entry.title.title}</Text>
            <Text style={styles.hint}>
              {entry.title.year ? `${entry.title.year} · ` : ''}
              {mediaTypeLabel(entry.title.mediaType)} · {watchlistVisibilityLabel(entry.list.visibility)}
            </Text>
            <Text style={styles.hint}>{entry.list.name}</Text>
          </View>
        </View>
        {entry.title.overview ? <Text style={styles.overview}>{entry.title.overview}</Text> : null}
        <Text style={styles.label}>Where to watch in {country}</Text>
        <ProviderChips providers={entry.title.providers} />
        <View style={styles.wrap}>
          {entry.title.trailerUrl ? (
            <Btn label="Watch trailer" onPress={() => openExternal(entry.title.trailerUrl)} />
          ) : null}
          {entry.title.tmdbWatchUrl ? (
            <Btn label="Open where to watch" variant="secondary" onPress={() => openExternal(entry.title.tmdbWatchUrl)} />
          ) : null}
          {entry.title.sourceUrl ? (
            <Btn label="Open original link" variant="ghost" onPress={() => openExternal(entry.title.sourceUrl)} />
          ) : null}
          <Btn label="Refresh availability" variant="ghost" onPress={() => void onRefresh()} busy={busy} disabled={busy} />
        </View>
        <Text style={styles.label}>Status</Text>
        <View style={styles.wrap}>
          {WATCHLIST_ITEM_STATUSES.map((item) => (
            <Pill
              key={item}
              label={itemStatusLabel(item)}
              active={entry.item.status === item}
              onPress={() => void onStatus(item)}
            />
          ))}
        </View>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label="Save notes" variant="secondary" onPress={() => void onSaveNotes(notes)} busy={busy} />
        <Btn label="Remove from list" variant="danger" onPress={() => void onRemove()} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  hits: { gap: 8 },
  hit: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  hitPoster: { width: 40, height: 56, borderRadius: 6, backgroundColor: colors.bg },
  hitCopy: { flex: 1, minWidth: 0, gap: 2 },
  hitName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  preview: { gap: 10 },
  previewTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  overview: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroPoster: { width: 72, height: 108, borderRadius: radius.md, backgroundColor: colors.bgHover },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
});
