import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  canManageWatchlist,
  filterWatchlistEntries,
  tmdbImageUrl,
  watchlistEntries,
  watchlistProviderOptions,
  watchlistVisibilityLabel,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistMediaType,
  type WatchlistVisibility,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { LoadingState } from '@/src/features/shell/states';
import { WatchlistDesktop } from '@/src/features/stash/watchlist/WatchlistDesktop';
import { WatchlistMobile } from '@/src/features/stash/watchlist/WatchlistMobile';
import type { WatchlistListCardModel } from '@/src/features/stash/watchlist/WatchlistShared';
import { AddTitleSheet, AddWatchlistSheet, TitleSheet, WatchlistSettingsSheet } from '@/src/features/stash/watchlist/sheets';
import { useWatchlistSync, watchlistActionError } from '@/src/features/stash/use-watchlist-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

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

export function WatchlistScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const watchlist = useWatchlistSync();
  const [query, setQuery] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [status, setStatus] = useState<WatchlistItemStatus | null>(null);
  const [mediaType, setMediaType] = useState<WatchlistMediaType | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [addList, setAddList] = useState(false);
  const [addTitle, setAddTitle] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameVisibility, setRenameVisibility] = useState<WatchlistVisibility>('household');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const entries = useMemo(
    () => watchlistEntries(watchlist.lists, watchlist.titles, watchlist.items),
    [watchlist.items, watchlist.lists, watchlist.titles],
  );

  const listCards = useMemo(
    () =>
      watchlist.lists
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((list) => toListCard(list, entries)),
    [entries, watchlist.lists],
  );

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
      search: query,
    });
  }, [entries, mediaType, providerId, query, selectedListId, status]);

  const selectedList = watchlist.lists.find((list) => list.id === selectedListId) ?? null;
  const openEntry: WatchlistEntry | null = entries.find((entry) => entry.item.id === openItemId) ?? null;

  function canSettings(listId: string) {
    const list = watchlist.lists.find((item) => item.id === listId);
    if (!list) return false;
    return canManageWatchlist(list, { userId: watchlist.userId, role });
  }

  function openList(id: string) {
    setSelectedListId(id);
    setQuery('');
    setStatus(null);
    setMediaType(null);
    setProviderId(null);
  }

  function goBack() {
    setSelectedListId(null);
    setQuery('');
    setStatus(null);
    setMediaType(null);
    setProviderId(null);
  }

  function openSettings(id: string) {
    const list = watchlist.lists.find((item) => item.id === id);
    setRenameId(id);
    setRenameValue(list?.name ?? '');
    setRenameVisibility(list?.visibility ?? 'household');
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

  const layout = {
    desktop: mode === 'desktop',
    query,
    setQuery,
    listCards,
    selectedListId,
    selectedListName: selectedList?.name ?? 'Watchlist',
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
    emptyItems: 'Search TMDB or paste a title URL to add something.',
    onAddList: () => setAddList(true),
    onAddTitle: () => setAddTitle(true),
    onOpen: (entry: WatchlistEntry) => {
      setOpenItemId(entry.item.id);
      void watchlist.refreshTitle(entry.title).catch(() => undefined);
    },
    country: watchlist.country,
    online: watchlist.online,
  };

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
        onSave={async (name, visibility) => {
          const ok = await run(() => watchlist.createList(name, visibility));
          if (ok) setAddList(false);
        }}
      />
      <AddTitleSheet
        visible={addTitle}
        lists={watchlist.lists}
        defaultListId={selectedListId}
        country={watchlist.country}
        busy={busy}
        error={actionError}
        onClose={() => setAddTitle(false)}
        onAdd={async (hit, listId, nextStatus, sourceUrl) => {
          const ok = await run(() => watchlist.addTitleToList(listId, hit, { status: nextStatus, sourceUrl }));
          if (ok) setAddTitle(false);
        }}
      />
      <WatchlistSettingsSheet
        visible={Boolean(renameId)}
        name={renameValue}
        onNameChange={setRenameValue}
        visibility={renameVisibility}
        onVisibilityChange={setRenameVisibility}
        busy={busy}
        error={actionError}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          const ok = await run(() => watchlist.updateList(renameId, { name: renameValue, visibility: renameVisibility }));
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
        busy={busy}
        error={actionError}
        onClose={() => setOpenItemId(null)}
        onStatus={async (next) => {
          if (!openEntry) return;
          await run(() => watchlist.updateItem(openEntry.item.id, { status: next }));
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
        onRefresh={async () => {
          if (!openEntry) return;
          await run(() => watchlist.refreshTitle(openEntry.title, true));
        }}
      />
    </View>
  );
}
