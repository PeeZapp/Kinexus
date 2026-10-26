import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shopCartUrl } from '@kinexus/domain';

import { ShopBrowser, type ShopBrowserHandle } from '@/src/features/meals/shopping/ShopBrowser';
import { readShopFill, type ShopFillResult } from '@/src/features/meals/shopping/shop-fill';
import { colors } from '@/src/features/shell/theme';

export function ShopFillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const browser = useRef<ShopBrowserHandle>(null);
  const [fill] = useState(() => readShopFill());
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!fill) return <Redirect href={'/meals/shopping' as Href} />;

  const status =
    error ??
    (added != null
      ? fill.skipped.length
        ? `Added ${added} · ${fill.skipped.length} still to match`
        : `Added ${added}`
      : fill.skipped.length
        ? `${fill.skipped.length} still to match`
        : null);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/meals/shopping' as Href);
  }

  function onResult(result: ShopFillResult) {
    setBusy(false);
    if (result.ok) {
      setAdded(result.added);
      setError(null);
      return;
    }
    setError(result.error);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <Pressable onPress={close} hitSlop={8}>
          <Text style={styles.action}>Close</Text>
        </Pressable>
        <View style={styles.mid}>
          <Text style={styles.title} numberOfLines={1}>
            {fill.chainName}
          </Text>
          {status ? (
            <Text style={[styles.status, error ? styles.error : null]} numberOfLines={2}>
              {status}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            if (added != null) return;
            if (Platform.OS !== 'web') setBusy(true);
            browser.current?.add();
          }}
          disabled={busy || added != null}
          hitSlop={8}>
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.action}>{Platform.OS === 'web' ? 'Open' : added != null ? 'Added' : 'Add'}</Text>
          )}
        </Pressable>
      </View>
      <ShopBrowser
        ref={browser}
        cartUrl={shopCartUrl(fill.chainId)}
        shopUrl={fill.shopUrl}
        lines={fill.lines}
        onStart={() => setBusy(true)}
        onResult={onResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSidebar,
  },
  mid: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  status: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger },
  action: { color: colors.accent, fontSize: 15, fontWeight: '800' },
});
