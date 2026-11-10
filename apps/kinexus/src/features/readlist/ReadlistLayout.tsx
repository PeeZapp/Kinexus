import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  BookSearchHit,
  ReadlistEdition,
  ReadlistEntry,
  ReadlistProgress,
  ReadlistReview,
  ReadStatus,
} from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { Toast } from '@/src/features/meals/Toast';
import { BookPage } from '@/src/features/readlist/BookPage';
import {
  CuratedCollectionDetail,
  CuratedCollectionsSection,
} from '@/src/features/readlist/CuratedCollections';
import { WhatToReadNextSection } from '@/src/features/readlist/WhatToReadNext';
import type { ShelfKey } from '@/src/features/readlist/readlist-model';
import type {
  ReadlistCardModel,
  ReadlistListCardModel,
  ReadlistOtherListOption,
} from '@/src/features/readlist/ReadlistShared';
import { BookCard, ReadlistListCard, ReadlistSearch, ShelfTabs } from '@/src/features/readlist/ReadlistShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { ListBackLink, PrimaryActions, StashChrome } from '@/src/features/stash/StashShared';

export type ReadlistLayoutProps = {
  desktop: boolean;
  selectedListId: string | null;
  selectedListName: string;
  listCards: readonly ReadlistListCardModel[];
  onOpenList: (listId: string) => void;
  onBackToLists: () => void;
  onCloseBook: () => void;
  onAddList: () => void;
  alreadyReadOpen: boolean;
  alreadyReadCount: number;
  alreadyReadCards: ReadlistCardModel[];
  onOpenAlreadyRead: () => void;
  onAddAlreadyRead: () => void;
  onSettings?: (listId: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  canManageList: (listId: string) => boolean;
  curatedId: string | null;
  onOpenCurated: (id: string) => void;
  onCloseCurated: () => void;
  curatedSavedWorkIds: ReadonlySet<string>;
  householdId: string | null;
  userId: string | null;
  onOpenRecommendation: (hit: BookSearchHit) => void;
  onAddRecommendation: (hit: BookSearchHit) => void;
  shelf: ShelfKey;
  setShelf: (shelf: ShelfKey) => void;
  counts: Record<ShelfKey, number>;
  cards: ReadlistCardModel[];
  catalogQuery: string;
  setCatalogQuery: (value: string) => void;
  catalogHits: readonly BookSearchHit[];
  catalogSearching: boolean;
  catalogMessage: string | null;
  hitOnList: (hit: BookSearchHit) => boolean;
  addingWorkId: string | null;
  onPickHit: (hit: BookSearchHit) => void;
  onOpenCard: (card: ReadlistCardModel) => void;
  onOpenCollectionWork: (hit: BookSearchHit) => void;
  onAddCollectionWork: (hit: BookSearchHit) => void;
  selected: ReadlistEntry | null;
  selectedEditions: readonly ReadlistEdition[];
  selectedProgress: ReadlistProgress | null;
  selectedReview: ReadlistReview | null;
  otherLists: readonly ReadlistOtherListOption[];
  onAddToList: (listId: string) => Promise<void>;
  onStatus: (status: ReadStatus) => Promise<void>;
  onEdition: (editionId: string | null) => Promise<void>;
  onProgress: (input: {
    percent: number;
    pagesRead: number | null;
    secondsListened: number | null;
    editionId: string | null;
  }) => Promise<void>;
  onScore: (score: number) => Promise<void>;
  onRemove: () => Promise<void>;
  online: boolean;
  toast: { message: string; onUndo: () => void } | null;
  onDismissToast: () => void;
};

export function ReadlistLayout(props: ReadlistLayoutProps) {
  if (props.selected) {
    return (
      <ScrollView
        style={styles.shell}
        contentContainerStyle={[styles.content, props.desktop && styles.contentDesktop]}>
        <BookPage
          entry={props.selected}
          editions={props.selectedEditions}
          progress={props.selectedProgress}
          review={props.selectedReview}
          otherLists={props.otherLists}
          online={props.online}
          onBack={props.onCloseBook}
          onStatus={props.onStatus}
          onEdition={props.onEdition}
          onProgress={props.onProgress}
          onScore={props.onScore}
          onRemove={props.onRemove}
          onAddToList={props.onAddToList}
        />
      </ScrollView>
    );
  }

  if (props.curatedId) {
    return (
      <ScrollView
        style={styles.shell}
        contentContainerStyle={[styles.content, props.desktop && styles.contentDesktop]}>
        <CuratedCollectionDetail
          collectionId={props.curatedId}
          online={props.online}
          savedWorkIds={props.curatedSavedWorkIds}
          addingWorkId={props.addingWorkId}
          onBack={props.onCloseCurated}
          onOpenWork={props.onOpenCollectionWork}
          onAddWork={props.onAddCollectionWork}
        />
        <Toast
          visible={Boolean(props.toast)}
          message={props.toast?.message ?? ''}
          actionLabel="Undo"
          onAction={() => props.toast?.onUndo()}
          onDismiss={props.onDismissToast}
        />
      </ScrollView>
    );
  }

  if (props.alreadyReadOpen) {
    return (
      <View style={styles.shell}>
        <StashChrome desktop={props.desktop} title="Already read">
          <ListBackLink label="Readlists" onPress={props.onBackToLists} />
          <PrimaryActions
            addLabel="I've read"
            onAdd={props.onAddAlreadyRead}
            disabled={!props.online}
          />
          {props.alreadyReadCards.length === 0 ? (
            <EmptyState title="Nothing here yet" body="" />
          ) : (
            <View style={props.desktop ? styles.grid : styles.stack}>
              {props.alreadyReadCards.map((card) => (
                <View key={card.itemId} style={props.desktop ? styles.gridItem : undefined}>
                  <BookCard card={card} wide={props.desktop} onPress={() => props.onOpenCard(card)} />
                </View>
              ))}
            </View>
          )}
        </StashChrome>
        <Toast
          visible={Boolean(props.toast)}
          message={props.toast?.message ?? ''}
          actionLabel="Undo"
          onAction={() => props.toast?.onUndo()}
          onDismiss={props.onDismissToast}
        />
      </View>
    );
  }

  if (!props.selectedListId) {
    return (
      <View style={styles.shell}>
        <StashChrome desktop={props.desktop}>
          <PrimaryActions
            addLabel="I've read"
            onAdd={props.onAddAlreadyRead}
            extraLabel="New list"
            onExtra={props.onAddList}
            disabled={!props.online}
          />
          <Pressable
            onPress={props.onOpenAlreadyRead}
            accessibilityRole="button"
            style={styles.alreadyReadRow}>
            <Text style={styles.alreadyReadTitle}>Already read</Text>
            <Text style={styles.alreadyReadCount}>
              {props.alreadyReadCount > 0 ? String(props.alreadyReadCount) : 'Open'}
            </Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Your lists</Text>
          {props.listCards.length === 0 ? (
            <EmptyState title="No readlists yet" body="" />
          ) : (
            <View style={props.desktop ? styles.listGrid : styles.listStack}>
              {props.listCards.map((list) => (
                <View key={list.id} style={props.desktop ? styles.listGridItem : undefined}>
                  <ReadlistListCard
                    list={list}
                    wide={props.desktop}
                    onPress={() => props.onOpenList(list.id)}
                    onSettings={
                      props.onSettings && props.canManageList(list.id)
                        ? () => props.onSettings?.(list.id)
                        : undefined
                    }
                  />
                </View>
              ))}
            </View>
          )}
          <WhatToReadNextSection
            wide={props.desktop}
            online={props.online}
            householdId={props.householdId}
            userId={props.userId}
            savedWorkIds={props.curatedSavedWorkIds}
            addingWorkId={props.addingWorkId}
            onOpen={props.onOpenRecommendation}
            onAdd={props.onAddRecommendation}
          />
          <CuratedCollectionsSection
            wide={props.desktop}
            online={props.online}
            onOpen={props.onOpenCurated}
          />
        </StashChrome>
        <Toast
          visible={Boolean(props.toast)}
          message={props.toast?.message ?? ''}
          actionLabel="Undo"
          onAction={() => props.toast?.onUndo()}
          onDismiss={props.onDismissToast}
        />
      </View>
    );
  }

  const canSettings = Boolean(props.onSettings && props.canManageList(props.selectedListId));

  return (
    <View style={styles.shell}>
      <StashChrome desktop={props.desktop} title={props.selectedListName}>
        <ListBackLink label="Readlists" onPress={props.onBackToLists} />
        {canSettings || props.onImport || props.onExport ? (
          <View style={styles.actions}>
            {props.onImport ? (
              <Btn label="Import" variant="ghost" onPress={props.onImport} disabled={!props.online} />
            ) : null}
            {props.onExport ? (
              <Btn label="Export" variant="ghost" onPress={props.onExport} disabled={!props.online} />
            ) : null}
            {canSettings ? (
              <Btn label="Settings" variant="ghost" onPress={() => props.onSettings?.(props.selectedListId!)} />
            ) : null}
          </View>
        ) : null}
        <ReadlistSearch
          query={props.catalogQuery}
          setQuery={props.setCatalogQuery}
          hits={props.catalogHits}
          searching={props.catalogSearching}
          message={props.catalogMessage}
          hitOnList={props.hitOnList}
          addingWorkId={props.addingWorkId}
          onPick={props.onPickHit}
          online={props.online}
        />
        <ShelfTabs value={props.shelf} counts={props.counts} onChange={props.setShelf} />
        {props.cards.length === 0 ? (
          <EmptyState title="Nothing here yet" body="" />
        ) : (
          <View style={props.desktop ? styles.grid : styles.stack}>
            {props.cards.map((card) => (
              <View key={card.itemId} style={props.desktop ? styles.gridItem : undefined}>
                <BookCard card={card} wide={props.desktop} onPress={() => props.onOpenCard(card)} />
              </View>
            ))}
          </View>
        )}
      </StashChrome>
      <Toast
        visible={Boolean(props.toast)}
        message={props.toast?.message ?? ''}
        actionLabel="Undo"
        onAction={() => props.toast?.onUndo()}
        onDismiss={props.onDismissToast}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 14, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: space.lg, maxWidth: 920, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  alreadyReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  alreadyReadTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  alreadyReadCount: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  stack: { gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  gridItem: { width: '47%', minWidth: 240, flexGrow: 1 },
  listStack: { gap: space.md },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  listGridItem: { width: '47%', minWidth: 240, flexGrow: 1 },
});
