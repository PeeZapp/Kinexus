import { StyleSheet, View } from 'react-native';

import { SAVED_LINK_TYPES } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { LinkCard, PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import type { SavesLayoutProps } from '@/src/features/stash/saves/SavesDesktop';
import { EmptyState } from '@/src/features/shell/states';

export function SavesMobile(props: SavesLayoutProps) {
  return (
    <StashChrome
      desktop={false}
      kicker="Library"
      title="Saves"
      subtitle="Recipes, videos, articles, and other URLs the household wants to keep.">
      <PrimaryActions
        addLabel="Save a link"
        onAdd={props.onAddLink}
        extraLabel="New collection"
        onExtra={props.onAddCollection}
        disabled={!props.online}
      />
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search saves" />
      <View style={styles.wrap}>
        <Pill label="All" active={!props.collectionId} onPress={() => props.setCollectionId(null)} />
        {props.collections.map((collection) => (
          <Pill
            key={collection.id}
            label={collection.name}
            active={props.collectionId === collection.id}
            onPress={() => props.setCollectionId(collection.id)}
          />
        ))}
      </View>
      {props.collectionId ? <Pill label="Rename / delete collection" onPress={() => props.onRenameCollection(props.collectionId!)} /> : null}
      <View style={styles.wrap}>
        <Pill label="Any type" active={!props.type} onPress={() => props.setType(null)} />
        {SAVED_LINK_TYPES.map((item) => (
          <Pill key={item.id} label={item.label} active={props.type === item.id} onPress={() => props.setType(item.id)} />
        ))}
      </View>
      {props.links.length === 0 ? (
        <EmptyState title="No saved links" body="Paste a URL to keep a recipe, video, article, or anything else." />
      ) : (
        <View style={styles.stack}>
          {props.links.map((link) => (
            <LinkCard key={link.id} link={link} onPress={() => props.onOpen(link)} />
          ))}
        </View>
      )}
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 10 },
});
