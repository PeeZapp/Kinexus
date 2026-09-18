import { type ReactNode, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';

import { formatMoney, type SavedLink, type StashListNode, type StashProduct } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

export function StashPhoto({
  uri,
  fallback = '📦',
  size = 72,
}: {
  uri?: string | null;
  fallback?: string;
  size?: number | 'fill';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  const box: ViewStyle = size === 'fill' ? { width: '100%', height: '100%' } : { width: size, height: size };
  const img: ImageStyle = { width: '100%', height: '100%' };
  return (
    <View style={[styles.photo, box]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={img} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.photoFallback, size === 'fill' && styles.photoFallbackLarge]}>{fallback}</Text>
      )}
    </View>
  );
}

export function StashChrome({
  desktop,
  kicker,
  title,
  subtitle,
  children,
}: {
  desktop: boolean;
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function ProductCard({
  product,
  currency,
  wide,
  onPress,
}: {
  product: StashProduct;
  currency: string;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.productCard, wide && styles.productCardWide]}>
      <StashPhoto uri={product.imageUrl} size={wide ? 140 : 72} />
      <View style={styles.productBody}>
        <Text style={styles.productTitle} numberOfLines={2}>
          {product.title}
        </Text>
        <Text style={styles.productMeta} numberOfLines={1}>
          {product.storeName || 'Saved item'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, product.isOnSale && styles.priceSale]}>{formatMoney(product.currentPrice, currency)}</Text>
          {product.isOnSale && product.originalPrice != null ? (
            <Text style={styles.priceWas}>{formatMoney(product.originalPrice, currency)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function LinkCard({
  link,
  wide,
  onPress,
}: {
  link: SavedLink;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.productCard, wide && styles.productCardWide]}>
      <StashPhoto uri={link.imageUrl || link.faviconUrl} fallback="🔗" size={wide ? 140 : 72} />
      <View style={styles.productBody}>
        <Text style={styles.productTitle} numberOfLines={2}>
          {link.title}
        </Text>
        <Text style={styles.productMeta} numberOfLines={1}>
          {link.siteName || link.linkType} · {link.status.replace('_', ' ')}
        </Text>
      </View>
    </Pressable>
  );
}

export function ListTree({
  nodes,
  selectedId,
  depth = 0,
  counts,
  shareLabels,
  onSelect,
}: {
  nodes: StashListNode[];
  selectedId: string | null;
  depth?: number;
  counts: Map<string, number>;
  shareLabels?: Map<string, string>;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      {nodes.map((node) => (
        <View key={node.id} style={{ gap: 4 }}>
          <Pressable
            onPress={() => onSelect(node.id)}
            style={[styles.listRow, selectedId === node.id && styles.listRowActive, { marginLeft: depth * 14 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.listName, selectedId === node.id && styles.listNameActive]} numberOfLines={1}>
                {node.name}
              </Text>
              {shareLabels?.get(node.id) ? (
                <Text style={styles.listShare} numberOfLines={1}>
                  {shareLabels.get(node.id)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.listCount}>{counts.get(node.id) ?? 0}</Text>
          </Pressable>
          {node.children.length > 0 ? (
            <ListTree
              nodes={node.children}
              selectedId={selectedId}
              depth={depth + 1}
              counts={counts}
              shareLabels={shareLabels}
              onSelect={onSelect}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Field label="Search" value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="none" />;
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function PrimaryActions(props: {
  addLabel: string;
  onAdd: () => void;
  extraLabel?: string;
  onExtra?: () => void;
  disabled?: boolean;
}) {
  return (
    <ActionRow>
      <Btn label={props.addLabel} onPress={props.onAdd} disabled={props.disabled} />
      {props.extraLabel && props.onExtra ? (
        <Btn label={props.extraLabel} variant="secondary" onPress={props.onExtra} disabled={props.disabled} />
      ) : null}
    </ActionRow>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 16, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, paddingTop: 8, maxWidth: 1200 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  titleDesktop: { fontSize: 36 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  photo: {
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  photoFallback: { fontSize: 22 },
  photoFallbackLarge: { fontSize: 40 },
  productCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.sm,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  productCardWide: {
    width: 280,
    flexDirection: 'column',
  },
  productBody: { flex: 1, gap: 4, minWidth: 0 },
  productTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  productMeta: { color: colors.textMuted, fontSize: 13 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  price: { color: colors.text, fontSize: 15, fontWeight: '800' },
  priceSale: { color: colors.accent },
  priceWas: { color: colors.textDim, fontSize: 13, textDecorationLine: 'line-through' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    gap: 8,
  },
  listRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  listName: { color: colors.textMuted, fontSize: 14, fontWeight: '700', flex: 1 },
  listNameActive: { color: colors.accent },
  listShare: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  listCount: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
