import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, type StashListNode, type StashProduct } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { ListTree, PrimaryActions, ProductCard, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type CatalogLayoutProps = {
  desktop: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  query: string;
  setQuery: (v: string) => void;
  tree: StashListNode[];
  selectedListId: string | null;
  onSelectList: (id: string | null) => void;
  onRenameList?: (id: string) => void;
  counts: Map<string, number>;
  shareLabels: Map<string, string>;
  products: StashProduct[];
  currency: string;
  totals: { count: number; totalCost: number };
  selectedListName: string;
  empty: string;
  addItemLabel: string;
  onAddList?: () => void;
  onAddSublist?: () => void;
  onAddProduct: () => void;
  onOpenProduct: (product: StashProduct) => void;
  online: boolean;
};

export function CatalogDesktop(props: CatalogLayoutProps) {
  return (
    <StashChrome desktop kicker={props.kicker} title={props.title} subtitle={props.subtitle}>
      <PrimaryActions
        addLabel={props.addItemLabel}
        onAdd={props.onAddProduct}
          extraLabel={props.onAddList ? 'New wishlist' : undefined}
        onExtra={props.onAddList}
        disabled={!props.online}
      />
      <View style={styles.cols}>
        <View style={styles.sidebar}>
          <Text style={styles.sideTitle}>Wishlists</Text>
          <Pressable
            onPress={() => props.onSelectList(null)}
            style={[styles.all, !props.selectedListId && styles.allActive]}>
            <Text style={[styles.allLabel, !props.selectedListId && styles.allLabelActive]}>All items</Text>
          </Pressable>
          <ListTree
            nodes={props.tree}
            selectedId={props.selectedListId}
            counts={props.counts}
            shareLabels={props.shareLabels}
            onSelect={props.onSelectList}
          />
          {props.selectedListId && props.onRenameList ? (
            <View style={styles.sideActions}>
              <Pill label="Settings" onPress={() => props.onRenameList?.(props.selectedListId!)} />
              {props.onAddSublist ? <Pill label="Add sublist" onPress={props.onAddSublist} /> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.main}>
          <SearchField value={props.query} onChange={props.setQuery} placeholder="Search items" />
          <Text style={styles.meta}>
            {props.selectedListName} · {props.totals.count} item{props.totals.count === 1 ? '' : 's'} · {formatMoney(props.totals.totalCost, props.currency)}
          </Text>
          {props.products.length === 0 ? (
            <EmptyState title="Nothing here yet" body={props.empty} />
          ) : (
            <View style={styles.grid}>
              {props.products.map((product) => (
                <ProductCard key={product.id} product={product} currency={props.currency} wide onPress={() => props.onOpenProduct(product)} />
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
    width: 280,
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
  sideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  meta: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
