import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInDevBypass, isSupabaseConfigured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <View style={styles.markDot} />
          <View style={styles.markRing} />
        </View>
        <Text style={styles.wordmark}>Kinexus</Text>
        <Text style={styles.lede}>One suite for meals, stash, nutrition, and training.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign in</Text>
        <Text style={styles.cardBody}>
          Google auth is wired for Supabase. Until project keys are set, continue locally to explore the
          shell.
        </Text>

        <Pressable
          onPress={() => void onGoogle()}
          disabled={busy}
          style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}>
          <View style={styles.googleG}>
            <Text style={styles.googleGText}>G</Text>
          </View>
          <Text style={styles.googleLabel}>
            {isSupabaseConfigured ? 'Continue with Google' : 'Continue with Google (stub)'}
          </Text>
          {busy ? <ActivityIndicator color={colors.googleText} /> : null}
        </Pressable>

        {!isSupabaseConfigured ? (
          <Pressable onPress={signInDevBypass} style={styles.devBtn}>
            <Text style={styles.devLabel}>Continue in dev mode</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.todo}>
          TODO(Phase 1): connect a live Supabase project and enable the Google provider. Do not add the
          service-role key to this app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 440,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  markRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accentMuted,
  },
  wordmark: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.googleBtn,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.86,
  },
  googleG: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: {
    color: '#4285F4',
    fontWeight: '800',
    fontSize: 13,
  },
  googleLabel: {
    flex: 1,
    color: colors.googleText,
    fontSize: 15,
    fontWeight: '600',
  },
  devBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  devLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#F07178',
    fontSize: 13,
  },
  todo: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
  },
});
