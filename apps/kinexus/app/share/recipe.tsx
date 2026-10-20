import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { extractRecipeUrlFromShare } from '@kinexus/domain';

import { recipeParam } from '@/src/features/meals/recipe-href';
import { colors, space } from '@/src/features/shell/theme';

/**
 * PWA Web Share Target landing (and any deep link with shared fields).
 * Android Chromium installed PWAs POST here via the service worker, which
 * 303-redirects to this route with query params.
 */
export default function ShareRecipeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string | string[]; text?: string | string[]; title?: string | string[] }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const extracted = extractRecipeUrlFromShare({
      url: recipeParam(params.url),
      text: recipeParam(params.text),
      title: recipeParam(params.title),
    });

    if (extracted) {
      router.replace({ pathname: '/import', params: { url: extracted } } as Href);
      return;
    }

    router.replace('/import' as Href);
  }, [params.text, params.title, params.url, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.label}>Opening recipe import…</Text>
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
