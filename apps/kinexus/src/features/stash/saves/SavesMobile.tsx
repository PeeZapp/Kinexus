import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/src/features/household/ui';
import {
  LinkCard,
  ListBackLink,
  PrimaryActions,
  SearchField,
  StashChrome,
  WishlistListCard,
} from '@/src/features/stash/StashShared';
import {
  SavesFilters,
  UNCATEGORIZED_COLLECTION_ID,
  type SavesLayoutProps,
} from '@/src/features/stash/saves/SavesDesktop';
import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';

export function SavesMobile(props: SavesLayoutProps) {
  if (!props.selectedCollectionId) {
    return (
      <StashChrome desktop={false}>
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
          <View style={styles.listStack}>
            {props.collectionCards.map((collection) => (
              <WishlistListCard
                key={collection.id}
                list={collection}
                currency="USD"
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
    <StashChrome desktop={false} title={props.selectedCollectionName}>
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
  meta: { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listStack: { gap: space.md },
  stack: { gap: 10 },
});
