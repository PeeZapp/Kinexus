import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { groceryChainById, trolleyShopUrl } from '@kinexus/domain';

import { colors, radius, space } from '@/src/features/shell/theme';

type Handoff = {
  chainId: string;
  lines: { itemId: string; name: string; productName: string; packs: number }[];
  skipped: { itemId: string; name: string }[];
};

function shoppingApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return '';
}

export default function TrolleyHandoffScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = shoppingApiBase();
    if (!token || !api) {
      setError(token ? 'The shopping API is not configured.' : 'This trolley link is missing.');
      return;
    }
    let cancel = false;
    void fetch(`${api}/grocery/handoff?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Handoff & { error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Could not open that trolley link.');
        if (!cancel) setHandoff(body);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Could not open that trolley link.');
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  const shop = handoff ? groceryChainById(handoff.chainId)?.name ?? 'Shop' : 'Trolley';
  const api = shoppingApiBase();

  function openShop() {
    if (!handoff || !token || !api) return;
    const url = trolleyShopUrl(handoff.chainId, token, api);
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
    else void Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{shop}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {handoff ? (
        <>
          <Pressable onPress={openShop} style={styles.button}>
            <Text style={styles.buttonText}>Add to trolley</Text>
          </Pressable>
          {handoff.lines.map((line) => (
            <View key={line.itemId} style={styles.row}>
              <Text style={styles.name}>{line.productName}</Text>
              <Text style={styles.meta}>
                {line.packs > 1 ? `${line.packs} × ` : ''}
                {line.name}
              </Text>
            </View>
          ))}
          {handoff.skipped.map((line) => (
            <Text key={line.itemId} style={styles.meta}>
              {line.name} needs a product
            </Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 12, maxWidth: 640 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: { color: colors.bg, fontWeight: '800' },
  row: { gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
});
