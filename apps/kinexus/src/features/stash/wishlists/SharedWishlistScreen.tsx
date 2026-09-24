import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { formatMoney } from '@kinexus/domain';

import { StashPhoto } from '@/src/features/stash/StashShared';
import { fetchSharedWishlist, type SharedWishlistResponse } from '@/src/features/stash/stash-api';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export function SharedWishlistScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [data, setData] = useState<SharedWishlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token.trim()) {
        setError('Missing share link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await fetchSharedWishlist(token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <LoadingState label="Loading shared list" />;
  if (error || !data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.brand}>Kinexus</Text>
          <ErrorBanner message={error ?? 'List not found'} />
          <EmptyState title="List not found" body="This share link is invalid or the list is no longer shared." />
        </View>
      </View>
    );
  }

  const total = data.products.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Kinexus</Text>
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.products.length} item{data.products.length === 1 ? '' : 's'}
        {total > 0 ? ` · ${formatMoney(total, data.currency)} total` : ''}
      </Text>

      {data.products.length === 0 ? (
        <EmptyState title="This list is empty" body="Nothing has been added yet." />
      ) : (
        <View style={styles.stack}>
          {data.products.map((product) => (
            <View key={product.id} style={styles.card}>
              <StashPhoto uri={product.imageUrl} fallback="🛍️" size={88} />
              <View style={styles.cardBody}>
                {product.storeName ? (
                  <Text style={styles.store} numberOfLines={1}>
                    {product.storeName}
                  </Text>
                ) : null}
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, product.isOnSale && styles.priceSale]}>
                    {formatMoney(product.currentPrice, data.currency)}
                  </Text>
                  {product.isOnSale && product.originalPrice != null ? (
                    <Text style={styles.priceWas}>{formatMoney(product.originalPrice, data.currency)}</Text>
                  ) : null}
                </View>
                {product.sourceUrl ? (
                  <Pressable
                    onPress={() => void Linking.openURL(product.sourceUrl)}
                    style={styles.buyBtn}
                    accessibilityRole="link">
                    <Text style={styles.buyLabel}>View product</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 15 },
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: 14,
  },
  cardBody: { flex: 1, gap: 4, minWidth: 0 },
  store: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  productTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', marginTop: 2 },
  price: { color: colors.text, fontSize: 16, fontWeight: '800' },
  priceSale: { color: colors.accent },
  priceWas: { color: colors.textDim, fontSize: 13, textDecorationLine: 'line-through' },
  buyBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buyLabel: { color: colors.bg, fontSize: 13, fontWeight: '800' },
});
