import { forwardRef, useImperativeHandle } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { ShopFillLine, ShopFillResult } from '@/src/features/meals/shopping/shop-fill';
import { colors } from '@/src/features/shell/theme';

export type ShopBrowserHandle = { add: () => void };

export const ShopBrowser = forwardRef<
  ShopBrowserHandle,
  {
    cartUrl: string;
    shopUrl: string;
    lines: ShopFillLine[];
    onResult: (result: ShopFillResult) => void;
    onStart?: () => void;
  }
>(function ShopBrowser({ shopUrl, lines }, ref) {
  useImperativeHandle(ref, () => ({
    add: () => {
      window.open(shopUrl, 'kinexus-shop');
    },
  }));

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      {lines.map((line, index) => (
        <Text key={`${line.productId}-${index}`} style={styles.name}>
          {line.packs > 1 ? `${line.packs} × ` : ''}
          {line.productName}
        </Text>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 16, gap: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
