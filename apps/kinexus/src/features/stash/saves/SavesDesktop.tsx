import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SAVED_LINK_STATUSES,
  SAVED_LINK_TYPES,
  statusLabel,
  type SavedLink,
  type SavedLinkCollection,
  type SavedLinkStatus,
  type SavedLinkType,
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { LinkCard, PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type SavesLayoutProps = {
  query: string;
  setQuery: (v: string) => void;
  collections: SavedLinkCollection[];
  collectionId: string | null;
  setCollectionId: (id: string | null) => void;
  type: SavedLinkType | null;
  setType: (type: SavedLinkType | null) => void;
  status: SavedLinkStatus | null;
  setStatus: (status: SavedLinkStatus | null) => void;
  links: SavedLink[];
  onOpen: (link: SavedLink) => void;
  onAddLink?: () => void;
  onAddCollection?: () => void;
  onRenameCollection: (id: string) => void;
  online: boolean;
};

export function SavesFilters({
  type,
  setType,
  status,
  setStatus,
  collections,
  collectionId,
  setCollectionId,
  showCollections = false,
}: {
  type: SavedLinkType | null;
  setType: (type: SavedLinkType | null) => void;
  status: SavedLinkStatus | null;
  setStatus: (status: SavedLinkStatus | null) => void;
  collections?: SavedLinkCollection[];
  collectionId?: string | null;
  setCollectionId?: (id: string | null) => void;
  showCollections?: boolean;
}) {
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const typeLabel = SAVED_LINK_TYPES.find((item) => item.id === type)?.label ?? 'Any';
  const collectionName = collections?.find((collection) => collection.id === collectionId)?.name ?? 'All';

  return (
    <FilterBar>
      {showCollections && setCollectionId ? (
        <FilterDropdown<string | null>
          id="collection"
          label="Collection"
          value={collectionId ?? null}
          valueLabel={collectionName}
          open={openMenu === 'collection'}
          options={[
            { value: null, label: 'All' },
            ...(collections ?? []).map((collection) => ({ value: collection.id, label: collection.name })),
          ]}
          onToggle={toggleMenu}
          onSelect={pick(setCollectionId)}
        />
      ) : null}
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
  return (
    <StashChrome
      desktop
      kicker="Library"
      title="Saves">
      {props.onAddLink ? (
        <PrimaryActions
          addLabel="Save a link"
          onAdd={props.onAddLink}
          extraLabel="New collection"
          onExtra={props.onAddCollection}
          disabled={!props.online}
        />
      ) : null}
      <View style={styles.cols}>
        <View style={styles.sidebar}>
          <Text style={styles.sideTitle}>Collections</Text>
          <Pressable onPress={() => props.setCollectionId(null)} style={[styles.all, !props.collectionId && styles.allActive]}>
            <Text style={[styles.allLabel, !props.collectionId && styles.allLabelActive]}>All saves</Text>
          </Pressable>
          {props.collections.map((collection) => (
            <Pressable
              key={collection.id}
              onPress={() => props.setCollectionId(collection.id)}
              onLongPress={() => props.onRenameCollection(collection.id)}
              style={[styles.all, props.collectionId === collection.id && styles.allActive]}>
              <Text style={[styles.allLabel, props.collectionId === collection.id && styles.allLabelActive]}>{collection.name}</Text>
            </Pressable>
          ))}
          {props.collectionId ? <Pill label="Rename / delete" onPress={() => props.onRenameCollection(props.collectionId!)} /> : null}
        </View>
        <View style={styles.main}>
          <SearchField value={props.query} onChange={props.setQuery} placeholder="Search saves" />
          <SavesFilters type={props.type} setType={props.setType} status={props.status} setStatus={props.setStatus} />
          {props.links.length === 0 ? (
            <EmptyState title="No saved links" body="Paste a URL to keep a recipe, video, article, or anything else." />
          ) : (
            <View style={styles.grid}>
              {props.links.map((link) => (
                <LinkCard key={link.id} link={link} wide onPress={() => props.onOpen(link)} />
              ))}
            </View>
          )}
        </View>
      </View>
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  sidebar: {
    width: 260,
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
  },
  allActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  allLabel: { color: colors.textMuted, fontWeight: '700' },
  allLabelActive: { color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
