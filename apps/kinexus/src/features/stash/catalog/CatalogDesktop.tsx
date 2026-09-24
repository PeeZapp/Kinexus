import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, type StashProduct } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import {
  PrimaryActions,
  ProductCard,
  SearchField,
  StashChrome,
  WishlistListCard,
  type WishlistListCardModel,
} from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type CatalogLayoutProps = {
  desktop: boolean;
  kicker: string;
  title: string;
  query: string;
  setQuery: (v: string) => void;
  listCards: WishlistListCardModel[];
  subListCards: WishlistListCardModel[];
  selectedListId: string | null;
  selectedListName: string;
  parentListName: string | null;
  onBack: () => void;
  onOpenList: (id: string) => void;
  onRenameList?: (id: string) => void;
  products: StashProduct[];
  currency: string;
  totals: { count: number; totalCost: number };
  hasSale: boolean;
  emptyLists: string;
  emptyItems: string;
  addItemLabel: string;
  onAddList?: () => void;
  onAddSublist?: () => void;
  onAddProduct: () => void;
  onOpenProduct: (product: StashProduct) => void;
  online: boolean;
  canCheckPrices: boolean;
  checkingPrices: boolean;
  priceCheckProgress: string | null;
  priceCheckSummary: string | null;
  priceCheckAlerts: string[];
  onCheckPrices: () => void;
  onDismissPriceCheck: () => void;
  onShareList?: () => void;
  shareBusy?: boolean;
  shareStatus?: string | null;
  onDismissShareStatus?: () => void;
};

export function PriceCheckBanner({
  checking,
  progress,
  summary,
  alerts,
  onDismiss,
}: {
  checking: boolean;
  progress: string | null;
  summary: string | null;
  alerts: string[];
  onDismiss: () => void;
}) {
  if (!checking && !summary) return null;
  const highlight = alerts.length > 0;
  return (
    <View style={[styles.priceBanner, highlight && styles.priceBannerAlert]}>
      <View style={styles.priceBannerBody}>
        <Text style={[styles.priceBannerTitle, highlight && styles.priceBannerTitleAlert]}>
          {checking ? progress ?? 'Checking prices…' : summary}
        </Text>
        {!checking && alerts.length > 0
          ? alerts.map((alert) => (
              <Text key={alert} style={styles.priceBannerAlertLine}>
                {alert}
              </Text>
            ))
          : null}
        {!checking && !highlight ? (
          <Text style={styles.priceBannerHint}>Prices aren’t tracked automatically — check anytime.</Text>
        ) : null}
      </View>
      {!checking ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.priceBannerDismiss}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CatalogDesktop(props: CatalogLayoutProps) {
  if (!props.selectedListId) {
    return (
      <StashChrome desktop kicker={props.kicker} title={props.title}>
        <PrimaryActions
          addLabel={props.onAddList ? 'New wishlist' : props.addItemLabel}
          onAdd={props.onAddList ?? props.onAddProduct}
          extraLabel={props.onAddList ? props.addItemLabel : undefined}
          onExtra={props.onAddList ? props.onAddProduct : undefined}
          disabled={!props.online}
        />
        {props.listCards.length === 0 ? (
          <EmptyState title="No wishlists yet" body={props.emptyLists} />
        ) : (
          <View style={styles.listGrid}>
            {props.listCards.map((list) => (
              <WishlistListCard
                key={list.id}
                list={list}
                currency={props.currency}
                wide
                onPress={() => props.onOpenList(list.id)}
                onSettings={props.onRenameList ? () => props.onRenameList?.(list.id) : undefined}
              />
            ))}
          </View>
        )}
      </StashChrome>
    );
  }

  return (
    <StashChrome desktop kicker={props.kicker} title={props.selectedListName}>
      <Pressable onPress={props.onBack} accessibilityRole="button" accessibilityLabel="Back to wishlists">
        <Text style={styles.back}>
          ← {props.parentListName ? props.parentListName : 'Wishlists'}
        </Text>
      </Pressable>
      <Text style={styles.meta}>
        {props.subListCards.length > 0
          ? `${props.subListCards.length} sub-list${props.subListCards.length === 1 ? '' : 's'} · `
          : ''}
        {props.totals.count} item{props.totals.count === 1 ? '' : 's'}
        {props.totals.totalCost > 0 ? ` · ${formatMoney(props.totals.totalCost, props.currency)}` : ''}
        {props.hasSale ? ' · Items on sale' : ''}
      </Text>
      <PrimaryActions
        addLabel={props.addItemLabel}
        onAdd={props.onAddProduct}
        extraLabel={props.onAddSublist ? 'Add sublist' : undefined}
        onExtra={props.onAddSublist}
        disabled={!props.online || props.checkingPrices}
      />
      <View style={styles.detailActions}>
        {props.canCheckPrices ? (
          <Pill
            label={props.checkingPrices ? props.priceCheckProgress ?? 'Checking…' : 'Check prices'}
            onPress={props.checkingPrices ? undefined : props.onCheckPrices}
          />
        ) : null}
        {props.onShareList ? (
          <Pill label={props.shareBusy ? 'Sharing…' : 'Share list'} onPress={props.shareBusy ? undefined : props.onShareList} />
        ) : null}
        {props.onRenameList ? (
          <Pill label="Settings" onPress={() => props.onRenameList?.(props.selectedListId!)} />
        ) : null}
      </View>
      {props.shareStatus ? (
        <View style={styles.shareBanner}>
          <Text style={styles.shareBannerText}>{props.shareStatus}</Text>
          {props.onDismissShareStatus ? (
            <Pressable onPress={props.onDismissShareStatus}>
              <Text style={styles.priceBannerDismiss}>Dismiss</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <PriceCheckBanner
        checking={props.checkingPrices}
        progress={props.priceCheckProgress}
        summary={props.priceCheckSummary}
        alerts={props.priceCheckAlerts}
        onDismiss={props.onDismissPriceCheck}
      />
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search items" />

      {props.subListCards.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sub-lists</Text>
          <View style={styles.listGrid}>
            {props.subListCards.map((list) => (
              <WishlistListCard
                key={list.id}
                list={list}
                currency={props.currency}
                wide
                onPress={() => props.onOpenList(list.id)}
                onSettings={props.onRenameList ? () => props.onRenameList?.(list.id) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        {props.subListCards.length > 0 ? <Text style={styles.sectionTitle}>Items in this list</Text> : null}
        {props.products.length === 0 ? (
          <EmptyState title="Nothing here yet" body={props.emptyItems} />
        ) : (
          <View style={styles.productGrid}>
            {props.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={props.currency}
                wide
                onPress={() => props.onOpenProduct(product)}
              />
            ))}
          </View>
        )}
      </View>
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  priceBanner: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  priceBannerAlert: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  priceBannerBody: { flex: 1, gap: 6, minWidth: 0 },
  priceBannerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  priceBannerTitleAlert: { color: colors.warning },
  priceBannerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  priceBannerAlertLine: { color: colors.text, fontSize: 13, lineHeight: 18 },
  priceBannerDismiss: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  shareBanner: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  shareBannerText: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});
