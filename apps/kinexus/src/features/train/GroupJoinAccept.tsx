import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/src/features/shell/theme';
import { Card, TrainButton } from '@/src/features/train/ui';
import { joinByCode, normalizeJoinCode } from '@/src/features/train/group-workouts-api';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function GroupJoinAcceptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { user, isReady: authReady } = useAuth();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = raw ? normalizeJoinCode(raw) : '';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!authReady) return;
    if (!user && code) {
      router.replace('/sign-in' as Href);
    }
  }, [authReady, code, router, user]);

  useEffect(() => {
    if (!user || !code || code.length !== 6) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    joinByCode(code)
      .then((id) => {
        if (cancelled) return;
        router.replace(`/train/group/${id}` as Href);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, code, router, user]);

  const desktop = mode === 'desktop';

  if (!authReady) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        desktop && styles.rootDesktop,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.kicker}>Group workout</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Join with code</Text>
      <Card>
        {!code || code.length !== 6 ? (
          <Text style={styles.body}>This join link is missing a valid code.</Text>
        ) : busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : error ? (
          <>
            <Text style={styles.body}>{error}</Text>
            <TrainButton label="Try again" onPress={() => setAttempt((n) => n + 1)} />
          </>
        ) : (
          <Text style={styles.body}>Opening group…</Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg, gap: space.md },
  rootDesktop: { maxWidth: 480, width: '100%', alignSelf: 'center' },
  kicker: { color: colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  titleDesktop: { fontSize: 34 },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
});
