import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';

import { extractRecipeUrlFromShare } from '@kinexus/domain';

import { colors, space } from '@/src/features/shell/theme';

/**
 * Native iOS Share Extension / Android ACTION_SEND entry.
 * expo-share-intent deep-links here; we pull the URL and hand off to /import.
 */
export default function ShareIntentRoute() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace('/import' as Href);
      return;
    }
    if (!isReady || handled.current) return;
    if (!hasShareIntent) {
      handled.current = true;
      router.replace('/import' as Href);
      return;
    }

    handled.current = true;
    const extracted = extractRecipeUrlFromShare({
      webUrl: shareIntent.webUrl,
      text: shareIntent.text,
      title: shareIntent.meta?.title,
      url: shareIntent.webUrl,
    });
    resetShareIntent(true);

    if (extracted) {
      router.replace({ pathname: '/import', params: { url: extracted } } as Href);
      return;
    }

    router.replace('/import' as Href);
  }, [hasShareIntent, isReady, resetShareIntent, router, shareIntent.meta?.title, shareIntent.text, shareIntent.webUrl]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.label}>Opening shared recipe…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
