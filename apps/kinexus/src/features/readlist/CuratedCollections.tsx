import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  READLIST_COLLECTION_CATEGORIES,
  type BookSearchHit,
} from '@kinexus/domain';

import {
  loadBookCollection,
  loadBookCollections,
  type ReadlistCollectionDetail,
  type ReadlistCollectionSummary,
} from '@/src/features/readlist/readlist-api';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { ListBackLink, StashPhoto } from '@/src/features/stash/StashShared';

export function CuratedCollectionsSection({
  wide,
  online,
  onOpen,
}: {
  wide?: boolean;
  online: boolean;
  onOpen: (id: string) => void;
}) {
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const [category, setCategory] = useState<string | null>(null);
  const [collections, setCollections] = useState<ReadlistCollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadBookCollections()
      .then((rows) => {
        if (!cancelled) setCollections(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load collections');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online]);

  const visible = useMemo(() => {
    if (!category) return collections;
    return collections.filter((row) => row.category === category);
  }, [category, collections]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ReadlistCollectionSummary[]>();
    for (const row of visible) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return READLIST_COLLECTION_CATEGORIES.map((label) => ({
      category: label,
      rows: map.get(label) ?? [],
    })).filter((group) => group.rows.length > 0);
  }, [visible]);

  const menuOpen = openMenu === 'collection-category';

  return (
    <View style={styles.section}>
      <View style={[styles.titleRow, menuOpen && styles.titleRowFront]}>
        <Text style={styles.kicker}>Curated collections</Text>
        <FilterBar>
          <FilterDropdown<string | null>
            id="collection-category"
            label="Category"
            value={category}
            valueLabel={category ?? 'All'}
            open={menuOpen}
            options={[
              { value: null, label: 'All' },
              ...READLIST_COLLECTION_CATEGORIES.map((label) => ({ value: label, label })),
            ]}
            onToggle={toggleMenu}
            onSelect={pick(setCategory)}
          />
        </FilterBar>
      </View>
      {loading ? <LoadingState label="Loading collections…" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState title="No collections" body="" />
      ) : null}
      {byCategory.map((group) => (
        <View key={group.category} style={styles.categoryBlock}>
          {category == null ? <Text style={styles.categoryLabel}>{group.category}</Text> : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.row, wide && styles.rowWide]}>
            {group.rows.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                wide={wide}
                onPress={() => onOpen(collection.id)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function CollectionCard({
  collection,
  wide,
  onPress,
}: {
  collection: ReadlistCollectionSummary;
  wide?: boolean;
  onPress: () => void;
}) {
  const covers = collection.coverPreviews.slice(0, 4);
  while (covers.length < 4) covers.push('');
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.strip}>
        {covers.map((uri, index) =>
          uri ? (
            <Image key={`${collection.id}-${index}`} source={{ uri }} style={styles.stripPoster} />
          ) : (
            <View key={`${collection.id}-${index}`} style={styles.stripPoster} />
          ),
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {collection.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {collection.category}
        </Text>
      </View>
    </Pressable>
  );
}

export function CuratedCollectionDetail({
  collectionId,
  online,
  savedWorkIds,
  addingWorkId,
  onBack,
  onOpenWork,
  onAddWork,
}: {
  collectionId: string;
  online: boolean;
  savedWorkIds: ReadonlySet<string>;
  addingWorkId: string | null;
  onBack: () => void;
  onOpenWork: (hit: BookSearchHit) => void;
  onAddWork: (hit: BookSearchHit) => void;
}) {
  const [detail, setDetail] = useState<ReadlistCollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadBookCollection(collectionId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load collection');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  return (
    <View style={styles.detail}>
      <ListBackLink label="Readlists" onPress={onBack} />
      <Text style={styles.detailTitle}>{detail?.title ?? 'Collection'}</Text>
      {detail ? (
        <Text style={styles.cardMeta}>
          {detail.works.length} books · Open one to read about it, or tap + to add it.
        </Text>
      ) : null}
      {loading ? <LoadingState label="Loading books…" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && detail && detail.works.length === 0 ? <EmptyState title="Nothing here yet" body="" /> : null}
      <View style={styles.rows}>
        {(detail?.works ?? []).map((hit) => {
          const saved =
            savedWorkIds.has(hit.workId) ||
            (hit.ids.openLibraryWorkId ? savedWorkIds.has(hit.ids.openLibraryWorkId) : false);
          const adding = addingWorkId === hit.workId;
          return (
            <Pressable key={hit.workId} onPress={() => onOpenWork(hit)} style={styles.rowItem} disabled={!online}>
              <StashPhoto uri={hit.coverUrl} fallback="📖" size={52} />
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {hit.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {[hit.authors.join(', '), hit.firstPublishedYear].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {saved ? (
                <Text style={[styles.action, styles.actionDone]}>Added</Text>
              ) : (
                <Pressable
                  onPress={() => onAddWork(hit)}
                  disabled={!online || adding}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${hit.title}`}>
                  <Text style={styles.action}>{adding ? '…' : '+'}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8, overflow: 'visible' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    position: 'relative',
    zIndex: 20,
    elevation: 20,
  },
  titleRowFront: { zIndex: 50, elevation: 50 },
  kicker: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  categoryBlock: { gap: 8, zIndex: 0 },
  categoryLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  row: { gap: space.md, paddingRight: space.md },
  rowWide: { paddingRight: 0 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    width: 260,
  },
  cardWide: { width: 320 },
  strip: { flexDirection: 'row', height: 132, backgroundColor: colors.bgHover },
  stripPoster: { flex: 1, height: '100%', backgroundColor: colors.bg },
  cardBody: { gap: 4, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  detail: { gap: 12 },
  detailTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  rows: { gap: 8 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  action: { color: colors.accent, fontSize: 22, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  actionDone: { color: colors.textDim, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
