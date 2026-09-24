import { type ReactNode, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';

import {
  formatMoney,
  listThemeSoft,
  normalizeListEmoji,
  normalizeListTheme,
  type SavedLink,
  type StashListNode,
  type StashProduct,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
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
  const box: ViewStyle =
    size === 'fill'
      ? { width: '100%', height: '100%', borderRadius: 0 }
      : { width: size, height: size };
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
  children,
}: {
  desktop: boolean;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
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

export type WishlistListCardModel = {
  id: string;
  name: string;
  emoji: string;
  theme: string;
  coverUrl: string | null;
  itemCount: number;
  totalCost: number;
  hasSale: boolean;
  subListCount: number;
  shareLabel: string;
};

export function WishlistListCard({
  list,
  currency,
  wide,
  onPress,
  onSettings,
}: {
  list: WishlistListCardModel;
  currency: string;
  wide?: boolean;
  onPress: () => void;
  onSettings?: () => void;
}) {
  const stats: string[] = [];
  if (list.subListCount > 0) {
    stats.push(`${list.subListCount} sub-list${list.subListCount === 1 ? '' : 's'}`);
  }
  stats.push(`${list.itemCount} item${list.itemCount === 1 ? '' : 's'}`);
  if (list.itemCount > 0 && list.totalCost > 0) {
    stats.push(formatMoney(list.totalCost, currency));
  }
  const theme = normalizeListTheme(list.theme);
  const emoji = normalizeListEmoji(list.emoji);

  return (
    <Pressable onPress={onPress} style={[styles.listCard, wide && styles.listCardWide, { borderColor: theme }]}>
      <View style={[styles.listCover, !list.coverUrl && { backgroundColor: listThemeSoft(theme, 0.22) }]}>
        {list.coverUrl ? (
          <StashPhoto uri={list.coverUrl} fallback={emoji} size="fill" />
        ) : (
          <View style={styles.listCoverEmojiWrap}>
            <Text style={styles.listCoverEmoji}>{emoji}</Text>
          </View>
        )}
        {list.hasSale ? (
          <View style={styles.listBadgeSale}>
            <Text style={styles.listBadgeSaleText}>Items on sale</Text>
          </View>
        ) : null}
        {list.shareLabel && list.shareLabel !== 'Family' ? (
          <View style={styles.listBadgeShare}>
            <Text style={styles.listBadgeShareText}>{list.shareLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.listCardBody}>
        <Text style={styles.listCardTitle} numberOfLines={2}>
          {list.name}
        </Text>
        <Text style={styles.listCardStats} numberOfLines={2}>
          {stats.join(' · ')}
        </Text>
        {onSettings ? (
          <View style={styles.listCardActions}>
            <Pill label="Settings" onPress={onSettings} />
          </View>
        ) : null}
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
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  listCardWide: {
    width: 300,
  },
  listCover: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgHover,
    position: 'relative',
    overflow: 'hidden',
  },
  listCoverEmojiWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCoverEmoji: {
    fontSize: 48,
  },
  listBadgeSale: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listBadgeSaleText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  listBadgeShare: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listBadgeShareText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  listCardBody: { padding: space.md, gap: 6 },
  listCardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listCardStats: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
