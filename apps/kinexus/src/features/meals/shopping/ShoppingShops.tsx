import { StyleSheet, Text, View } from 'react-native';

import { formatMoney, lookupChainsForCountry, type GroceryComparison } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';

export function ShoppingShops({
  country,
  online,
  comparison,
  busy,
  error,
  warning,
  onRecheck,
}: {
  country: string | null | undefined;
  online: boolean;
  comparison: GroceryComparison | null;
  busy: boolean;
  error: string | null;
  warning: string | null;
  onRecheck: () => void;
}) {
  const chains = lookupChainsForCountry(country);

  return (
    <View style={styles.wrap}>
      {chains.length === 0 ? (
        <Text style={styles.hint}>
          Live shop prices are available for Coles and Woolworths. Set the household country to Australia to compare them.
        </Text>
      ) : null}
      <ErrorText message={error} />
      {warning ? <Text style={styles.hint}>{warning}</Text> : null}
      {busy ? <Text style={styles.hint}>Checking Coles and Woolworths…</Text> : null}
      {comparison?.cheapestShop ? <ShopTotals comparison={comparison} /> : null}
      {!busy && chains.length > 0 && comparison && !comparison.cheapestShop ? (
        <Text style={styles.hint}>No confident price for these items.</Text>
      ) : null}
      {chains.length > 0 ? (
        <View style={styles.recheck}>
          <Text style={styles.hint}>
            Prices stay on this list.
          </Text>
          <Btn label="Re-check prices" variant="secondary" disabled={!online || busy} busy={busy} onPress={onRecheck} />
        </View>
      ) : null}
    </View>
  );
}

function ShopTotals({ comparison }: { comparison: GroceryComparison }) {
  const winner = comparison.cheapestShop;
  if (!winner) return null;
  return (
    <View style={styles.total}>
      <View style={styles.totalCopy}>
        <Text style={styles.totalLabel}>Cheapest shop</Text>
        <Text style={styles.totalStore}>{winner.chainName}</Text>
        <Text style={styles.hint}>
          {winner.pricedCount} of {winner.itemCount} items priced
          {comparison.shops
            .filter((shop) => shop.chainId !== winner.chainId)
            .map((shop) => ` · ${shop.chainName} ${formatMoney(shop.total, shop.currency)} (${shop.pricedCount})`)
            .join('')}
        </Text>
      </View>
      <Text style={styles.totalValue}>{formatMoney(winner.total, winner.currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  recheck: { gap: 8 },
  hint: { color: colors.textMuted, fontSize: 12 },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalCopy: { flex: 1, gap: 2, minWidth: 0 },
  totalLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  totalStore: { color: colors.text, fontSize: 16, fontWeight: '800' },
  totalValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
});
