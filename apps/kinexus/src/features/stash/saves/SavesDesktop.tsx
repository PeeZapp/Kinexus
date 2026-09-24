import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SAVED_LINK_TYPES, type SavedLink, type SavedLinkCollection, type SavedLinkType } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
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
  links: SavedLink[];
  onOpen: (link: SavedLink) => void;
  onAddLink: () => void;
  onAddCollection: () => void;
  onRenameCollection: (id: string) => void;
  online: boolean;
};

export function SavesDesktop(props: SavesLayoutProps) {
  return (
    <StashChrome
      desktop
      kicker="Library"
      title="Saves">
      <PrimaryActions
        addLabel="Save a link"
        onAdd={props.onAddLink}
        extraLabel="New collection"
        onExtra={props.onAddCollection}
        disabled={!props.online}
      />
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
          <View style={styles.wrap}>
            <Pill label="Any type" active={!props.type} onPress={() => props.setType(null)} />
            {SAVED_LINK_TYPES.map((item) => (
              <Pill key={item.id} label={item.label} active={props.type === item.id} onPress={() => props.setType(item.id)} />
            ))}
          </View>
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
