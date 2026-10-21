import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  canManageWatchlist,
  canViewAudience,
  curatedWatchlistById,
  curatedWatchlistsForAudience,
  familyReviewAverage,
  filterWatchlistEntries,
  isWatchedList,
  parseWatchlistUrl,
  tmdbImageUrl,
  watchedScope,
  watchlistRecommendSeeds,
  watchlistEntries,
  watchlistListError,
  watchlistProviderOptions,
  searchCuratedWatchlists,
  watchlistVisibilityLabel,
  type WatchedScope,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type HouseholdPerson,
  type WatchlistList,
  type WatchlistMediaType,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { LoadingState } from '@/src/features/shell/states';
import { WatchlistDesktop, type WatchlistLayoutProps } from '@/src/features/stash/watchlist/WatchlistDesktop';
import { WatchlistMobile } from '@/src/features/stash/watchlist/WatchlistMobile';
import type { WatchlistCardReview, WatchlistListCardModel } from '@/src/features/stash/watchlist/WatchlistShared';
import { IdeasSheet, type WatchlistIdeaSource, type WatchlistIdeasMode } from '@/src/features/stash/watchlist/IdeasSheet';
import { ServicesSheet } from '@/src/features/stash/watchlist/ServicesSheet';
import {
  EMPTY_STREAMING_PREFS,
  loadWatchlistStreamingPrefs,
  saveWatchlistStreamingPrefs,
  type WatchlistStreamingPrefs,
} from '@/src/features/stash/watchlist-prefs';
import {
  AddTitleSheet,
  AddWatchlistSheet,
  CuratedTitleSheet,
  TitleSheet,
  WatchlistSettingsSheet,
} from '@/src/features/stash/watchlist/sheets';
import { GlobalListSheet } from '@/src/features/stash/watchlist/GlobalSocial';
import { WatchedSheet } from '@/src/features/stash/watchlist/WatchedSheet';
import { removePublicWatched, saveGlobalReview, deleteGlobalReviewForTitle, upsertPublicWatched, isTitleOnPublicProfile, clearPublicWatchedScore } from '@/src/features/stash/watchlist-social';
import type { ListShareDraft } from '@/src/features/stash/use-stash-sync';
import { useWatchlistSync, watchlistActionError } from '@/src/features/stash/use-watchlist-sync';
import {
  resolveWatchlistLink,
  searchWatchlistWithPeople,
  type WatchlistPersonHit,
  type WatchlistSearchHitWithRole,
} from '@/src/features/stash/watchlist-api';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { supabase } from '@/src/lib/supabase';

function toListCard(
  list: WatchlistList,
  entries: readonly WatchlistEntry[],
): WatchlistListCardModel {
  const listEntries = entries.filter((entry) => entry.list.id === list.id);
  const cover = listEntries.find((entry) => entry.title.posterPath)?.title.posterPath ?? null;
  return {
    id: list.id,
    name: list.name,
    coverUrl: tmdbImageUrl(cover, 'w342'),
    itemCount: listEntries.length,
    shareLabel: watchlistVisibilityLabel(list.visibility),
  };
}

function selfAdultId(
  people: readonly HouseholdPerson[],
  userId: string | null | undefined,
  displayName: string | null | undefined,
) {
  const linkedAdult = people.find((person) => userId && person.userId === userId && person.personType !== 'child');
  if (linkedAdult) return linkedAdult.id;
  const name = displayName?.trim().toLowerCase();
  if (!name) return null;
  return (
    people.find((person) => person.personType !== 'child' && person.name.trim().toLowerCase() === name)?.id ?? null
  );
}

