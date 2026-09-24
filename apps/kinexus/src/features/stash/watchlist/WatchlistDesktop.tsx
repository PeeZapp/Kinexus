import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  WatchlistEntry,
  WatchlistItemStatus,
  WatchlistMediaType,
  WatchlistProviderOption,
} from '@kinexus/domain';

import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { PrimaryActions, StashChrome } from '@/src/features/stash/StashShared';
import {
  WatchlistAttribution,
  WatchlistCard,
  WatchlistDetailToolbar,
  WatchlistListCard,
  type WatchlistListCardModel,
} from '@/src/features/stash/watchlist/WatchlistShared';

export type WatchlistLayoutProps = {
  desktop: boolean;
  query: string;
  setQuery: (v: string) => void;
  listCards: WatchlistListCardModel[];
  selectedListId: string | null;
  selectedListName: string;
  onBack: () => void;
  onOpenList: (id: string) => void;
  onSettings?: (id: string) => void;
  canManageList: (id: string) => boolean;
  entries: WatchlistEntry[];
  status: WatchlistItemStatus | null;
  setStatus: (status: WatchlistItemStatus | null) => void;
  mediaType: WatchlistMediaType | null;
  setMediaType: (type: WatchlistMediaType | null) => void;
  providerId: number | null;
  setProviderId: (id: number | null) => void;
  providerOptions: WatchlistProviderOption[];
  emptyLists: string;
  emptyItems: string;
  onAddList: () => void;
  onAddTitle: () => void;
  onOpen: (entry: WatchlistEntry) => void;
  country: string;
  online: boolean;
};

function DetailShell({ desktop, children }: { desktop: boolean; children: ReactNode }) {
  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={[styles.shellContent, desktop && styles.shellContentDesktop]}>
      {children}
    </ScrollView>
  );
}

export function WatchlistDesktop(props: WatchlistLayoutProps) {
  if (!props.selectedListId) {
    return (
      <StashChrome
        desktop
        kicker="Lists"
        title="Watchlist">
        <PrimaryActions
          addLabel="New list"
          onAdd={props.onAddList}
          extraLabel="Add title"
          onExtra={props.onAddTitle}
          disabled={!props.online}
        />
        {props.listCards.length === 0 ? (
          <EmptyState title="No watchlists yet" body={props.emptyLists} />
        ) : (
          <View style={styles.listGrid}>
            {props.listCards.map((list) => (
              <WatchlistListCard
                key={list.id}
                list={list}
                wide
                onPress={() => props.onOpenList(list.id)}
                onSettings={
                  props.onSettings && props.canManageList(list.id)
                    ? () => props.onSettings?.(list.id)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </StashChrome>
    );
  }

  const canSettings = Boolean(props.onSettings && props.canManageList(props.selectedListId));

  return (
    <DetailShell desktop>
      <Pressable onPress={props.onBack} accessibilityRole="button" accessibilityLabel="Back to watchlists">
        <Text style={styles.back}>← Watchlists</Text>
      </Pressable>
      <View style={styles.titleRow}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {props.selectedListName}
        </Text>
        <Text style={styles.meta}>
          {props.entries.length} · {props.country}
        </Text>
      </View>

      <WatchlistDetailToolbar
        query={props.query}
        setQuery={props.setQuery}
        status={props.status}
        setStatus={props.setStatus}
        mediaType={props.mediaType}
        setMediaType={props.setMediaType}
        providerId={props.providerId}
        setProviderId={props.setProviderId}
        providerOptions={props.providerOptions}
        onAddTitle={props.onAddTitle}
        onSettings={canSettings ? () => props.onSettings?.(props.selectedListId!) : undefined}
        online={props.online}
      />

      {props.entries.length === 0 ? (
        <EmptyState title="Nothing here yet" body={props.emptyItems} />
      ) : (
        <View style={styles.grid}>
          {props.entries.map((entry) => (
            <WatchlistCard key={entry.item.id} entry={entry} wide onPress={() => props.onOpen(entry)} />
          ))}
        </View>
      )}
      <WatchlistAttribution country={props.country} />
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  shellContent: { padding: space.md, gap: 14, paddingBottom: 48 },
  shellContentDesktop: { paddingHorizontal: 48, paddingTop: 16, maxWidth: 1200 },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
