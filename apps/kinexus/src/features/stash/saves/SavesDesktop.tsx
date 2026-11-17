import { StyleSheet, Text, View } from 'react-native';

import {
  SAVED_LINK_STATUSES,
  SAVED_LINK_TYPES,
  statusLabel,
  type SavedLink,
  type SavedLinkStatus,
  type SavedLinkType,
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import {
  LinkCard,
  ListBackLink,
  PrimaryActions,
  SearchField,
  StashChrome,
  WishlistListCard,
  type WishlistListCardModel,
} from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';

export const UNCATEGORIZED_COLLECTION_ID = '__uncategorized__';

export type SavesLayoutProps = {
  query: string;
  setQuery: (v: string) => void;
  collectionCards: WishlistListCardModel[];
  selectedCollectionId: string | null;
  selectedCollectionName: string;
  itemCount: number;
  onBack: () => void;
  onOpenCollection: (id: string) => void;
  type: SavedLinkType | null;
  setType: (type: SavedLinkType | null) => void;
  status: SavedLinkStatus | null;
  setStatus: (status: SavedLinkStatus | null) => void;
  links: SavedLink[];
  onOpen: (link: SavedLink) => void;
  onAddLink?: () => void;
  onAddCollection?: () => void;
  onRenameCollection?: (id: string) => void;
  emptyCollections: string;
  emptyItems: string;
  online: boolean;
};

export function SavesFilters({
  type,
  setType,
  status,
  setStatus,
}: {
  type: SavedLinkType | null;
  setType: (type: SavedLinkType | null) => void;
  status: SavedLinkStatus | null;
  setStatus: (status: SavedLinkStatus | null) => void;
}) {
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const typeLabel = SAVED_LINK_TYPES.find((item) => item.id === type)?.label ?? 'Any';

  return (
    <FilterBar>
      <FilterDropdown<SavedLinkType | null>
        id="type"
        label="Type"
        value={type}
        valueLabel={typeLabel}
        open={openMenu === 'type'}
        options={[{ value: null, label: 'Any' }, ...SAVED_LINK_TYPES.map((item) => ({ value: item.id, label: item.label }))]}
        onToggle={toggleMenu}
        onSelect={pick(setType)}
      />
      <FilterDropdown<SavedLinkStatus | null>
        id="status"
        label="Status"
        value={status}
        valueLabel={status ? statusLabel(status) : 'Active'}
        open={openMenu === 'status'}
        options={[
          { value: null, label: 'Active' },
          ...SAVED_LINK_STATUSES.map((item) => ({ value: item.id, label: item.label })),
        ]}
        onToggle={toggleMenu}
        onSelect={pick(setStatus)}
      />
    </FilterBar>
  );
}

export function SavesDesktop(props: SavesLayoutProps) {
  if (!props.selectedCollectionId) {
    return (
      <StashChrome desktop>
        <PrimaryActions
          addLabel={props.onAddCollection ? 'New collection' : 'Save a link'}
          onAdd={props.onAddCollection ?? props.onAddLink ?? (() => undefined)}
          extraLabel={props.onAddCollection ? 'Save a link' : undefined}
          onExtra={props.onAddCollection ? props.onAddLink : undefined}
          disabled={!props.online || (!props.onAddCollection && !props.onAddLink)}
        />
        {props.collectionCards.length === 0 ? (
          <EmptyState title="No collections yet" body={props.emptyCollections} />
        ) : (
          <View style={styles.listGrid}>
            {props.collectionCards.map((collection) => (
              <WishlistListCard
                key={collection.id}
                list={collection}
                currency="USD"
                wide
                onPress={() => props.onOpenCollection(collection.id)}
                onSettings={
                  props.onRenameCollection && collection.id !== UNCATEGORIZED_COLLECTION_ID
                    ? () => props.onRenameCollection?.(collection.id)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </StashChrome>
    );
  }

  return (
    <StashChrome desktop title={props.selectedCollectionName}>
      <ListBackLink label="Saves" onPress={props.onBack} />
      <Text style={styles.meta}>
        {props.itemCount} item{props.itemCount === 1 ? '' : 's'}
      </Text>
      <PrimaryActions
        addLabel="Save a link"
        onAdd={props.onAddLink ?? (() => undefined)}
        disabled={!props.online || !props.onAddLink}
      />
      {props.onRenameCollection && props.selectedCollectionId !== UNCATEGORIZED_COLLECTION_ID ? (
        <View style={styles.detailActions}>
          <Pill label="Settings" onPress={() => props.onRenameCollection?.(props.selectedCollectionId!)} />
        </View>
      ) : null}
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search saves" />
      <SavesFilters type={props.type} setType={props.setType} status={props.status} setStatus={props.setStatus} />
      {props.links.length === 0 ? (
        <EmptyState title="Nothing here yet" body={props.emptyItems} />
      ) : (
        <View style={styles.grid}>
          {props.links.map((link) => (
            <LinkCard key={link.id} link={link} wide onPress={() => props.onOpen(link)} />
          ))}
        </View>
      )}
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
