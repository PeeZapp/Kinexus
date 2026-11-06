import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/src/features/shell/theme';
import { publicPrimaryName } from '@/src/features/shell/PublicName';
import { Card, TrainButton } from '@/src/features/train/ui';
import {
  acceptTrainBuddyInvite,
  parseTrainBuddyInviteToken,
  peekTrainBuddyInvite,
  type TrainBuddyInvitePeek,
} from '@/src/features/train/buddies-api';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function BuddyInviteAcceptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { user, isReady: authReady } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = raw ? parseTrainBuddyInviteToken(raw) : '';

  const [peek, setPeek] = useState<TrainBuddyInvitePeek | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPeek, setLoadingPeek] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user && token) {
      router.replace('/sign-in' as Href);
    }
  }, [authReady, router, token, user]);

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;
    setLoadingPeek(true);
    peekTrainBuddyInvite(token)
      .then((info) => {
        if (!cancelled) setPeek(info);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load invite');
      })
      .finally(() => {
        if (!cancelled) setLoadingPeek(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  async function onAccept() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await acceptTrainBuddyInvite(token);
      router.replace('/train/buddies' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite');
    } finally {
      setBusy(false);
    }
  }

  const desktop = mode === 'desktop';
  const inviterLabel = peek
    ? publicPrimaryName({
        username: peek.inviterUsername,
        globalHandle: peek.inviterGlobalHandle,
      })
    : null;

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
      <Text style={styles.kicker}>Train buddy</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Gym buddy invite</Text>
      <Card>
        {!token ? (
          <Text style={styles.body}>This invite link is missing a token.</Text>
        ) : loadingPeek ? (
          <ActivityIndicator color={colors.accent} />
        ) : peek ? (
          <>
            <Text style={styles.body}>
              Connect with <Text style={styles.strong}>{inviterLabel}</Text>.
            </Text>
            <Text style={styles.meta}>Expires {new Date(peek.expiresAt).toLocaleString()}</Text>
            <TrainButton label={busy ? 'Accepting…' : 'Accept'} onPress={() => void onAccept()} disabled={busy} />
          </>
        ) : (
          <Text style={styles.body}>This invite is invalid, expired, or already used.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  strong: { fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
