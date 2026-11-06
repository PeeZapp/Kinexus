import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  type WatchlistMediaType,
  type WatchlistProvider,
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
import { useExperienceMode } from '@/src/lib/experience-mode';
import {
  lookupWatchlistCatalog,
  resolveWatchlistLink,
  searchWatchlistWithPeople,
  type WatchlistPersonHit,
  type WatchlistSearchHitWithRole,
} from '@/src/features/stash/watchlist-api';
import { ProviderChips, openExternal } from '@/src/features/stash/watchlist/WatchlistShared';
import { GlobalReviewsBlock } from '@/src/features/stash/watchlist/GlobalSocial';
import { PersonMovies, TitleCast, type WatchlistCastMember } from '@/src/features/stash/watchlist/TitleCast';

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
  titleOnList,
  onAddFromCast,
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
  titleOnList: (listId: string, mediaType: WatchlistMediaType, tmdbId: number) => boolean;
  onAddFromCast: (hit: WatchlistSearchHit, listId: string) => Promise<boolean>;
  onClose: () => void;
  onAdd: (hit: WatchlistSearchHit, listId: string, status: WatchlistItemStatus) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const desktop = useExperienceMode().mode === 'desktop';
  const [resolved, setResolved] = useState<WatchlistResolvedTitle | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [status, setStatus] = useState<WatchlistItemStatus>('want');
  const [loading, setLoading] = useState(false);
  const [castPerson, setCastPerson] = useState<WatchlistCastMember | null>(null);
  const hitKey = hit ? `${hit.mediaType}-${hit.tmdbId}` : '';
  const pickedFor = useRef('');

  useEffect(() => {
    if (!visible) return;
    setStatus('want');
    setCastPerson(null);
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
  const watch = (
    <WatchAvailability
      providers={resolved?.providers ?? []}
      country={country}
      watchUrl={resolved?.tmdbWatchUrl ?? null}
      trailerUrl={resolved?.trailerUrl ?? null}
      resetKey={hitKey}
      loading={loading}
    />
  );
  const about = (
    <>
      <TitleIdentity
        posterUri={poster}
        year={hit.year}
        mediaType={hit.mediaType}
        context={savedNames.length > 0 ? `Already on ${savedNames.join(', ')}` : null}
      />
      <Synopsis text={overview} />
      <TitleCast tmdbId={hit.tmdbId} mediaType={hit.mediaType} active={visible} onPick={setCastPerson} />
      {lists.length > 0 ? (
        <View style={detail.section}>
          <SectionHead label="Add to" />
          <View style={detail.choices}>
            {lists.map((list) => {
              const on = listId === list.id;
              const saved = savedListIds.has(list.id);
              return (
                <Pressable
                  key={list.id}
                  onPress={() => setListId(list.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[detail.choice, on && detail.choiceOn]}>
                  <View style={[detail.radio, on && detail.radioOn]}>{on ? <View style={detail.radioDot} /> : null}</View>
                  <Text style={detail.choiceLabel} numberOfLines={1}>
                    {list.name}
                  </Text>
                  {saved ? <Text style={detail.choiceMeta}>On list</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <SectionHead label="Status" />
          <StatusSegment value={status} onChange={setStatus} />
        </View>
      ) : (
        <Text style={detail.quiet}>Create a watchlist first, then you can add this title.</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        label={already && selected ? `Already on ${selected.name}` : selected ? `Add to ${selected.name}` : 'Add to a watchlist'}
        onPress={() => selected && !already && void onAdd(hit, selected.id, status)}
        busy={busy}
        disabled={!selected || already || busy}
      />
    </>
  );

  return (
    <Sheet visible={visible} title={castPerson?.name ?? hit.title} onClose={onClose} desktopMaxWidth={1080}>
      {castPerson ? (
        <PersonMovies
          person={castPerson}
          backLabel={hit.title}
          onBack={() => setCastPerson(null)}
          excludeMovieId={hit.mediaType === 'movie' ? hit.tmdbId : null}
          lists={lists}
          defaultListId={listId}
          titleOnList={titleOnList}
          onAdd={onAddFromCast}
          busy={busy}
          error={error}
        />
      ) : desktop ? (
        <View style={detail.split}>
          <View style={detail.mainCol}>{about}</View>
          <View style={detail.sideCol}>{watch}</View>
        </View>
      ) : (
        <View style={detail.stack}>
          <TitleIdentity
            posterUri={poster}
            year={hit.year}
            mediaType={hit.mediaType}
            context={savedNames.length > 0 ? `Already on ${savedNames.join(', ')}` : null}
          />
          <Synopsis text={overview} />
          <TitleCast tmdbId={hit.tmdbId} mediaType={hit.mediaType} active={visible} onPick={setCastPerson} />
          {watch}
          {lists.length > 0 ? (
            <View style={detail.section}>
              <SectionHead label="Add to" />
              <View style={detail.choices}>
                {lists.map((list) => {
                  const on = listId === list.id;
                  const saved = savedListIds.has(list.id);
                  return (
                    <Pressable
                      key={list.id}
                      onPress={() => setListId(list.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[detail.choice, on && detail.choiceOn]}>
                      <View style={[detail.radio, on && detail.radioOn]}>{on ? <View style={detail.radioDot} /> : null}</View>
                      <Text style={detail.choiceLabel} numberOfLines={1}>
                        {list.name}
                      </Text>
                      {saved ? <Text style={detail.choiceMeta}>On list</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
              <SectionHead label="Status" />
              <StatusSegment value={status} onChange={setStatus} />
            </View>
          ) : (
            <Text style={detail.quiet}>Create a watchlist first, then you can add this title.</Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Btn
            label={already && selected ? `Already on ${selected.name}` : selected ? `Add to ${selected.name}` : 'Add to a watchlist'}
            onPress={() => selected && !already && void onAdd(hit, selected.id, status)}
            busy={busy}
            disabled={!selected || already || busy}
          />
        </View>
      )}
    </Sheet>
  );
}

const REVIEW_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const STATUS_SHORT: Record<WatchlistItemStatus, string> = {
  want: 'Want',
  watching: 'Watching',
  watched: 'Watched',
};

function SectionHead({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={detail.sectionHead}>
      <Text style={detail.sectionLabel}>{label}</Text>
      {value ? <Text style={detail.sectionValue}>{value}</Text> : null}
    </View>
  );
}

function TitleIdentity({
  posterUri,
  year,
  mediaType,
  context,
}: {
  posterUri: string | null;
  year: number | null;
  mediaType: WatchlistSearchHit['mediaType'];
  context?: string | null;
}) {
  return (
    <View style={detail.identity}>
      {posterUri ? <Image source={{ uri: posterUri }} style={detail.poster} /> : <View style={detail.poster} />}
      <View style={detail.identityCopy}>
        <Text style={detail.kicker}>
          {year ? `${year}  ·  ` : ''}
          {mediaTypeLabel(mediaType)}
        </Text>
        {context ? (
          <Text style={detail.context} numberOfLines={2}>
            {context}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Synopsis({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return <Text style={detail.synopsis}>{text.trim()}</Text>;
}

const WATCH_TABS = ['stream', 'rent', 'buy'] as const;
type WatchTab = (typeof WATCH_TABS)[number];

function providersForTab(providers: readonly WatchlistProvider[], tab: WatchTab): WatchlistProvider[] {
  const allow = tab === 'stream' ? new Set(['flatrate', 'ads', 'free']) : new Set([tab]);
  const seen = new Set<number>();
  return providers
    .filter((provider) => allow.has(provider.offerType))
    .slice()
    .sort((a, b) => a.displayPriority - b.displayPriority || a.providerName.localeCompare(b.providerName))
    .filter((provider) => {
      if (seen.has(provider.providerId)) return false;
      seen.add(provider.providerId);
      return true;
    });
}

function WatchAvailability({
  providers,
  country,
  watchUrl,
  trailerUrl,
  sourceUrl,
  resetKey,
  loading,
}: {
  providers: readonly WatchlistProvider[];
  country: string;
  watchUrl: string | null;
  trailerUrl: string | null;
  sourceUrl?: string | null;
  resetKey: string;
  loading?: boolean;
}) {
  const [tab, setTab] = useState<WatchTab>('stream');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    setTab('stream');
    setSelectedId(null);
  }, [resetKey]);
  const rows = providersForTab(providers, tab);
  const selected = rows.find((provider) => provider.providerId === selectedId) ?? null;
  const empty =
    tab === 'stream' ? 'Nothing to stream in this country yet.' : tab === 'rent' ? 'Nothing to rent in this country yet.' : 'Nothing to buy in this country yet.';
  return (
    <View style={detail.section}>
      <SectionHead label="Where to watch" value={country} />
      <View style={detail.segment}>
        {WATCH_TABS.map((item) => {
          const on = tab === item;
          const label = item === 'stream' ? 'Stream' : item === 'rent' ? 'Rent' : 'Buy';
          return (
            <Pressable
              key={item}
              onPress={() => {
                setTab(item);
                setSelectedId(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[detail.segmentItem, on && detail.segmentOn]}>
              <Text style={[detail.segmentLabel, on && detail.segmentLabelOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading ? (
        <Text style={detail.quiet}>Checking availability…</Text>
      ) : rows.length === 0 ? (
        <Text style={detail.quiet}>{empty}</Text>
      ) : (
        <View style={detail.services}>
          {rows.map((provider) => {
            const on = selected?.providerId === provider.providerId;
            const logo = tmdbImageUrl(provider.logoPath, 'w92');
            return (
              <Pressable
                key={provider.providerId}
                onPress={() => setSelectedId(on ? null : provider.providerId)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[detail.service, on && detail.serviceOn]}>
                {logo ? <Image source={{ uri: logo }} style={detail.serviceLogo} /> : <View style={detail.serviceLogo} />}
                <Text style={detail.serviceName} numberOfLines={2}>
                  {provider.providerName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={detail.actionRow}>
        {trailerUrl ? (
          <View style={detail.actionSlot}>
            <Btn label="Trailer" onPress={() => openExternal(trailerUrl)} />
          </View>
        ) : null}
        <View style={detail.actionSlot}>
          <Btn
            label={selected ? selected.providerName : 'Where to watch'}
            variant={selected ? 'primary' : 'secondary'}
            onPress={() => openExternal(watchUrl)}
            disabled={!watchUrl}
          />
        </View>
      </View>
      {sourceUrl ? (
        <Pressable onPress={() => openExternal(sourceUrl)} hitSlop={6} accessibilityRole="button">
          <Text style={detail.link}>Original link</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusSegment({
  value,
  onChange,
}: {
  value: WatchlistItemStatus;
  onChange: (status: WatchlistItemStatus) => void;
}) {
  return (
    <View style={detail.segment}>
      {WATCHLIST_ITEM_STATUSES.map((item) => {
        const on = value === item;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            accessibilityRole="button"
            accessibilityLabel={itemStatusLabel(item)}
            accessibilityState={{ selected: on }}
            style={[detail.segmentItem, on && detail.segmentOn]}>
            <Text style={[detail.segmentLabel, on && detail.segmentLabelOn]}>{STATUS_SHORT[item]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScoreRail({ value, onChange }: { value: number | null; onChange: (score: number) => void }) {
  return (
    <View style={detail.rail}>
      {REVIEW_SCORES.map((score) => {
        const on = value === score;
        return (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            accessibilityRole="button"
            accessibilityLabel={`Score ${score}`}
            accessibilityState={{ selected: on }}
            style={[detail.railCell, on && detail.railCellOn]}>
            <Text style={[detail.railLabel, on && detail.railLabelOn]}>{score}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
  publicReview = null,
  profileKnown = false,
}: {
  reviews: WatchlistReview[];
  people: HouseholdPerson[];
  selfName: string;
  selfPersonId: string | null;
  defaultPersonId: string | null;
  resetKey: string;
  busy?: boolean;
  onSave: (
    personId: string,
    score: number,
    body: string,
    opts: { showOnProfile: boolean; profileKnown: boolean },
  ) => Promise<void>;
  onDelete: (reviewId: string) => Promise<void>;
  audience?: 'household' | 'self';
  heading?: string;
  hint?: string;
  publicReview?: { score: number; body: string | null; updatedAt: string } | null;
  profileKnown?: boolean;
}) {
  const [personId, setPersonId] = useState<string | null>(defaultPersonId);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [showOnProfile, setShowOnProfile] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const loaded = useRef('');
  const appliedTitle = useRef('');
  const profileTouched = useRef(false);

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
    if (loaded.current === stamp) {
      if (!current && publicReview && score == null && body === '') {
        setScore(publicReview.score);
        setBody(publicReview.body ?? '');
      }
      return;
    }
    loaded.current = stamp;
    setScore(current?.score ?? publicReview?.score ?? null);
    setBody(current?.body ?? publicReview?.body ?? '');
  }, [body, current, personId, publicReview, resetKey, score]);

  useEffect(() => {
    profileTouched.current = false;
    setComposerOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (profileTouched.current) return;
    setShowOnProfile(Boolean(publicReview));
  }, [publicReview, resetKey]);
  const average = familyReviewAverage(reviews.map((review) => review.score));

  const youId = selfPersonId ?? 'self';
  const writingAsSelf = personId === youId || personId === 'self' || (selfPersonId != null && personId === selfPersonId);
  const writerName = writingAsSelf ? selfName : (people.find((person) => person.id === personId)?.name ?? null);
  const others = people.filter((person) => person.id !== selfPersonId);
  const saveOpts = { showOnProfile: writingAsSelf && showOnProfile, profileKnown };
  const composer = (
    <View style={detail.composer}>
      {!writingAsSelf && writerName ? <Text style={detail.quiet}>Scoring as {writerName}</Text> : null}
      <ScoreRail value={score} onChange={setScore} />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Add a note"
        placeholderTextColor={colors.textDim}
        style={detail.noteInput}
        multiline
        autoCapitalize="sentences"
        autoCorrect
      />
      {writingAsSelf ? (
        <Pressable
          onPress={() => {
            profileTouched.current = true;
            setShowOnProfile((value) => !value);
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: showOnProfile }}
          style={detail.profileRow}>
          <View style={detail.profileCopy}>
            <Text style={detail.profileLabel}>Show on my profile</Text>
            <Text style={detail.profileHint}>Shown under your alias</Text>
          </View>
          <Text style={[detail.profileState, showOnProfile && detail.profileStateOn]}>{showOnProfile ? 'On' : 'Off'}</Text>
        </Pressable>
      ) : null}
      <View style={detail.composerActions}>
        {current ? (
          <Pressable onPress={() => void onDelete(current.id)} disabled={busy} hitSlop={6} accessibilityRole="button">
            <Text style={[detail.deleteLabel, busy && detail.linkDisabled]}>Delete</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => personId && score && void onSave(personId, score, body, saveOpts)}
          disabled={!personId || !score || busy}
          accessibilityRole="button"
          style={[detail.saveBtn, (!personId || !score || busy) && detail.saveOff]}>
          <Text style={detail.saveLabel}>{busy ? 'Saving…' : current ? 'Update' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );

  if (audience === 'self') {
    const showComposer = composerOpen || !current;
    return (
      <View style={detail.section}>
        <SectionHead label={heading ?? 'Your score'} value={current ? String(current.score) : null} />
        {current && !showComposer ? (
          <Pressable onPress={() => setComposerOpen(true)} accessibilityRole="button" style={detail.summary}>
            <Text style={current.body ? detail.personNote : detail.quiet}>{current.body || 'No note'}</Text>
            <Text style={detail.link}>Edit</Text>
          </Pressable>
        ) : (
          composer
        )}
      </View>
    );
  }

  const rows = [
    { id: youId, name: selfName, you: true },
    ...others.map((person) => ({ id: person.id, name: person.name, you: false })),
  ];

  return (
    <View style={detail.section}>
      <SectionHead label={heading ?? 'Scores'} value={average != null ? String(average) : null} />
      {hint ? <Text style={detail.quiet}>{hint}</Text> : null}
      <View style={detail.people}>
        {rows.map((person, index) => {
          const review = person.id === 'self' ? null : (reviews.find((row) => row.personId === person.id) ?? null);
          const open = composerOpen && personId === person.id;
          return (
            <View key={person.id} style={index > 0 ? detail.personRule : undefined}>
              <Pressable
                onPress={() => {
                  setPersonId(person.id);
                  setComposerOpen((openNow) => (personId === person.id ? !openNow : true));
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={detail.personRow}>
                <View style={detail.personCopy}>
                  <Text style={detail.personName} numberOfLines={1}>
                    {person.name}
                    {person.you ? <Text style={detail.you}>  ·  You</Text> : null}
                  </Text>
                  {review?.body && !open ? (
                    <Text style={detail.personNote} numberOfLines={1}>
                      {review.body}
                    </Text>
                  ) : null}
                </View>
                <Text style={[detail.scoreMark, review ? detail.scoreMarkOn : null]}>{review ? String(review.score) : '—'}</Text>
              </Pressable>
              {open ? composer : null}
            </View>
          );
        })}
      </View>
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
  publicReview = null,
  profileKnown = false,
  socialRefresh = 0,
  onOwnReview,
  onClose,
  onStatus,
  onMarkWatched,
  onSaveNotes,
  onRemove,
  onRefresh,
  lists,
  defaultListId,
  titleOnList,
  onAddFromCast,
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
  onSaveReview: (
    personId: string,
    score: number,
    body: string,
    opts: { showOnProfile: boolean; profileKnown: boolean },
  ) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  publicReview?: { score: number; body: string | null; updatedAt: string } | null;
  profileKnown?: boolean;
  socialRefresh?: number;
  onOwnReview?: (review: { score: number; body: string | null; updatedAt: string } | null) => void;
  onClose: () => void;
  onStatus: (status: WatchlistItemStatus) => Promise<void>;
  onMarkWatched?: () => void;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onRefresh: () => Promise<void>;
  lists: readonly WatchlistList[];
  defaultListId: string | null;
  titleOnList: (listId: string, mediaType: WatchlistMediaType, tmdbId: number) => boolean;
  onAddFromCast: (hit: WatchlistSearchHit, listId: string) => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
}) {
  const desktop = useExperienceMode().mode === 'desktop';
  const entryId = entry?.item.id ?? null;
  const [notes, setNotes] = useState(entry?.item.notes ?? '');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [castPerson, setCastPerson] = useState<WatchlistCastMember | null>(null);
  useEffect(() => {
    setReviewOpen(false);
    setCastPerson(null);
    if (!visible) return;
    setNotes(entry?.item.notes ?? '');
    // Only reset when this title opens, so a background refresh does not wipe a note in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, visible]);
  if (!entry) return null;
  const poster = tmdbImageUrl(entry.title.posterPath, 'w185');
  const notesDirty = notes !== (entry.item.notes ?? '');
  const statusValue: WatchlistItemStatus = entry.list.kind === 'custom' ? entry.item.status : 'watched';
  const titleReviews = reviews.filter((review) => review.titleId === entry.title.id);
  const ownReview = selfPersonId ? titleReviews.find((review) => review.personId === selfPersonId) ?? null : null;
  const reviewScore =
    entry.list.kind === 'watched_private' ? ownReview?.score ?? null : familyReviewAverage(titleReviews.map((review) => review.score));
  const identity = (
    <TitleIdentity
      posterUri={poster}
      year={entry.title.year}
      mediaType={entry.title.mediaType}
      context={`${entry.list.name}  ·  ${watchlistVisibilityLabel(entry.list.visibility)}`}
    />
  );
  const watch = (
    <WatchAvailability
      providers={entry.title.providers}
      country={country}
      watchUrl={entry.title.tmdbWatchUrl}
      trailerUrl={entry.title.trailerUrl}
      sourceUrl={entry.title.sourceUrl}
      resetKey={entry.title.id}
    />
  );
  const status = (
    <View style={detail.section}>
      <SectionHead label="Status" />
      <StatusSegment
        value={statusValue}
        onChange={(item) => {
          if (item === 'watched' && onMarkWatched) {
            onMarkWatched();
            return;
          }
          void onStatus(item);
        }}
      />
      {entry.list.kind === 'watched_family' ? (
        <Text style={detail.quiet}>The family score is the average of everyone’s ratings.</Text>
      ) : null}
      {entry.list.kind === 'watched_private' ? (
        <Text style={detail.quiet}>Only you can see this. Watched moves it to the family list.</Text>
      ) : null}
    </View>
  );
  const reviewButton = (
    <Btn
      label={reviewScore != null ? `Review · ${reviewScore}` : 'Review'}
      variant="secondary"
      onPress={() => setReviewOpen(true)}
    />
  );
  const publicScores = (
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
      refreshKey={socialRefresh}
      onOwnReview={onOwnReview}
    />
  );
  const notesBlock = (
    <View style={detail.section}>
      <View style={detail.sectionHead}>
        <Text style={detail.sectionLabel}>Notes</Text>
        {notesDirty ? (
          <Pressable onPress={() => void onSaveNotes(notes)} disabled={busy} hitSlop={6} accessibilityRole="button">
            <Text style={[detail.link, busy && detail.linkDisabled]}>Save</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="A note just for this list"
        placeholderTextColor={colors.textDim}
        style={detail.noteInput}
        multiline
        autoCapitalize="sentences"
        autoCorrect
      />
    </View>
  );
  const removeLabel = entry.list.kind === 'custom' ? 'Remove from list' : 'Remove from watched';
  return (
    <>
      <Sheet
        visible={visible}
        title={castPerson?.name ?? entry.title.title}
        onClose={onClose}
        desktopMaxWidth={1080}
        action={
          castPerson ? undefined : (
            <View style={detail.headerActions}>
              <Pressable
                onPress={() => void onRemove()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={removeLabel}
                style={[detail.headerBtn, busy && detail.linkDisabled]}>
                <Text style={detail.headerRemoveLabel}>{removeLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => void onRefresh()}
                disabled={busy}
                accessibilityRole="button"
                style={[detail.headerBtn, busy && detail.linkDisabled]}>
                <Text style={detail.headerBtnLabel}>Refresh</Text>
              </Pressable>
            </View>
          )
        }>
        {castPerson ? (
          <PersonMovies
            person={castPerson}
            backLabel={entry.title.title}
            onBack={() => setCastPerson(null)}
            excludeMovieId={entry.title.mediaType === 'movie' ? entry.title.tmdbId : null}
            lists={lists}
            defaultListId={defaultListId}
            titleOnList={titleOnList}
            onAdd={onAddFromCast}
            busy={busy}
            error={error}
          />
        ) : desktop ? (
          <View style={detail.split}>
            <View style={detail.mainCol}>
              {identity}
              <Synopsis text={entry.title.overview} />
              <TitleCast
                tmdbId={entry.title.tmdbId}
                mediaType={entry.title.mediaType}
                active={visible}
                onPick={setCastPerson}
              />
            </View>
            <View style={detail.sideCol}>
              {watch}
              {status}
              {reviewButton}
              {publicScores}
              {notesBlock}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={detail.stack}>
            {identity}
            <Synopsis text={entry.title.overview} />
            <TitleCast
              tmdbId={entry.title.tmdbId}
              mediaType={entry.title.mediaType}
              active={visible}
              onPick={setCastPerson}
            />
            {watch}
            {status}
            {reviewButton}
            {publicScores}
            {notesBlock}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}
      </Sheet>
      <Sheet visible={visible && reviewOpen} title="Review" onClose={() => setReviewOpen(false)}>
        <TitleReviews
          reviews={titleReviews}
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
          publicReview={publicReview}
          profileKnown={profileKnown}
        />
      </Sheet>
    </>
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

const detail = StyleSheet.create({
  stack: { gap: 18, paddingTop: 4, paddingBottom: space.md },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 32, paddingTop: 4, paddingBottom: space.md },
  mainCol: { flex: 1.15, minWidth: 0, gap: 18 },
  sideCol: { flex: 0.9, minWidth: 300, gap: 18 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionValue: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  identity: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  poster: { width: 64, height: 96, borderRadius: 8, backgroundColor: colors.bgHover },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 },
  kicker: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  context: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  synopsis: { color: colors.text, fontSize: 14, lineHeight: 21 },
  quiet: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  service: {
    width: 84,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  serviceOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  serviceLogo: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.bgHover },
  serviceName: { color: colors.text, fontSize: 11, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionSlot: { flex: 1, minWidth: 140 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  headerRemoveLabel: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  link: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  linkDisabled: { opacity: 0.45 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: colors.accentSoft },
  segmentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segmentLabelOn: { color: colors.accent },
  choices: { gap: 4 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  choiceOn: { backgroundColor: colors.bgHover },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  choiceLabel: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '600' },
  choiceMeta: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  people: { gap: 0 },
  personRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 6,
  },
  personCopy: { flex: 1, minWidth: 0, gap: 2 },
  personName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  you: { color: colors.textDim, fontWeight: '600' },
  personNote: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  scoreMark: {
    minWidth: 28,
    textAlign: 'right',
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreMarkOn: { color: colors.accent },
  summary: { gap: 6, paddingVertical: 2 },
  composer: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rail: { flexDirection: 'row', gap: 3 },
  railCell: {
    flex: 1,
    minHeight: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  railCellOn: { backgroundColor: colors.accent },
  railLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  railLabelOn: { color: colors.bg },
  noteInput: {
    minHeight: 40,
    maxHeight: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  profileCopy: { flex: 1, minWidth: 0, gap: 1 },
  profileLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  profileHint: { color: colors.textDim, fontSize: 12 },
  profileState: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  profileStateOn: { color: colors.accent },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOff: { opacity: 0.4 },
  saveLabel: { color: colors.bg, fontSize: 13, fontWeight: '800' },
  deleteLabel: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
