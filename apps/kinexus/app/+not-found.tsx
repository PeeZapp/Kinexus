import type { Href } from 'expo-router';
import { Link, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { recipeUrlFromPathname } from '@/src/features/cook/prefix-url';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const prefixUrl =
    typeof window !== 'undefined'
      ? recipeUrlFromPathname(window.location.pathname, window.location.search)
      : recipeUrlFromPathname(pathname);

  useEffect(() => {
    if (!prefixUrl) return;
    router.replace({ pathname: '/import', params: { url: prefixUrl } } as Href);
  }, [prefixUrl, router]);

  if (prefixUrl) {
    return (
      <View style={styles.container}>
        <LoadingState label="Opening that recipe link…" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={styles.container}>
        <EmptyState
          kicker="404"
          title="This screen does not exist"
          body="The link may be old, or the page moved. Meals, Settings, and sign-in are still in the sidebar / tabs.">
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Back to Kinexus</Text>
          </Link>
        </EmptyState>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: colors.bg,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  link: {
    marginTop: 4,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '700',
  },
});
