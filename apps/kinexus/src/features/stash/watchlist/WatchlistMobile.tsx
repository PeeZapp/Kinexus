import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { ListBackLink, PrimaryActions, StashChrome } from '@/src/features/stash/StashShared';
import type { WatchlistLayoutProps } from '@/src/features/stash/watchlist/WatchlistDesktop';
import {
  WatchlistAttribution,
  WatchlistCard,
  WatchlistDetailToolbar,
  WatchlistIdeaActions,
  WatchlistListCard,
  WatchlistSectionTitle,
  WatchedHomeSection,
} from '@/src/features/stash/watchlist/WatchlistShared';
import { CuratedListDetail, CuratedListSection } from '@/src/features/stash/watchlist/CuratedLists';
import { GlobalListsSection } from '@/src/features/stash/watchlist/GlobalSocial';

export function WatchlistMobile(props: WatchlistLayoutProps) {
  if (props.curatedList) {
    return (
      <ScrollView style={styles.shell} contentContainerStyle={styles.shellContent}>
        <CuratedListDetail
          list={props.curatedList}
          onBack={props.onCloseCurated}
          onOpenTitle={props.onOpenCuratedTitle}
          savedKeys={props.curatedSavedKeys}
        />
      </ScrollView>
    );
  }

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
        <WatchlistIdeaActions
          onNext={props.onWhatNext}
          onSurprise={props.onSurprise}
          onLike={props.onLikeThis}
          onServices={props.onServices}
          servicesLabel={props.servicesLabel}
          disabled={!props.online}
        />
        <WatchedHomeSection
          cards={props.watchedCards}
          query={props.watchedQuery}
          setQuery={props.setWatchedQuery}
          hits={props.watchedHits}
          searching={props.watchedSearching}
          message={props.watchedMessage}
          people={props.watchedPeople}
          personId={props.watchedPersonId}
          personName={props.watchedPersonName}
          onPersonId={props.onWatchedPersonId}
          onPick={props.onPickWatched}
          onOpenList={props.onOpenList}
          online={props.online}
        />
        <WatchlistSectionTitle label="Your lists" />
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
        <CuratedListSection
          query={props.curatedQuery}
          setQuery={props.setCuratedQuery}
          matches={props.curatedMatches}
          onOpen={props.onOpenCurated}
        />
        <GlobalListsSection
          allowedAudience={props.allowedAudience}
          viewerId={props.viewerId}
          onOpen={props.onOpenGlobalList}
        />
      </StashChrome>
    );
  }

  const canSettings = Boolean(props.onSettings && props.canManageList(props.selectedListId));

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.shellContent}>
      <ListBackLink label="Watchlists" onPress={props.onBack} />
      <WatchlistIdeaActions
        onNext={props.onWhatNext}
        onSurprise={props.onSurprise}
        onLike={props.onLikeThis}
        onServices={props.onServices}
        servicesLabel={props.servicesLabel}
        disabled={!props.online}
      />
      <View style={styles.titleRow}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {props.selectedListName}
        </Text>
        <Text style={styles.meta}>
          {props.entries.length} · {props.country}
        </Text>
      </View>

      <WatchlistDetailToolbar
        catalogQuery={props.catalogQuery}
        setCatalogQuery={props.setCatalogQuery}
        catalogHits={props.catalogHits}
        catalogSearching={props.catalogSearching}
        catalogMessage={props.catalogMessage}
        catalogPeople={props.catalogPeople}
        catalogPersonId={props.catalogPersonId}
        catalogPersonName={props.catalogPersonName}
        onCatalogPersonId={props.onCatalogPersonId}
        addingKey={props.addingKey}
        onListKeys={props.onListKeys}
        onPickHit={props.onPickHit}
        searchPlaceholder={props.searchPlaceholder}
        showStatus={props.showStatus}
        addLabel={props.catalogAddLabel}
        onListLabel={props.catalogOnListLabel}
        listQuery={props.listQuery}
        setListQuery={props.setListQuery}
        findInList={props.findInList}
        onToggleFindInList={props.onToggleFindInList}
        status={props.status}
        setStatus={props.setStatus}
        mediaType={props.mediaType}
        setMediaType={props.setMediaType}
        providerId={props.providerId}
        setProviderId={props.setProviderId}
        providerOptions={props.providerOptions}
        onSettings={canSettings ? () => props.onSettings?.(props.selectedListId!) : undefined}
        online={props.online}
      />

      {props.entries.length === 0 ? (
        <EmptyState
          title={props.listQuery.trim() ? 'No matches' : 'Nothing here yet'}
          body={props.listQuery.trim() ? 'Nothing in this list matches that search.' : props.emptyItems}
        />
      ) : (
        <View style={styles.stack}>
          {props.entries.map((entry) => (
            <WatchlistCard
              key={entry.item.id}
              entry={entry}
              reviews={props.reviewsFor(entry.title.id)}
              scoreLine={props.scoreFor(entry.title.id)}
              onPress={() => props.onOpen(entry)}
            />
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
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listStack: { gap: space.md },
  stack: { gap: 8 },
});