export function WatchlistScreen() {
  const { mode } = useExperienceMode();
  const { user } = useAuth();
  const { people, role, activeHousehold, refresh } = useHousehold();
  const selfName = user?.displayName?.trim() || 'You';
  const selfId = selfAdultId(people, user?.id, selfName);
  const personId = selfId;
  const watchlist = useWatchlistSync();
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogHits, setCatalogHits] = useState<WatchlistSearchHitWithRole[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [catalogSourceUrl, setCatalogSourceUrl] = useState<string | null>(null);
  const [catalogPeople, setCatalogPeople] = useState<WatchlistPersonHit[]>([]);
  const [catalogPersonId, setCatalogPersonId] = useState<number | null>(null);
  const [catalogPersonName, setCatalogPersonName] = useState<string | null>(null);
  const [catalogPersonPick, setCatalogPersonPick] = useState<number | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState('');
  const [findInList, setFindInList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [status, setStatus] = useState<WatchlistItemStatus | null>(null);
  const [mediaType, setMediaType] = useState<WatchlistMediaType | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [addList, setAddList] = useState(false);
  const [addTitle, setAddTitle] = useState(false);
  const [ideasMode, setIdeasMode] = useState<WatchlistIdeasMode | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [streaming, setStreaming] = useState<WatchlistStreamingPrefs>(EMPTY_STREAMING_PREFS);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const streamingSave = useRef(Promise.resolve());
  const streamingTouched = useRef(false);
  const [curatedQuery, setCuratedQuery] = useState('');
  const [curatedId, setCuratedId] = useState<string | null>(null);
  const [curatedHit, setCuratedHit] = useState<WatchlistSearchHit | null>(null);
  const [globalListId, setGlobalListId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameShare, setRenameShare] = useState<ListShareDraft>({ visibility: 'household', personIds: [] });
  const [renamePublish, setRenamePublish] = useState({ blurb: '', samplePosterPaths: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [watchedQuery, setWatchedQuery] = useState('');
  const [watchedHits, setWatchedHits] = useState<WatchlistSearchHitWithRole[]>([]);
  const [watchedSearching, setWatchedSearching] = useState(false);
  const [watchedMessage, setWatchedMessage] = useState<string | null>(null);
  const [watchedSourceUrl, setWatchedSourceUrl] = useState<string | null>(null);
  const [watchedPeople, setWatchedPeople] = useState<WatchlistPersonHit[]>([]);
  const [watchedPersonId, setWatchedPersonId] = useState<number | null>(null);
  const [watchedPersonName, setWatchedPersonName] = useState<string | null>(null);
  const [watchedPersonPick, setWatchedPersonPick] = useState<number | null>(null);
  const [watchedDraft, setWatchedDraft] = useState<{
    hit: WatchlistSearchHit;
    sourceUrl: string | null;
    sourceItemId: string | null;
    queueListId: string | null;
    preferScope: WatchedScope | null;
  } | null>(null);
  const [watchedPublished, setWatchedPublished] = useState<boolean | null>(null);
  const [ownPublicReview, setOwnPublicReview] = useState<{
    score: number;
    body: string | null;
    updatedAt: string;
  } | null>(null);
  const [profileKnown, setProfileKnown] = useState(false);
  const [socialRefresh, setSocialRefresh] = useState(0);

  useEffect(() => {
    setOwnPublicReview(null);
    setProfileKnown(false);
  }, [openItemId]);

  useEffect(() => {
    if (!watchedDraft || !watchlist.userId) {
      setWatchedPublished(null);
      return;
    }
    let cancelled = false;
    setWatchedPublished(null);
    void isTitleOnPublicProfile({
      userId: watchlist.userId,
      tmdbId: watchedDraft.hit.tmdbId,
      mediaType: watchedDraft.hit.mediaType,
    })
      .then((on) => {
        if (!cancelled) setWatchedPublished(on);
      })
      .catch(() => {
        if (!cancelled) setWatchedPublished(null);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedDraft, watchlist.userId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void loadWatchlistStreamingPrefs(user)
      .then((prefs) => {
        if (!cancelled && !streamingTouched.current) setStreaming(prefs);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStreamingError(err instanceof Error ? err.message : 'Could not load your streaming services');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function updateStreaming(next: WatchlistStreamingPrefs) {
    if (!user) {
      setStreamingError('Sign in to save your streaming services.');
      return;
    }
    streamingTouched.current = true;
    setStreaming(next);
    const current = user;
    streamingSave.current = streamingSave.current.then(async () => {
      try {
        await saveWatchlistStreamingPrefs(current, next);
        setStreamingError(null);
      } catch (err) {
        setStreamingError(err instanceof Error ? err.message : 'Could not save your streaming services');
      }
    });
  }

  const servicesLabel =
    streaming.providerIds.length === 0
      ? 'Services'
      : streaming.recommendScope === 'subscribed'
        ? `My services (${streaming.providerIds.length})`
        : `Services (${streaming.providerIds.length})`;

  const entries = useMemo(
    () => watchlistEntries(watchlist.lists, watchlist.titles, watchlist.items),
    [watchlist.items, watchlist.lists, watchlist.titles],
  );

  const customLists = useMemo(
    () => watchlist.lists.filter((list) => !isWatchedList(list)),
    [watchlist.lists],
  );
  const familyList = watchlist.lists.find((list) => list.kind === 'watched_family') ?? null;
  const privateList =
    watchlist.lists.find((list) => list.kind === 'watched_private' && list.createdBy === watchlist.userId) ??
    watchlist.lists.find((list) => list.kind === 'watched_private') ??
    null;

  const listCards = useMemo(
    () =>
      customLists
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((list) => toListCard(list, entries)),
    [customLists, entries],
  );

  const watchedCards = useMemo(() => {
    function card(list: WatchlistList | null, scope: WatchedScope) {
      const name = scope === 'family' ? 'Family' : 'Private';
      const rows = list ? entries.filter((entry) => entry.list.id === list.id) : [];
      const cover = rows.find((entry) => entry.title.posterPath)?.title.posterPath ?? null;
      return {
        id: list?.id ?? scope,
        name: list?.name || name,
        coverUrl: tmdbImageUrl(cover, 'w342'),
        itemCount: rows.length,
        shareLabel: scope === 'family' ? 'Family' : 'Only you',
      };
    }
    return [card(privateList, 'private'), card(familyList, 'family')];
  }, [entries, familyList, privateList]);

  const providerScope = useMemo(
    () =>
      filterWatchlistEntries(entries, {
        listId: selectedListId,
        status,
        mediaType,
      }),
    [entries, mediaType, selectedListId, status],
  );
  const providerOptions = useMemo(() => watchlistProviderOptions(providerScope), [providerScope]);
  const visible = useMemo(() => {
    if (!selectedListId) return [];
    return filterWatchlistEntries(entries, {
      listId: selectedListId,
      status,
      mediaType,
      providerId,
      search: findInList ? listQuery : '',
    });
  }, [entries, findInList, listQuery, mediaType, providerId, selectedListId, status]);

  const onListKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!selectedListId) return keys;
    for (const entry of entries) {
      if (entry.list.id !== selectedListId) continue;
      keys.add(`${entry.title.mediaType}-${entry.title.tmdbId}`);
    }
    return keys;
  }, [entries, selectedListId]);
  const curatedSavedKeys = useMemo(() => {
    const listIds = new Set(customLists.map((list) => list.id));
    const keys = new Set<string>();
    for (const entry of entries) {
      if (!listIds.has(entry.list.id)) continue;
      keys.add(`${entry.title.mediaType}-${entry.title.tmdbId}`);
    }
    return keys;
  }, [customLists, entries]);
  const curatedHitSavedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!curatedHit) return ids;
    for (const entry of entries) {
      if (entry.title.mediaType !== curatedHit.mediaType || entry.title.tmdbId !== curatedHit.tmdbId) continue;
      if (isWatchedList(entry.list)) continue;
      ids.add(entry.list.id);
    }
    return ids;
  }, [curatedHit, entries]);

  useEffect(() => {
    const trimmed = catalogQuery.trim();
    if (!selectedListId || trimmed.length < 2) {
      setCatalogHits([]);
      setCatalogSearching(false);
      setCatalogMessage(null);
      setCatalogSourceUrl(null);
      setCatalogPeople([]);
      setCatalogPersonId(null);
      setCatalogPersonName(null);
      setCatalogPersonPick(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setCatalogSearching(true);
        setCatalogMessage(null);
        try {
          const isLink = /^https?:\/\//i.test(trimmed);
          if (isLink) {
            const listError = watchlistListError(parseWatchlistUrl(trimmed));
            if (listError) {
              if (!cancelled) {
                setCatalogHits([]);
                setCatalogSourceUrl(null);
                setCatalogPeople([]);
                setCatalogPersonId(null);
                setCatalogPersonName(null);
                setCatalogMessage(listError);
              }
              return;
            }
            const results = await resolveWatchlistLink(trimmed, watchlist.country);
            if (cancelled) return;
            setCatalogHits(results);
            setCatalogSourceUrl(trimmed);
            setCatalogPeople([]);
            setCatalogPersonId(null);
            setCatalogPersonName(null);
            setCatalogMessage(results.length === 0 ? 'No titles matched. Try a shorter name or a year.' : null);
            return;
          }
          const payload = await searchWatchlistWithPeople(trimmed, watchlist.country, {
            personId: catalogPersonPick,
          });
          if (cancelled) return;
          setCatalogHits(payload.results);
          setCatalogSourceUrl(null);
          setCatalogPeople(payload.people);
          setCatalogPersonId(payload.personId);
          setCatalogPersonName(payload.personName);
          setCatalogMessage(
            payload.results.length === 0
              ? 'No titles matched. Try a movie, a year, or a person\'s name.'
              : null,
          );
        } catch (err) {
          if (cancelled) return;
          setCatalogHits([]);
          setCatalogSourceUrl(null);
          setCatalogPeople([]);
          setCatalogPersonId(null);
          setCatalogPersonName(null);
          setCatalogMessage(err instanceof Error ? err.message : 'Search failed');
        } finally {
          if (!cancelled) setCatalogSearching(false);
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [catalogQuery, catalogPersonPick, selectedListId, watchlist.country]);

  useEffect(() => {
    const trimmed = watchedQuery.trim();
    if (selectedListId || trimmed.length < 2) {
      setWatchedHits([]);
      setWatchedSearching(false);
      setWatchedMessage(null);
      setWatchedSourceUrl(null);
      setWatchedPeople([]);
      setWatchedPersonId(null);
      setWatchedPersonName(null);
      setWatchedPersonPick(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setWatchedSearching(true);
        setWatchedMessage(null);
        try {
          const isLink = /^https?:\/\//i.test(trimmed);
          if (isLink) {
            const listError = watchlistListError(parseWatchlistUrl(trimmed));
            if (listError) {
              if (!cancelled) {
                setWatchedHits([]);
                setWatchedSourceUrl(null);
                setWatchedPeople([]);
                setWatchedPersonId(null);
                setWatchedPersonName(null);
                setWatchedMessage(listError);
              }
              return;
            }
            const results = await resolveWatchlistLink(trimmed, watchlist.country);
            if (cancelled) return;
            setWatchedHits(results);
            setWatchedSourceUrl(trimmed);
            setWatchedPeople([]);
            setWatchedPersonId(null);
            setWatchedPersonName(null);
            setWatchedMessage(results.length === 0 ? 'No titles matched. Try a shorter name or a year.' : null);
            return;
          }
          const payload = await searchWatchlistWithPeople(trimmed, watchlist.country, {
            personId: watchedPersonPick,
          });
          if (cancelled) return;
          setWatchedHits(payload.results);
          setWatchedSourceUrl(null);
          setWatchedPeople(payload.people);
          setWatchedPersonId(payload.personId);
          setWatchedPersonName(payload.personName);
          setWatchedMessage(
            payload.results.length === 0
              ? 'No titles matched. Try a movie, a year, or a person\'s name.'
              : null,
          );
        } catch (err) {
          if (cancelled) return;
          setWatchedHits([]);
          setWatchedSourceUrl(null);
          setWatchedPeople([]);
          setWatchedPersonId(null);
          setWatchedPersonName(null);
          setWatchedMessage(err instanceof Error ? err.message : 'Search failed');
        } finally {
          if (!cancelled) setWatchedSearching(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedListId, watchedPersonPick, watchedQuery, watchlist.country]);

  const selectedList = watchlist.lists.find((list) => list.id === selectedListId) ?? null;
  const openEntry: WatchlistEntry | null = entries.find((entry) => entry.item.id === openItemId) ?? null;

  function canSettings(listId: string) {
    const list = watchlist.lists.find((item) => item.id === listId);
    if (!list || isWatchedList(list)) return false;
    return canManageWatchlist(list, { userId: watchlist.userId, role, personId });
  }

  function resetListFilters() {
    setCatalogQuery('');
    setCatalogHits([]);
    setCatalogMessage(null);
    setCatalogSourceUrl(null);
    setCatalogPeople([]);
    setCatalogPersonId(null);
    setCatalogPersonName(null);
    setCatalogPersonPick(null);
    setListQuery('');
    setFindInList(false);
    setStatus(null);
    setMediaType(null);
    setProviderId(null);
  }

  function updateCatalogQuery(value: string) {
    setCatalogQuery(value);
    setCatalogPersonPick(null);
  }

  function updateWatchedQuery(value: string) {
    setWatchedQuery(value);
    setWatchedPersonPick(null);
  }

  async function openList(id: string) {
    let next = id;
    if (id === 'family' || id === 'private') {
      setActionError(null);
      setBusy(true);
      try {
        const ensured = await watchlist.ensureWatchedLists();
        next = id === 'family' ? ensured.familyId : ensured.privateId;
      } catch (err) {
        setActionError(watchlistActionError(err));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setCuratedId(null);
    setSelectedListId(next);
    resetListFilters();
  }

  function goBack() {
    setSelectedListId(null);
    resetListFilters();
  }

  function openCurated(id: string) {
    setSelectedListId(null);
    resetListFilters();
    setCuratedId(id);
  }

  function hitFromEntry(entry: WatchlistEntry): WatchlistSearchHit {
    return {
      tmdbId: entry.title.tmdbId,
      mediaType: entry.title.mediaType,
      title: entry.title.title,
      year: entry.title.year,
      overview: entry.title.overview,
      posterPath: entry.title.posterPath,
      backdropPath: entry.title.backdropPath,
      imdbId: entry.title.imdbId,
    };
  }

  function openWatched(draft: {
    hit: WatchlistSearchHit;
    sourceUrl?: string | null;
    sourceItemId?: string | null;
    queueListId?: string | null;
    preferScope?: WatchedScope | null;
  }) {
    setActionError(null);
    setWatchedDraft({
      hit: draft.hit,
      sourceUrl: draft.sourceUrl ?? null,
      sourceItemId: draft.sourceItemId ?? null,
      queueListId: draft.queueListId ?? null,
      preferScope: draft.preferScope ?? null,
    });
  }

  function toggleFindInList() {
    setFindInList((open) => {
      if (open) setListQuery('');
      return !open;
    });
  }

  async function pickHit(hit: WatchlistSearchHit) {
    if (!selectedListId) return;
    const key = `${hit.mediaType}-${hit.tmdbId}`;
    if (selectedList && isWatchedList(selectedList)) {
      if (onListKeys.has(key)) {
        const existing = entries.find(
          (entry) =>
            entry.list.id === selectedListId &&
            entry.title.mediaType === hit.mediaType &&
            entry.title.tmdbId === hit.tmdbId,
        );
        if (existing) setOpenItemId(existing.item.id);
        return;
      }
      openWatched({
        hit,
        sourceUrl: catalogSourceUrl,
        preferScope: watchedScope(selectedList),
      });
      setCatalogQuery('');
      return;
    }
    if (onListKeys.has(key)) {
      const existing = entries.find(
        (entry) =>
          entry.list.id === selectedListId &&
          entry.title.mediaType === hit.mediaType &&
          entry.title.tmdbId === hit.tmdbId,
      );
      if (existing) setOpenItemId(existing.item.id);
      return;
    }
    setAddingKey(key);
    await run(() =>
      watchlist.addTitleToList(selectedListId, hit, { status: 'want', sourceUrl: catalogSourceUrl }),
    );
    setAddingKey(null);
  }

  function openSettings(id: string) {
    const list = watchlist.lists.find((item) => item.id === id);
    setRenameId(id);
    setRenameValue(list?.name ?? '');
    setRenameShare({ visibility: list?.visibility ?? 'household', personIds: list?.personIds ?? [] });
    setRenamePublish({
      blurb: list?.blurb ?? '',
      samplePosterPaths: list?.samplePosterPaths ?? [],
    });
  }

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(watchlistActionError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const seedsFor = useCallback(
    (id: string) =>
      watchlistRecommendSeeds({
        personId: id,
        reviews: watchlist.reviews,
        entries: entries.map((entry) => ({ title: entry.title, status: entry.item.status })),
      }),
    [entries, watchlist.reviews],
  );
  const savedTitles = useMemo(() => {
    const byKey = new Map<string, { tmdbId: number; mediaType: (typeof entries)[number]['title']['mediaType'] }>();
    for (const entry of entries) {
      byKey.set(`${entry.title.mediaType}-${entry.title.tmdbId}`, {
        tmdbId: entry.title.tmdbId,
        mediaType: entry.title.mediaType,
      });
    }
    return [...byKey.values()];
  }, [entries]);
  const ideaSources = useMemo(() => {
    const rank: Record<WatchlistItemStatus, number> = { watched: 0, watching: 1, want: 2 };
    const byKey = new Map<string, WatchlistIdeaSource>();
    for (const entry of entries) {
      const key = `${entry.title.mediaType}-${entry.title.tmdbId}`;
      const next: WatchlistIdeaSource = {
        tmdbId: entry.title.tmdbId,
        mediaType: entry.title.mediaType,
        title: entry.title.title,
        year: entry.title.year,
        overview: entry.title.overview,
        posterPath: entry.title.posterPath,
        backdropPath: entry.title.backdropPath,
        imdbId: entry.title.imdbId,
        status: entry.item.status,
      };
      const current = byKey.get(key);
      if (!current || rank[next.status] < rank[current.status]) byKey.set(key, next);
    }
    return [...byKey.values()].sort(
      (a, b) => rank[a.status] - rank[b.status] || a.title.localeCompare(b.title),
    );
  }, [entries]);
  async function ensureSelfPerson(): Promise<string> {
    if (selfId) return selfId;
    if (!supabase || !activeHousehold || !user || user.isDevBypass) {
      throw new Error('Sign in to review as yourself');
    }
    const taken = people.some((person) => person.userId === user.id);
    const row = {
      household_id: activeHousehold.id,
      name: selfName,
      person_type: 'adult' as const,
      user_id: taken ? null : user.id,
    };
    let inserted = await supabase.from('household_people').insert(row).select('id').single();
    if (inserted.error && /link a login/i.test(inserted.error.message)) {
      inserted = await supabase.from('household_people').insert({ ...row, user_id: null }).select('id').single();
    }
    if (inserted.error || !inserted.data?.id) {
      throw new Error(inserted.error?.message ?? 'Could not add you to the household');
    }
    await refresh();
    return inserted.data.id;
  }

  const reviewsFor = useCallback(
    (titleId: string): WatchlistCardReview[] =>
      watchlist.reviews
        .filter((review) => review.titleId === titleId)
        .map((review) => ({
          id: review.id,
          name: people.find((person) => person.id === review.personId)?.name ?? 'Someone',
          score: review.score,
        })),
    [people, watchlist.reviews],
  );

  const layout: WatchlistLayoutProps = {
    desktop: mode === 'desktop',
    catalogQuery,
    setCatalogQuery: updateCatalogQuery,
    catalogHits,
    catalogSearching,
    catalogMessage,
    catalogPeople,
    catalogPersonId,
    catalogPersonName,
    onCatalogPersonId: setCatalogPersonPick,
    addingKey,
    onListKeys,
    onPickHit: (hit: WatchlistSearchHit) => {
      void pickHit(hit);
    },
    listQuery,
    setListQuery,
    findInList,
    onToggleFindInList: toggleFindInList,
    listCards,
    watchedCards,
    watchedQuery,
    setWatchedQuery: updateWatchedQuery,
    watchedHits,
    watchedSearching,
    watchedMessage,
    watchedPeople,
    watchedPersonId,
    watchedPersonName,
    onWatchedPersonId: setWatchedPersonPick,
    onPickWatched: (hit: WatchlistSearchHit) => {
      const sourceUrl = watchedSourceUrl;
      updateWatchedQuery('');
      openWatched({ hit, sourceUrl });
    },
    scoreFor: (titleId: string) => {
      if (!selectedList || !isWatchedList(selectedList)) return null;
      const rows = watchlist.reviews.filter((review) => review.titleId === titleId);
      if (selectedList.kind === 'watched_family') {
        const average = familyReviewAverage(rows.map((review) => review.score));
        return average == null ? null : `Family ${average}`;
      }
      const mine = selfId ? rows.find((review) => review.personId === selfId) : null;
      return mine ? `You ${mine.score}` : null;
    },
    searchPlaceholder:
      selectedList && isWatchedList(selectedList)
        ? 'Search a movie, show, or person you watched'
        : 'Search movies, shows, or people',
    showStatus: !selectedList || !isWatchedList(selectedList),
    catalogAddLabel: 'Add',
    catalogOnListLabel: selectedList && isWatchedList(selectedList) ? 'Open' : 'On list',
    selectedListId,
    selectedListName: selectedList
      ? isWatchedList(selectedList)
        ? `Watched · ${selectedList.name}`
        : selectedList.name
      : 'Watchlist',
    onBack: goBack,
    onOpenList: openList,
    onSettings: openSettings,
    canManageList: canSettings,
    entries: visible,
    status,
    setStatus,
    mediaType,
    setMediaType,
    providerId,
    setProviderId,
    providerOptions,
    emptyLists: 'Create a household or personal list, then search for a movie or paste an IMDb link.',
    emptyItems:
      selectedList && isWatchedList(selectedList)
        ? 'Search above to add a movie, show, or person you watched. A review is optional.'
        : 'Search above for a movie, show, or person, then tap a title to add it.',
    onAddList: () => setAddList(true),
    onAddTitle: () => setAddTitle(true),
    onWhatNext: () => setIdeasMode('next'),
    onSurprise: () => setIdeasMode('surprise'),
    onLikeThis: () => setIdeasMode('like'),
    onServices: () => setServicesOpen(true),
    servicesLabel,
    curatedQuery,
    setCuratedQuery,
    curatedMatches: searchCuratedWatchlists(
      curatedQuery,
      curatedWatchlistsForAudience(watchlist.allowedAudience),
    ),
    curatedList: (() => {
      const list = curatedId ? curatedWatchlistById(curatedId) : null;
      if (!list) return null;
      return canViewAudience(watchlist.allowedAudience, list.audience) ? list : null;
    })(),
    onOpenCurated: openCurated,
    onCloseCurated: () => setCuratedId(null),
    curatedSavedKeys,
    onOpenCuratedTitle: setCuratedHit,
    allowedAudience: watchlist.allowedAudience,
    viewerId: watchlist.userId,
    onOpenGlobalList: setGlobalListId,
    reviewsFor,
    onOpen: (entry: WatchlistEntry) => {
      setOpenItemId(entry.item.id);
      void watchlist.refreshTitle(entry.title).catch(() => undefined);
    },
    country: watchlist.country,
    online: watchlist.online,
  };

  const watchedTitle = watchedDraft
    ? (watchlist.titles.find(
        (title) => title.tmdbId === watchedDraft.hit.tmdbId && title.mediaType === watchedDraft.hit.mediaType,
      ) ?? null)
    : null;
  const familyItem = watchedTitle
    ? (watchlist.items.find((item) => item.titleId === watchedTitle.id && item.listId === familyList?.id) ?? null)
    : null;
  const privateItem = watchedTitle
    ? (watchlist.items.find((item) => item.titleId === watchedTitle.id && item.listId === privateList?.id) ?? null)
    : null;
  const savedWatchedItem =
    (watchedDraft?.preferScope === 'family' ? familyItem : null) ??
    (watchedDraft?.preferScope === 'private' ? privateItem : null) ??
    familyItem ??
    privateItem;
  const savedWatchedScope: WatchedScope | null =
    savedWatchedItem && familyList && savedWatchedItem.listId === familyList.id
      ? 'family'
      : savedWatchedItem
        ? 'private'
        : null;
  const myWatchedReview =
    watchedTitle && selfId
      ? (watchlist.reviews.find((review) => review.titleId === watchedTitle.id && review.personId === selfId) ?? null)
      : null;
  const otherWatchedScores = watchedTitle
    ? watchlist.reviews
        .filter((review) => review.titleId === watchedTitle.id && review.personId !== selfId)
        .map((review) => review.score)
    : [];

  function titleIsOnList(listId: string, mediaType: WatchlistMediaType, tmdbId: number) {
    return entries.some(
      (entry) => entry.list.id === listId && entry.title.mediaType === mediaType && entry.title.tmdbId === tmdbId,
    );
  }

  async function addCastTitle(hit: WatchlistSearchHit, listId: string) {
    return run(() => watchlist.addTitleToList(listId, hit, { status: 'want' }));
  }

  if (watchlist.loading && watchlist.lists.length === 0 && watchlist.items.length === 0) {
    return <LoadingState label="Loading watchlist" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ErrorText message={actionError ?? (watchlist.error ? watchlistActionError(watchlist.error) : null)} />
      {mode === 'desktop' ? <WatchlistDesktop {...layout} /> : <WatchlistMobile {...layout} />}
      <AddWatchlistSheet
        visible={addList}
        busy={busy}
        error={actionError}
        onClose={() => setAddList(false)}
        people={people}
        onSave={async (name, share) => {
          const ok = await run(() => watchlist.createList(name, share));
          if (ok) setAddList(false);
        }}
      />
      <CuratedTitleSheet
        visible={Boolean(curatedHit)}
        hit={curatedHit}
        country={watchlist.country}
        lists={customLists}
        savedListIds={curatedHitSavedIds}
        titleOnList={titleIsOnList}
        onAddFromCast={addCastTitle}
        busy={busy}
        error={actionError}
        onClose={() => setCuratedHit(null)}
        onAdd={async (hit, listId, nextStatus) => {
          if (nextStatus === 'watched') {
            setCuratedHit(null);
            openWatched({ hit, queueListId: listId });
            return;
          }
          const ok = await run(() => watchlist.addTitleToList(listId, hit, { status: nextStatus }));
          if (ok) setCuratedHit(null);
        }}
      />
      <AddTitleSheet
        visible={addTitle}
        lists={customLists}
        defaultListId={selectedList && isWatchedList(selectedList) ? null : selectedListId}
        country={watchlist.country}
        busy={busy}
        error={actionError}
        onClose={() => setAddTitle(false)}
        onAdd={async (hit, listId, nextStatus, sourceUrl) => {
          if (nextStatus === 'watched') {
            setAddTitle(false);
            openWatched({ hit, sourceUrl, queueListId: listId });
            return;
          }
          const ok = await run(() => watchlist.addTitleToList(listId, hit, { status: nextStatus, sourceUrl }));
          if (ok) setAddTitle(false);
        }}
      />
      <WatchlistSettingsSheet
        visible={Boolean(renameId)}
        name={renameValue}
        onNameChange={setRenameValue}
        share={renameShare}
        onShareChange={setRenameShare}
        publish={renamePublish}
        onPublishChange={setRenamePublish}
        posterChoices={watchlist.titles
          .filter(
            (title) =>
              Boolean(title.posterPath) &&
              watchlist.items.some((item) => item.listId === renameId && item.titleId === title.id),
          )
          .map((title) => ({ title: title.title, posterPath: title.posterPath! }))}
        people={people}
        busy={busy}
        error={actionError}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          const ok = await run(() =>
            watchlist.updateList(renameId, {
              name: renameValue,
              share: renameShare,
              publish: renameShare.visibility === 'global' ? renamePublish : undefined,
            }),
          );
          if (ok) setRenameId(null);
        }}
        onDelete={
          renameId
            ? async () => {
                const ok = await run(() => watchlist.deleteList(renameId));
                if (ok) {
                  if (selectedListId === renameId) setSelectedListId(null);
                  setRenameId(null);
                }
              }
            : undefined
        }
      />
      <TitleSheet
        visible={Boolean(openEntry)}
        entry={openEntry}
        country={watchlist.country}
        reviews={watchlist.reviews}
        people={people}
        selfName={selfName}
        selfPersonId={selfId}
        defaultPersonId={selfId ?? 'self'}
        userId={watchlist.userId}
        allowedAudience={watchlist.allowedAudience}
        onOpenGlobalList={(listId) => {
          setOpenItemId(null);
          setGlobalListId(listId);
        }}
        onSaveReview={async (reviewPersonId, score, body, opts) => {
          if (!openEntry) return;
          const ok = await run(async () => {
            const writingAsSelf = reviewPersonId === 'self' || reviewPersonId === selfId;
            const id = reviewPersonId === 'self' ? await ensureSelfPerson() : reviewPersonId;
            await watchlist.saveReview(openEntry.title.id, id, score, body);
            if (!writingAsSelf || !watchlist.userId) return;
            const title = openEntry.title;
            if (opts.showOnProfile) {
              await saveGlobalReview({
                userId: watchlist.userId,
                tmdbId: title.tmdbId,
                mediaType: title.mediaType,
                score,
                body,
                title: title.title,
                year: title.year,
                posterPath: title.posterPath,
              });
            } else if (opts.profileKnown && ownPublicReview) {
              await deleteGlobalReviewForTitle({
                userId: watchlist.userId,
                tmdbId: title.tmdbId,
                mediaType: title.mediaType,
              });
              await clearPublicWatchedScore({
                userId: watchlist.userId,
                tmdbId: title.tmdbId,
                mediaType: title.mediaType,
              });
            }
          });
          if (ok) setSocialRefresh((value) => value + 1);
        }}
        onDeleteReview={async (reviewId) => {
          const row = watchlist.reviews.find((review) => review.id === reviewId);
          const ok = await run(async () => {
            await watchlist.deleteReview(reviewId);
            if (!row || !selfId || row.personId !== selfId || !watchlist.userId || !openEntry) return;
            if (row.titleId !== openEntry.title.id || !ownPublicReview) return;
            await deleteGlobalReviewForTitle({
              userId: watchlist.userId,
              tmdbId: openEntry.title.tmdbId,
              mediaType: openEntry.title.mediaType,
            });
            await clearPublicWatchedScore({
              userId: watchlist.userId,
              tmdbId: openEntry.title.tmdbId,
              mediaType: openEntry.title.mediaType,
            });
          });
          if (ok) setSocialRefresh((value) => value + 1);
        }}
        publicReview={ownPublicReview}
        profileKnown={profileKnown}
        socialRefresh={socialRefresh}
        onOwnReview={(review) => {
          setOwnPublicReview(review);
          setProfileKnown(true);
        }}
        busy={busy}
        error={actionError}
        onClose={() => setOpenItemId(null)}
        onStatus={async (next) => {
          if (!openEntry) return;
          await run(() => watchlist.updateItem(openEntry.item.id, { status: next }));
        }}
        onMarkWatched={() => {
          if (!openEntry) return;
          const scope = watchedScope(openEntry.list);
          openWatched({
            hit: hitFromEntry(openEntry),
            sourceUrl: openEntry.title.sourceUrl,
            sourceItemId: scope ? null : openEntry.item.id,
            preferScope: scope,
          });
        }}
        onSaveNotes={async (notes) => {
          if (!openEntry) return;
          await run(() => watchlist.updateItem(openEntry.item.id, { notes }));
        }}
        onRemove={async () => {
          if (!openEntry) return;
          const ok = await run(() => watchlist.removeItem(openEntry.item.id));
          if (ok) setOpenItemId(null);
        }}
        lists={customLists}
        defaultListId={openEntry?.list.kind === 'custom' ? openEntry.list.id : (customLists[0]?.id ?? null)}
        titleOnList={titleIsOnList}
        onAddFromCast={addCastTitle}
        onRefresh={async () => {
          if (!openEntry) return;
          await run(() => watchlist.refreshTitle(openEntry.title, true));
        }}
      />
      <WatchedSheet
        visible={watchedDraft != null}
        hit={watchedDraft?.hit ?? null}
        savedScope={savedWatchedScope}
        savedItemId={savedWatchedItem?.id ?? null}
        initialScope={watchedDraft?.preferScope ?? savedWatchedScope ?? 'family'}
        myReview={myWatchedReview}
        otherScores={otherWatchedScores}
        published={savedWatchedItem == null ? true : watchedPublished === true}
        busy={busy}
        error={actionError}
        onClose={() => setWatchedDraft(null)}
        onSave={async (scope, review, opts) => {
          if (!watchedDraft) return;
          const draft = watchedDraft;
          const ok = await run(async () => {
            if (review.body.trim() && review.score == null) {
              throw new Error('Add a score to keep the note, or clear the note.');
            }
            const titleId = await watchlist.placeWatched({
              hit: draft.hit,
              sourceUrl: draft.sourceUrl,
              scope,
              sourceItemId: draft.sourceItemId,
              queueListId: draft.queueListId,
            });
            const existing = selfId
              ? watchlist.reviews.find((row) => row.titleId === titleId && row.personId === selfId)
              : null;
            if (review.score != null) {
              const person = await ensureSelfPerson();
              await watchlist.saveReview(titleId, person, review.score, review.body);
            } else if (existing) {
              await watchlist.deleteReview(existing.id);
            }
            if (watchlist.userId) {
              const titleFields = {
                userId: watchlist.userId,
                tmdbId: draft.hit.tmdbId,
                mediaType: draft.hit.mediaType,
                title: draft.hit.title,
                year: draft.hit.year,
                posterPath: draft.hit.posterPath,
              };
              if (opts.showOnProfile && review.score != null) {
                await saveGlobalReview({
                  ...titleFields,
                  score: review.score,
                  body: review.body,
                });
              } else if (opts.showOnProfile) {
                await deleteGlobalReviewForTitle(titleFields);
                await upsertPublicWatched({ ...titleFields, score: null });
              } else {
                await deleteGlobalReviewForTitle(titleFields);
                await removePublicWatched(titleFields);
              }
            }
          });
          if (ok) setWatchedDraft(null);
        }}
        onRemove={async (itemId) => {
          const ok = await run(() => watchlist.removeItem(itemId));
          if (ok) {
            if (openItemId === itemId) setOpenItemId(null);
            setWatchedDraft(null);
          }
        }}
      />
      <IdeasSheet
        visible={ideasMode != null}
        mode={ideasMode}
        people={people}
        defaultPersonId={personId}
        seedsFor={seedsFor}
        library={ideaSources}
        country={watchlist.country}
        recommendScope={streaming.recommendScope}
        providerIds={streaming.providerIds}
        saved={savedTitles}
        lists={customLists}
        defaultListId={selectedList && isWatchedList(selectedList) ? (customLists[0]?.id ?? null) : selectedListId}
        busy={busy}
        error={actionError}
        onClose={() => setIdeasMode(null)}
        onAdd={async (hit, listId) => {
          await run(() => watchlist.addTitleToList(listId, hit, { status: 'want' }));
        }}
      />
      <ServicesSheet
        visible={servicesOpen}
        country={watchlist.country}
        prefs={streaming}
        error={streamingError}
        onChange={updateStreaming}
        onClose={() => setServicesOpen(false)}
      />
      <GlobalListSheet
        visible={Boolean(globalListId)}
        listId={globalListId}
        allowedAudience={watchlist.allowedAudience}
        viewerId={watchlist.userId}
        onClose={() => setGlobalListId(null)}
        onOpenList={setGlobalListId}
        onAddTitle={(hit) => {
          const activeCustom =
            selectedList && !isWatchedList(selectedList) ? selectedList.id : null;
          const listId = activeCustom ?? customLists[0]?.id ?? null;
          if (!listId) {
            setActionError('Create a watchlist first, then add titles from a shared list.');
            return;
          }
          void run(() => watchlist.addTitleToList(listId, hit, { status: 'want' }));
        }}
      />
    </View>
  );
}
