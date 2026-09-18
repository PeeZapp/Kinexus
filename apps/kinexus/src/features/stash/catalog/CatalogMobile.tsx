import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { ListTree, PrimaryActions, ProductCard, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import type { CatalogLayoutProps } from '@/src/features/stash/catalog/CatalogDesktop';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export function CatalogMobile(props: CatalogLayoutProps) {
  return (
    <StashChrome desktop={false} kicker={props.kicker} title={props.title} subtitle={props.subtitle}>
      <PrimaryActions
        addLabel={props.addItemLabel}
        onAdd={props.onAddProduct}
          extraLabel={props.onAddList ? 'New wishlist' : undefined}
        onExtra={props.onAddList}
        disabled={!props.online}
      />
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search items" />
      <View style={styles.lists}>
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
      <Text style={styles.meta}>
        {props.selectedListName} · {props.totals.count} · {formatMoney(props.totals.totalCost, props.currency)}
      </Text>
      {props.products.length === 0 ? (
        <EmptyState title="Nothing here yet" body={props.empty} />
      ) : (
        <View style={styles.stack}>
          {props.products.map((product) => (
            <ProductCard key={product.id} product={product} currency={props.currency} onPress={() => props.onOpenProduct(product)} />
          ))}
        </View>
      )}
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  lists: {
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
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
  sideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { color: colors.textMuted, fontSize: 13 },
  stack: { gap: 10 },
});
