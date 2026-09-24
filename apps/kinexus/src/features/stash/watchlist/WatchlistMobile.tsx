import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { PrimaryActions, StashChrome } from '@/src/features/stash/StashShared';
import type { WatchlistLayoutProps } from '@/src/features/stash/watchlist/WatchlistDesktop';
import {
  WatchlistAttribution,
  WatchlistCard,
  WatchlistDetailToolbar,
  WatchlistListCard,
} from '@/src/features/stash/watchlist/WatchlistShared';

export function WatchlistMobile(props: WatchlistLayoutProps) {
  if (!props.selectedListId) {
    return (
      <StashChrome
        desktop={false}
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
          <View style={styles.listStack}>
            {props.listCards.map((list) => (
              <WatchlistListCard
                key={list.id}
                list={list}
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
    <ScrollView style={styles.shell} contentContainerStyle={styles.shellContent}>
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
        <View style={styles.stack}>
          {props.entries.map((entry) => (
            <WatchlistCard key={entry.item.id} entry={entry} onPress={() => props.onOpen(entry)} />
          ))}
        </View>
      )}
      <WatchlistAttribution country={props.country} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  shellContent: { padding: space.md, gap: 14, paddingBottom: 48 },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listStack: { gap: space.md },
  stack: { gap: 8 },
});
