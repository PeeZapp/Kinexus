import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  WATCHLIST_GLOBAL_SAMPLE_LIMIT,
  WATCHLIST_ITEM_STATUSES,
  familyReviewAverage,
  itemStatusLabel,
  mediaTypeLabel,
  parseWatchlistUrl,
  titleYearLabel,
  tmdbImageUrl,
  watchlistListError,
  watchlistVisibilityLabel,
  type WatchlistAudience,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistResolvedTitle,
  type WatchlistReview,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import type { HouseholdPerson } from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { SharePicker } from '@/src/features/stash/sheets';
import type { ListShareDraft } from '@/src/features/stash/use-stash-sync';
import type { WatchlistGlobalPublish } from '@/src/features/stash/use-watchlist-sync';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  lookupWatchlistCatalog,
  resolveWatchlistLink,
  searchWatchlistWithPeople,
  type WatchlistPersonHit,
  type WatchlistSearchHitWithRole,
} from '@/src/features/stash/watchlist-api';
import { ProviderChips, openExternal } from '@/src/features/stash/watchlist/WatchlistShared';
import { GlobalReviewsBlock } from '@/src/features/stash/watchlist/GlobalSocial';

function GlobalPublishFields({
  publish,
  onChange,
  posterChoices,
}: {
  publish: WatchlistGlobalPublish;
  onChange: (publish: WatchlistGlobalPublish) => void;
  posterChoices: readonly { title: string; posterPath: string }[];
}) {
  function togglePoster(path: string) {
    const on = publish.samplePosterPaths.includes(path);
    if (on) {
      onChange({ ...publish, samplePosterPaths: publish.samplePosterPaths.filter((item) => item !== path) });
      return;
    }
    if (publish.samplePosterPaths.length >= WATCHLIST_GLOBAL_SAMPLE_LIMIT) return;
    onChange({ ...publish, samplePosterPaths: [...publish.samplePosterPaths, path] });
  }
  return (
    <View style={styles.stack}>
      <Text style={styles.hint}>
        Shared lists need a clear title, a short blurb, and up to {WATCHLIST_GLOBAL_SAMPLE_LIMIT} sample posters — same
        style as the curated shelf.
      </Text>
      <Field
        label="Blurb"
        value={publish.blurb}
        onChangeText={(blurb) => onChange({ ...publish, blurb })}
        placeholder="A few words about the mood of this list…"
        multiline
        autoCapitalize="sentences"
      />
      <Text style={styles.label}>Sample posters ({publish.samplePosterPaths.length}/{WATCHLIST_GLOBAL_SAMPLE_LIMIT})</Text>
      {posterChoices.length === 0 ? (
        <Text style={styles.hint}>Add a few titles to this list first, then pick posters for the shared shelf.</Text>
      ) : (
        <View style={styles.posterPickGrid}>
          {posterChoices.map((choice) => {
            const uri = tmdbImageUrl(choice.posterPath, 'w185');
            const active = publish.samplePosterPaths.includes(choice.posterPath);
            return (
              <Pressable
                key={choice.posterPath}
                onPress={() => togglePoster(choice.posterPath)}
                style={[styles.posterPick, active && styles.posterPickOn]}>
                {uri ? <Image source={{ uri }} style={styles.posterPickImage} /> : <View style={styles.posterPickImage} />}
                <Text style={styles.posterPickLabel} numberOfLines={2}>
                  {choice.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function AddWatchlistSheet({
  visible,
  people,
  onClose,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  people: HouseholdPerson[];
  onClose: () => void;
  onSave: (name: string, share: ListShareDraft) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [share, setShare] = useState<ListShareDraft>({ visibility: 'household', personIds: [] });
  useEffect(() => {
    if (!visible) return;
    setName('');
    setShare({ visibility: 'household', personIds: [] });
  }, [visible]);
  return (
    <Sheet visible={visible} title="New watchlist" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Weekend movies, my queue…" autoCapitalize="words" />
        <SharePicker share={share} onChange={setShare} people={people} />
        <Text style={styles.hint}>To share with everyone, add titles first, then open list settings and choose Everyone.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Create list"
          onPress={() => void onSave(name, share)}
          busy={busy}
          disabled={!name.trim() || (share.visibility === 'people' && share.personIds.length === 0)}
        />
      </View>
    </Sheet>
  );
}

export function WatchlistSettingsSheet({
  visible,
  name,
  onNameChange,
  share,
  onShareChange,
  publish,
  onPublishChange,
  posterChoices,
  people,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  visible: boolean;
  name: string;
  onNameChange: (v: string) => void;
  share: ListShareDraft;
  onShareChange: (share: ListShareDraft) => void;
  publish: WatchlistGlobalPublish;
  onPublishChange: (publish: WatchlistGlobalPublish) => void;
  posterChoices: readonly { title: string; posterPath: string }[];
  people: HouseholdPerson[];
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const globalReady =
    share.visibility !== 'global' ||
    (Boolean(name.trim()) &&
      Boolean(publish.blurb.trim()) &&
      publish.samplePosterPaths.length > 0);
  return (
    <Sheet visible={visible} title="List settings" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={onNameChange} />
        <SharePicker share={share} onChange={onShareChange} people={people} allowGlobal />
        {share.visibility === 'global' ? (
          <GlobalPublishFields publish={publish} onChange={onPublishChange} posterChoices={posterChoices} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label="Save" onPress={() => void onSave()} busy={busy} disabled={!name.trim() || !globalReady} />
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
  const [hits, setHits] = useState<WatchlistSearchHitWithRole[]>([]);
  const [people, setPeople] = useState<WatchlistPersonHit[]>([]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
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
    setPeople([]);
    setPersonId(null);
    setPersonName(null);
    setPicked(null);
    setResolved(null);
    setListId(defaultListId ?? lists[0]?.id ?? null);
    setStatus('want');
    setLocalError(null);
    setSourceUrl(null);
  }, [defaultListId, lists, visible]);

  async function runSearch(nextPersonId?: number | null) {
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
          setPeople([]);
          setPersonId(null);
          setPersonName(null);
          setLocalError(listError);
          return;
        }
        setSourceUrl(trimmed);
        const results = await resolveWatchlistLink(trimmed, country);
        setHits(results);
        setPeople([]);
        setPersonId(null);
        setPersonName(null);
        if (results.length === 1 && results[0]) {
          await pickHit(results[0], trimmed);
        } else if (results.length === 0) {
          setLocalError('No title matched that link. Try searching by name.');
        }
      } else {
        setSourceUrl(null);
        const payload = await searchWatchlistWithPeople(trimmed, country, {
          personId: nextPersonId ?? null,
        });
        setHits(payload.results);
        setPeople(payload.people);
        setPersonId(payload.personId);
        setPersonName(payload.personName);
        if (payload.results.length === 0) {
          setLocalError('No titles matched. Try a movie, a year, or a person\'s name.');
        }
      }
    } catch (err) {
      setHits([]);
      setPeople([]);
      setPersonId(null);
      setPersonName(null);
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
          placeholder="The Bear, Tom Hanks, or an IMDb / RT URL"
          autoCapitalize="none"
          onSubmitEditing={() => void runSearch()}
        />
        <Text style={styles.hint}>
          Search a title or person on TMDB, or paste a movie/series page from IMDb, TMDB, Rotten Tomatoes, Letterboxd, or
          JustWatch.
        </Text>
        <Btn label="Search" onPress={() => void runSearch()} busy={searching} disabled={!query.trim() || searching} />
        {hits.length > 0 && !picked ? (
          <View style={styles.hits}>
            {people.length > 1 ? (
              <View style={styles.wrap}>
                {people.map((person) => (
                  <Pill
                    key={person.id}
                    label={person.name}
                    active={person.id === personId}
                    onPress={() => void runSearch(person.id)}
                  />
                ))}
              </View>
            ) : null}
            {personName ? <Text style={styles.hint}>Movies with {personName}</Text> : null}
            {hits.map((hit) => {
              const poster = tmdbImageUrl(hit.posterPath, 'w92');
              return (
                <Pressable key={`${hit.mediaType}-${hit.tmdbId}`} onPress={() => void pickHit(hit)} style={styles.hit}>
                  {poster ? <Image source={{ uri: poster }} style={styles.hitPoster} /> : <View style={styles.hitPoster} />}
                  <View style={styles.hitCopy}>
                    <Text style={styles.hitName}>{hit.title}</Text>
                    <Text style={styles.hint}>
                      {titleYearLabel(hit)}
                      {hit.role ? ` · ${hit.role}` : ''}
                    </Text>
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

export function CuratedTitleSheet({
  visible,
  hit,
  country,
  lists,
  savedListIds,
  onClose,
  onAdd,
  busy,
  error,
}: {
  visible: boolean;
  hit: WatchlistSearchHit | null;
  country: string;
  lists: readonly WatchlistList[];
  savedListIds: ReadonlySet<string>;
  onClose: () => void;
  onAdd: (hit: WatchlistSearchHit, listId: string, status: WatchlistItemStatus) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [resolved, setResolved] = useState<WatchlistResolvedTitle | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [status, setStatus] = useState<WatchlistItemStatus>('want');
  const [loading, setLoading] = useState(false);
  const hitKey = hit ? `${hit.mediaType}-${hit.tmdbId}` : '';
  const pickedFor = useRef('');

  useEffect(() => {
    if (!visible) return;
    setStatus('want');
  }, [hitKey, visible]);

  useEffect(() => {
    if (!visible || !hit) {
      pickedFor.current = '';
      return;
    }
    if (pickedFor.current === hitKey && listId && lists.some((list) => list.id === listId)) return;
    pickedFor.current = hitKey;
    const open = lists.find((list) => !savedListIds.has(list.id)) ?? lists[0] ?? null;
    setListId(open?.id ?? null);
  }, [hit, hitKey, listId, lists, savedListIds, visible]);

  useEffect(() => {
    if (!visible || !hit) return;
    const tmdbId = hit.tmdbId;
    const mediaType = hit.mediaType;
    let cancelled = false;
    setResolved(null);
    setLoading(true);
    void lookupWatchlistCatalog({
      tmdbId,
      mediaType,
      country,
    })
      .then((next) => {
        if (!cancelled) setResolved(next);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, hitKey, visible]);

  if (!hit) return null;
  const poster = tmdbImageUrl(resolved?.posterPath ?? hit.posterPath, 'w185');
  const overview = resolved?.overview ?? hit.overview;
  const selected = lists.find((list) => list.id === listId) ?? null;
  const already = selected ? savedListIds.has(selected.id) : false;
  const savedNames = lists.filter((list) => savedListIds.has(list.id)).map((list) => list.name);

  return (
    <Sheet visible={visible} title={hit.title} onClose={onClose} wide>
      <View style={styles.stack}>
        <View style={styles.hero}>
          {poster ? <Image source={{ uri: poster }} style={styles.heroPoster} /> : <View style={styles.heroPoster} />}
          <View style={styles.heroCopy}>
            <Text style={styles.previewTitle}>{hit.title}</Text>
            <Text style={styles.hint}>
              {hit.year ? `${hit.year} · ` : ''}
              {mediaTypeLabel(hit.mediaType)}
            </Text>
            {savedNames.length > 0 ? <Text style={styles.hint}>Already on {savedNames.join(', ')}</Text> : null}
          </View>
        </View>
        {loading ? <Text style={styles.hint}>Loading details…</Text> : null}
        {overview ? <Text style={styles.overview}>{overview}</Text> : null}
        <Text style={styles.label}>Where to watch in {country}</Text>
        <ProviderChips providers={resolved?.providers ?? []} />
        {resolved?.trailerUrl || resolved?.tmdbWatchUrl ? (
          <View style={styles.wrap}>
            {resolved.trailerUrl ? <Btn label="Watch trailer" onPress={() => openExternal(resolved.trailerUrl)} /> : null}
            {resolved.tmdbWatchUrl ? (
              <Btn label="Open where to watch" variant="secondary" onPress={() => openExternal(resolved.tmdbWatchUrl)} />
            ) : null}
          </View>
        ) : null}
        {lists.length > 0 ? (
          <>
            <Text style={styles.label}>Add to</Text>
            <View style={styles.wrap}>
              {lists.map((list) => (
                <Pill
                  key={list.id}
                  label={savedListIds.has(list.id) ? `${list.name} · on list` : list.name}
                  active={listId === list.id}
                  onPress={() => setListId(list.id)}
                />
              ))}
            </View>
            <Text style={styles.label}>Status</Text>
            <View style={styles.wrap}>
              {WATCHLIST_ITEM_STATUSES.map((item) => (
                <Pill key={item} label={itemStatusLabel(item)} active={status === item} onPress={() => setStatus(item)} />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>Create a watchlist first, then you can add this title.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label={already && selected ? `Already on ${selected.name}` : selected ? `Add to ${selected.name}` : 'Add to a watchlist'}
          onPress={() => selected && !already && void onAdd(hit, selected.id, status)}
          busy={busy}
          disabled={!selected || already || busy}
        />
      </View>
    </Sheet>
  );
}

const REVIEW_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function TitleReviews({
  reviews,
  people,
  selfName,
  selfPersonId,
  defaultPersonId,
  resetKey,
  busy,
  onSave,
  onDelete,
  audience = 'household',
  heading,
  hint,
}: {
  reviews: WatchlistReview[];
  people: HouseholdPerson[];
  selfName: string;
  selfPersonId: string | null;
  defaultPersonId: string | null;
  resetKey: string;
  busy?: boolean;
  onSave: (personId: string, score: number, body: string) => Promise<void>;
  onDelete: (reviewId: string) => Promise<void>;
  audience?: 'household' | 'self';
  heading?: string;
  hint?: string;
}) {
  const [personId, setPersonId] = useState<string | null>(defaultPersonId);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const loaded = useRef('');
  const appliedTitle = useRef('');

  useEffect(() => {
    const key = `${resetKey}:${defaultPersonId ?? ''}`;
    if (appliedTitle.current === key) return;
    const titleChanged = !appliedTitle.current.startsWith(`${resetKey}:`);
    appliedTitle.current = key;
    if (titleChanged || personId == null || personId === 'self') setPersonId(defaultPersonId);
  }, [defaultPersonId, personId, resetKey]);

  const current = reviews.find((review) => review.personId === personId) ?? null;
  useEffect(() => {
    const stamp = `${resetKey}:${personId ?? ''}:${current?.updatedAt ?? 'new'}`;
    if (loaded.current === stamp) return;
    loaded.current = stamp;
    setScore(current?.score ?? null);
    setBody(current?.body ?? '');
  }, [current, personId, resetKey]);
  const average = familyReviewAverage(reviews.map((review) => review.score));

  const youId = selfPersonId ?? 'self';
  const writerName =
    personId === youId || personId === 'self' ? selfName : (people.find((person) => person.id === personId)?.name ?? null);
  const others = people.filter((person) => person.id !== selfPersonId);

  const scoreRow = (
    <View style={styles.wrap}>
      {REVIEW_SCORES.map((value) => (
        <Pill key={value} label={String(value)} active={score === value} onPress={() => setScore(value)} />
      ))}
    </View>
  );

  if (audience === 'self') {
    return (
      <View style={styles.preview}>
        <Text style={styles.label}>{heading ?? 'Your review'}</Text>
        {scoreRow}
        <Field
          label="Review"
          value={body}
          onChangeText={setBody}
          placeholder="Optional"
          multiline
          autoCapitalize="sentences"
          autoCorrect
        />
        <Btn
          label={current ? 'Update your review' : 'Save your review'}
          onPress={() => personId && score && void onSave(personId, score, body)}
          busy={busy}
          disabled={!personId || !score || busy}
        />
        {current ? (
          <Btn label="Delete your review" variant="danger" onPress={() => void onDelete(current.id)} disabled={busy} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.preview}>
      <Text style={styles.label}>
        {heading ?? 'Family reviews'}
        {average != null ? ` · ${average}` : ''}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {[
        { id: youId, name: `${selfName} (you)` },
        ...others.map((person) => ({ id: person.id, name: person.name })),
      ].map((person) => {
        const review =
          person.id === 'self' ? null : (reviews.find((row) => row.personId === person.id) ?? null);
        return (
          <View key={person.id} style={styles.reviewRow}>
            <Text style={styles.hitName}>
              {person.name}
              {review ? ` · ${review.score}/10` : ' · No review'}
            </Text>
            {review?.body ? <Text style={styles.hint}>{review.body}</Text> : null}
            <View style={styles.wrap}>
              <Pill
                label={review ? 'Edit' : 'Write'}
                active={personId === person.id}
                onPress={() => setPersonId(person.id)}
              />
              {review ? <Pill label="Delete" onPress={() => void onDelete(review.id)} /> : null}
            </View>
          </View>
        );
      })}
      <Text style={styles.label}>{writerName ? `Writing as ${writerName}` : 'Choose who is writing'}</Text>
      {scoreRow}
      <Field
        label="Review"
        value={body}
        onChangeText={setBody}
        placeholder="What did you think?"
        multiline
        autoCapitalize="sentences"
        autoCorrect
      />
      <Btn
        label={writerName ? (current ? `Update ${writerName}'s review` : `Save ${writerName}'s review`) : 'Save review'}
        onPress={() => personId && score && void onSave(personId, score, body)}
        busy={busy}
        disabled={!personId || !score || busy}
      />
      {current ? (
        <Btn label={`Delete ${writerName ?? 'this'} review`} variant="danger" onPress={() => void onDelete(current.id)} disabled={busy} />
      ) : null}
    </View>
  );
}

export function TitleSheet({
  visible,
  entry,
  country,
  reviews,
  people,
  selfName,
  selfPersonId,
  defaultPersonId,
  userId,
  allowedAudience,
  onOpenGlobalList,
  onSaveReview,
  onDeleteReview,
  onClose,
  onStatus,
  onMarkWatched,
  onSaveNotes,
  onRemove,
  onRefresh,
  busy,
  error,
}: {
  visible: boolean;
  entry: WatchlistEntry | null;
  country: string;
  reviews: WatchlistReview[];
  people: HouseholdPerson[];
  selfName: string;
  selfPersonId: string | null;
  defaultPersonId: string | null;
  userId: string | null;
  allowedAudience: WatchlistAudience;
  onOpenGlobalList?: (listId: string) => void;
  onSaveReview: (personId: string, score: number, body: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onClose: () => void;
  onStatus: (status: WatchlistItemStatus) => Promise<void>;
  onMarkWatched?: () => void;
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
              active={entry.item.status === item || (item === 'watched' && entry.list.kind !== 'custom')}
              onPress={() => {
                if (item === 'watched' && onMarkWatched) {
                  onMarkWatched();
                  return;
                }
                void onStatus(item);
              }}
            />
          ))}
        </View>
        {entry.list.kind === 'watched_family' ? (
          <Text style={styles.hint}>Anyone in the family can add a score. The family score is the average.</Text>
        ) : null}
        {entry.list.kind === 'watched_private' ? (
          <Text style={styles.hint}>Only you can see this. Tap Watched to move it to the family list.</Text>
        ) : null}
        <TitleReviews
          reviews={reviews.filter((review) => review.titleId === entry.title.id)}
          people={entry.list.kind === 'watched_private' ? [] : people}
          selfName={selfName}
          selfPersonId={selfPersonId}
          defaultPersonId={defaultPersonId}
          resetKey={entry.title.id}
          busy={busy}
          onSave={onSaveReview}
          onDelete={onDeleteReview}
          audience={entry.list.kind === 'watched_private' ? 'self' : 'household'}
          heading={entry.list.kind === 'watched_family' ? 'Family score' : undefined}
        />
        <GlobalReviewsBlock
          tmdbId={entry.title.tmdbId}
          mediaType={entry.title.mediaType}
          title={entry.title.title}
          year={entry.title.year}
          posterPath={entry.title.posterPath}
          userId={userId}
          allowedAudience={allowedAudience}
          onOpenList={onOpenGlobalList}
          busy={busy}
        />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label="Save notes" variant="secondary" onPress={() => void onSaveNotes(notes)} busy={busy} />
        <Btn
          label={entry.list.kind === 'custom' ? 'Remove from list' : 'Remove from watched'}
          variant="danger"
          onPress={() => void onRemove()}
          disabled={busy}
        />
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
  reviewRow: { gap: 2 },
  posterPickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  posterPick: {
    width: 72,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
    paddingBottom: 4,
  },
  posterPickOn: { borderColor: colors.accent, borderWidth: 2 },
  posterPickImage: { width: '100%', height: 96, backgroundColor: colors.bg },
  posterPickLabel: { color: colors.textMuted, fontSize: 10, lineHeight: 12, paddingHorizontal: 4 },
});
