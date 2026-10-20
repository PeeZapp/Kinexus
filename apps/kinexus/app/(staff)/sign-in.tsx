import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { useStaffAccess } from '@/src/features/staff/use-staff';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { rememberAuthReturn } from '@/src/lib/auth-return';

export default function StaffSignInScreen() {
  const { user, signInWithGoogle, signOut, isSupabaseConfigured, isReady } = useAuth();
  const access = useStaffAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReady) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (user && access.ready && access.isStaff) {
    return <Redirect href={'/staff' as Href} />;
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      rememberAuthReturn('/staff');
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>Developer team</Text>
        <Text style={styles.title}>Staff sign-in</Text>
        <Text style={styles.lede}>
          Separate from the household app. Only platform staff can open the creator dashboard.
        </Text>

        {user && access.ready && !access.isStaff ? (
          <View style={styles.warn}>
            <Text style={styles.warnTitle}>No staff access</Text>
            <Text style={styles.warnBody}>
              Signed in as {user.email ?? user.displayName}, but this account is not on the staff list.
              Sign out and use an invited email, or ask an existing staff member to invite you.
            </Text>
            <Pressable
              onPress={() => void signOut()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => void onGoogle()}
            disabled={busy || !isSupabaseConfigured}
            style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}>
            <Text style={styles.googleLabel}>
              {isSupabaseConfigured ? 'Continue with Google' : 'Configure Supabase to sign in'}
            </Text>
            {busy ? <ActivityIndicator color={colors.googleText} /> : null}
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {access.error ? <Text style={styles.error}>{access.error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050A10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#101820',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 32,
    gap: 14,
  },
  kicker: {
    color: '#7DD3C7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7FA',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lede: {
    color: '#8D9AAB',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  googleBtn: {
    marginTop: 8,
    backgroundColor: colors.googleBtn,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleLabel: {
    color: colors.googleText,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  warn: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
  },
  warnTitle: {
    color: colors.warning,
    fontWeight: '700',
    fontSize: 14,
  },
  warnBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.9,
  },
});
