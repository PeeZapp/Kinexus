import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { AppMark } from '@/src/features/shell/AppMark';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { rememberAuthReturn } from '@/src/lib/auth-return';
import { useHousehold } from '@/src/lib/household';
import { supabase } from '@/src/lib/supabase';

function apiBase(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

type AuthDetails = {
  authorization_id?: string;
  redirect_url?: string;
  client?: { id?: string; name?: string };
  name?: string;
};

export default function OAuthConsentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorization_id?: string }>();
  const authorizationId = typeof params.authorization_id === 'string' ? params.authorization_id : '';
  const { user, isReady } = useAuth();
  const { activeHousehold } = useHousehold();
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!authorizationId) {
      setError('Missing authorization request.');
      return;
    }
    if (!user) {
      rememberAuthReturn(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
      router.replace('/sign-in' as Href);
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (detailsError || !data) {
        setError(detailsError?.message ?? 'Invalid authorization request');
        return;
      }
      if (!('authorization_id' in data) && typeof (data as AuthDetails).redirect_url === 'string') {
        if (typeof window !== 'undefined') window.location.href = (data as AuthDetails).redirect_url!;
        return;
      }
      setDetails(data as AuthDetails);
    })();

    return () => {
      cancelled = true;
    };
  }, [authorizationId, isReady, router, user]);

  const decide = useCallback(
    async (decision: 'approve' | 'deny') => {
      if (!supabase || !authorizationId) return;
      setBusy(true);
      setError(null);
      try {
        const result =
          decision === 'approve'
            ? await supabase.auth.oauth.approveAuthorization(authorizationId)
            : await supabase.auth.oauth.denyAuthorization(authorizationId);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        const redirectUrl = result.data?.redirect_url;
        if (decision === 'approve' && details?.client?.id) {
          try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (token) {
              await fetch(`${apiBase()}/mcp/connections`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  clientId: details.client.id,
                  clientName: details.client.name ?? details.name ?? null,
                }),
              });
            }
          } catch {
            // Connection row is also upserted on first MCP call.
          }
        }
        if (redirectUrl && typeof window !== 'undefined') {
          window.location.href = redirectUrl;
          return;
        }
        setError('No redirect URL returned.');
      } finally {
        setBusy(false);
      }
    },
    [authorizationId, details],
  );

  const clientLabel = details?.client?.name?.trim() || details?.name?.trim() || 'An AI app';
  const householdName = activeHousehold?.name?.trim() || null;

  return (
    <View style={styles.root}>
      <AppMark />
      {!isReady || (user && !details && !error) ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <Text style={styles.line}>{clientLabel} wants to use your Kinexus account</Text>
          {householdName ? <Text style={styles.household}>{householdName}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void decide('approve')}
              style={[styles.btn, styles.allow]}
            >
              <Text style={styles.allowLabel}>{busy ? '…' : 'Allow'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void decide('deny')}
              style={[styles.btn, styles.cancel]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
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
    padding: space.lg,
    gap: space.md,
  },
  line: {
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: space.md,
  },
  household: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  btn: {
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  allow: {
    backgroundColor: colors.accent,
  },
  allowLabel: {
    color: colors.frameBezel,
    fontWeight: '700',
  },
  cancel: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: space.md,
  },
});
