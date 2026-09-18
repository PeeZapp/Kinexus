import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  WATCHLIST_ITEM_STATUSES,
  itemStatusLabel,
  watchlistVisibilityLabel,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistMediaType,
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { WatchlistAttribution, WatchlistCard } from '@/src/features/stash/watchlist/WatchlistShared';

export type WatchlistLayoutProps = {
  desktop: boolean;
  query: string;
  setQuery: (v: string) => void;
  lists: WatchlistList[];
  selectedListId: string | null;
  onSelectList: (id: string | null) => void;
  onSettings?: (id: string) => void;
  counts: Map<string, number>;
  entries: WatchlistEntry[];
  status: WatchlistItemStatus | null;
  setStatus: (status: WatchlistItemStatus | null) => void;
  mediaType: WatchlistMediaType | null;
  setMediaType: (type: WatchlistMediaType | null) => void;
  selectedListName: string;
  empty: string;
  onAddList: () => void;
  onAddTitle: () => void;
  onOpen: (entry: WatchlistEntry) => void;
  country: string;
  online: boolean;
};

export function WatchlistDesktop(props: WatchlistLayoutProps) {
  return (
    <StashChrome
      desktop
      kicker="Lists"
      title="Watchlist"
      subtitle={`Movies and series to watch. Availability is for ${props.country}. Household lists are shared; personal lists stay yours.`}>
      <PrimaryActions
        addLabel="Add title"
        onAdd={props.onAddTitle}
        extraLabel="New list"
        onExtra={props.onAddList}
        disabled={!props.online}
      />
      <View style={styles.cols}>
        <View style={styles.sidebar}>
          <Text style={styles.sideTitle}>Lists</Text>
          <Pressable
            onPress={() => props.onSelectList(null)}
            style={[styles.all, !props.selectedListId && styles.allActive]}>
            <Text style={[styles.allLabel, !props.selectedListId && styles.allLabelActive]}>All titles</Text>
          </Pressable>
          {props.lists.map((list) => (
            <Pressable
              key={list.id}
              onPress={() => props.onSelectList(list.id)}
              style={[styles.all, props.selectedListId === list.id && styles.allActive]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.allLabel, props.selectedListId === list.id && styles.allLabelActive]}
                  numberOfLines={1}>
                  {list.name}
                </Text>
                <Text style={styles.share}>{watchlistVisibilityLabel(list.visibility)}</Text>
              </View>
              <Text style={styles.count}>{props.counts.get(list.id) ?? 0}</Text>
            </Pressable>
          ))}
          {props.selectedListId && props.onSettings ? (
            <Pill label="Settings" onPress={() => props.onSettings?.(props.selectedListId!)} />
          ) : null}
        </View>
        <View style={styles.main}>
          <SearchField value={props.query} onChange={props.setQuery} placeholder="Search titles" />
          <View style={styles.wrap}>
            <Pill label="Any status" active={!props.status} onPress={() => props.setStatus(null)} />
            {WATCHLIST_ITEM_STATUSES.map((item) => (
              <Pill
                key={item}
                label={itemStatusLabel(item)}
                active={props.status === item}
                onPress={() => props.setStatus(item)}
              />
            ))}
          </View>
          <View style={styles.wrap}>
            <Pill label="Movies & series" active={!props.mediaType} onPress={() => props.setMediaType(null)} />
            <Pill label="Movies" active={props.mediaType === 'movie'} onPress={() => props.setMediaType('movie')} />
            <Pill label="Series" active={props.mediaType === 'tv'} onPress={() => props.setMediaType('tv')} />
          </View>
          <Text style={styles.meta}>
            {props.selectedListName} · {props.entries.length} title{props.entries.length === 1 ? '' : 's'}
          </Text>
          {props.entries.length === 0 ? (
            <EmptyState title="Nothing here yet" body={props.empty} />
          ) : (
            <View style={styles.grid}>
              {props.entries.map((entry) => (
                <WatchlistCard key={entry.item.id} entry={entry} wide onPress={() => props.onOpen(entry)} />
              ))}
            </View>
          )}
          <WatchlistAttribution country={props.country} />
        </View>
      </View>
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  sidebar: {
    width: 280,
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  main: { flex: 1, gap: 12, minWidth: 0 },
  sideTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  all: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  allLabel: { color: colors.textMuted, fontWeight: '700' },
  allLabelActive: { color: colors.accent },
  share: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  count: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
