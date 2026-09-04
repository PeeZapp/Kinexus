import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';
import { parseInviteToken } from '@/src/lib/invite';
import { savePendingInvite } from '@/src/lib/storage';

export function InviteAcceptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { user, isReady: authReady } = useAuth();
  const { peekInvite, acceptInvite, isReady: householdReady } = useHousehold();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = raw ? parseInviteToken(raw) : '';

  const [peek, setPeek] = useState<{ householdName: string; role: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPeek, setLoadingPeek] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user && token) {
      void savePendingInvite(token).then(() => router.replace('/sign-in'));
    }
  }, [authReady, router, token, user]);

  useEffect(() => {
    if (!user || !householdReady || !token) return;
    let cancelled = false;
    setLoadingPeek(true);
    peekInvite(token)
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
  }, [householdReady, peekInvite, token, user]);

  async function onAccept() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await acceptInvite(token);
      router.replace('/meals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite');
    } finally {
      setBusy(false);
    }
  }

  const desktop = mode === 'desktop';

  if (!authReady || (user && !householdReady)) {
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
      <Text style={styles.kicker}>Household invite</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Join a household</Text>
      <Card>
        {!token ? (
          <Text style={styles.body}>This invite link is missing a token.</Text>
        ) : loadingPeek ? (
          <ActivityIndicator color={colors.accent} />
        ) : peek ? (
          <>
            <Text style={styles.body}>
              Join <Text style={styles.strong}>{peek.householdName}</Text> as {peek.role}.
            </Text>
            <Text style={styles.meta}>Expires {new Date(peek.expiresAt).toLocaleString()}</Text>
            <Btn label="Accept invite" onPress={() => void onAccept()} busy={busy} />
          </>
        ) : (
          <Text style={styles.body}>This invite is invalid, expired, or already used.</Text>
        )}
        <ErrorText message={error} />
        <Btn
          label="Back"
          variant="ghost"
          onPress={() => router.replace((user ? '/settings' : '/sign-in') as Href)}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
  },
  rootDesktop: {
    paddingHorizontal: 48,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: space.md,
  },
  titleDesktop: {
    fontSize: 40,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  strong: {
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    color: colors.textDim,
    fontSize: 12,
  },
});
