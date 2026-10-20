import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  CuratedWatchlist,
  CuratedWatchlistMatch,
  WatchlistAudience,
  WatchlistEntry,
  WatchlistItemStatus,
  WatchlistMediaType,
  WatchlistProviderOption,
  WatchlistSearchHit,
} from '@kinexus/domain';

import type { WatchlistPersonHit, WatchlistSearchHitWithRole } from '@/src/features/stash/watchlist-api';

import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { ListBackLink, PrimaryActions, StashChrome } from '@/src/features/stash/StashShared';
import {
  WatchlistAttribution,
  WatchlistCard,
  type WatchlistCardReview,
  WatchlistDetailToolbar,
  WatchlistIdeaActions,
  WatchlistListCard,
  type WatchlistListCardModel,
  WatchlistSectionTitle,
  WatchedHomeSection,
} from '@/src/features/stash/watchlist/WatchlistShared';
import { CuratedListDetail, CuratedListSection } from '@/src/features/stash/watchlist/CuratedLists';
import { GlobalListsSection } from '@/src/features/stash/watchlist/GlobalSocial';

export type WatchlistLayoutProps = {
  desktop: boolean;
  catalogQuery: string;
  setCatalogQuery: (v: string) => void;
  catalogHits: readonly WatchlistSearchHitWithRole[];
  catalogSearching: boolean;
  catalogMessage: string | null;
  catalogPeople: readonly WatchlistPersonHit[];
  catalogPersonId: number | null;
  catalogPersonName: string | null;
  onCatalogPersonId: (id: number) => void;
  addingKey: string | null;
  onListKeys: ReadonlySet<string>;
  onPickHit: (hit: WatchlistSearchHit) => void;
  listQuery: string;
  setListQuery: (v: string) => void;
  findInList: boolean;
  onToggleFindInList: () => void;
  listCards: WatchlistListCardModel[];
  watchedCards: WatchlistListCardModel[];
  watchedQuery: string;
  setWatchedQuery: (value: string) => void;
  watchedHits: readonly WatchlistSearchHitWithRole[];
  watchedSearching: boolean;
  watchedMessage: string | null;
  watchedPeople: readonly WatchlistPersonHit[];
  watchedPersonId: number | null;
  watchedPersonName: string | null;
  onWatchedPersonId: (id: number) => void;
  onPickWatched: (hit: WatchlistSearchHit) => void;
  scoreFor: (titleId: string) => string | null;
  searchPlaceholder: string;
  showStatus: boolean;
  catalogAddLabel: string;
  catalogOnListLabel: string;
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
  onWhatNext: () => void;
  onSurprise: () => void;
  onLikeThis: () => void;
  onServices: () => void;
  servicesLabel: string;
  curatedQuery: string;
  setCuratedQuery: (value: string) => void;
  curatedMatches: readonly CuratedWatchlistMatch[];
  curatedList: CuratedWatchlist | null;
  onOpenCurated: (id: string) => void;
  onCloseCurated: () => void;
  onOpenCuratedTitle: (hit: WatchlistSearchHit) => void;
  curatedSavedKeys: ReadonlySet<string>;
  allowedAudience: WatchlistAudience;
  viewerId: string | null;
  onOpenGlobalList: (id: string) => void;
  reviewsFor: (titleId: string) => readonly WatchlistCardReview[];
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
  if (props.curatedList) {
    return (
      <DetailShell desktop>
        <CuratedListDetail
          list={props.curatedList}
          onBack={props.onCloseCurated}
          onOpenTitle={props.onOpenCuratedTitle}
          savedKeys={props.curatedSavedKeys}
        />
      </DetailShell>
    );
  }

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
          wide
        />
        <WatchlistSectionTitle label="Your lists" />
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
        <CuratedListSection
          query={props.curatedQuery}
          setQuery={props.setCuratedQuery}
          matches={props.curatedMatches}
          wide
          onOpen={props.onOpenCurated}
        />
        <GlobalListsSection
          allowedAudience={props.allowedAudience}
          viewerId={props.viewerId}
          wide
          onOpen={props.onOpenGlobalList}
        />
      </StashChrome>
    );
  }

  const canSettings = Boolean(props.onSettings && props.canManageList(props.selectedListId));

  return (
    <DetailShell desktop>
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
        <View style={styles.grid}>
          {props.entries.map((entry) => (
            <WatchlistCard
              key={entry.item.id}
              entry={entry}
              reviews={props.reviewsFor(entry.title.id)}
              scoreLine={props.scoreFor(entry.title.id)}
              wide
              onPress={() => props.onOpen(entry)}
            />
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
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
