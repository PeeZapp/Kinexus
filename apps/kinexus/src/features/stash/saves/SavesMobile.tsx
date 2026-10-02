import { StyleSheet, View } from 'react-native';

import { Pill } from '@/src/features/household/ui';
import { LinkCard, PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { SavesFilters, type SavesLayoutProps } from '@/src/features/stash/saves/SavesDesktop';
import { EmptyState } from '@/src/features/shell/states';

export function SavesMobile(props: SavesLayoutProps) {
  return (
    <StashChrome
      desktop={false}
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
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search saves" />
      <SavesFilters
        type={props.type}
        setType={props.setType}
        status={props.status}
        setStatus={props.setStatus}
        collections={props.collections}
        collectionId={props.collectionId}
        setCollectionId={props.setCollectionId}
        showCollections={props.collections.length > 0}
      />
      {props.collectionId ? <Pill label="Rename / delete collection" onPress={() => props.onRenameCollection(props.collectionId!)} /> : null}
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
  stack: { gap: 10 },
});
