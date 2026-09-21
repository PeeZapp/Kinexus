import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as Linking from 'expo-linking';

import { isSafeCookReturnPath, readCookReturnTo, clearCookReturnTo } from '@/src/features/cook/cook-storage';
import { colors } from '@/src/features/shell/theme';
import { createSessionFromUrl } from '@/src/lib/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const href =
          typeof window !== 'undefined' ? window.location.href : ((await Linking.getInitialURL()) ?? '');
        if (href) {
          await createSessionFromUrl(href);
        }
        const returnTo = await readCookReturnTo();
        await clearCookReturnTo();
        if (!cancelled) router.replace((isSafeCookReturnPath(returnTo) ? returnTo : '/') as Href);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.label}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});
