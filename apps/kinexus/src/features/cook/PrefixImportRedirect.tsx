import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { recipeUrlFromHttpsSlug, recipeUrlFromPathname } from '@/src/features/cook/prefix-url';
import { LoadingState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';

export function PrefixImportRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const fromWindow =
      typeof window !== 'undefined' ? recipeUrlFromPathname(window.location.pathname, search) : null;
    const fromSlug = recipeUrlFromHttpsSlug(params.slug, search);
    const url = fromWindow ?? fromSlug;
    if (url) {
      router.replace({ pathname: '/import', params: { url } } as Href);
      return;
    }
    router.replace('/import' as Href);
  }, [params.slug, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LoadingState label="Opening that recipe link…" />
    </View>
  );
}
