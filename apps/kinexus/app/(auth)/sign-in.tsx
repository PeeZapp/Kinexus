import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMark } from '@/src/features/shell/AppMark';
import { colors, radius, space } from '@/src/features/shell/theme';
import { PwaInstallHint } from '@/src/features/shell/PwaInstallHint';
import { useAuth } from '@/src/lib/auth';
import { getAuthRedirectUrl } from '@/src/lib/oauth';

type AuthMode = 'sign-in' | 'create';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInDevBypass, isSupabaseConfigured } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const creating = mode === 'create';

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onEmail() {
    setError(null);
    setNotice(null);
    const trimmed = email.trim();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    if (creating && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (creating) {
        const result = await signUpWithEmail(trimmed, password);
        if (result.needsEmailConfirmation) {
          setNotice(`Check ${trimmed} for a confirmation link, then sign in.`);
          setMode('sign-in');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        await signInWithEmail(trimmed, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : creating ? 'Could not create the account' : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setConfirmPassword('');
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <AppMark size={72} />
        <Text style={styles.wordmark}>Kinexus</Text>
        <Text style={styles.lede}>One suite for meals, lists, nutrition, and training.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{creating ? 'Create account' : 'Sign in'}</Text>
        <Text style={styles.cardBody}>
          {creating
            ? 'Create an account with email and password, or continue with Google. After that you will create a household or accept an invite.'
            : 'Sign in with email and password, or continue with Google. Household access uses hashed, expiring invite links — not guessable family codes.'}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={creating ? 'new-password' : 'password'}
          secureTextEntry
          textContentType={creating ? 'newPassword' : 'password'}
          editable={!busy}
          style={styles.input}
        />
        {creating ? (
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            textContentType="newPassword"
            editable={!busy}
            style={styles.input}
          />
        ) : null}

        <Pressable
          onPress={() => void onEmail()}
          disabled={busy || !isSupabaseConfigured}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, !isSupabaseConfigured && styles.disabled]}>
          <Text style={styles.primaryLabel}>
            {isSupabaseConfigured ? (creating ? 'Create account' : 'Sign in') : 'Configure Supabase to use email'}
          </Text>
          {busy ? <ActivityIndicator color={colors.bg} /> : null}
        </Pressable>

        <Pressable
          onPress={() => switchMode(creating ? 'sign-in' : 'create')}
          disabled={busy}
          style={styles.switchBtn}>
          <Text style={styles.switchLabel}>
            {creating ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

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

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isSupabaseConfigured && Platform.OS !== 'web' ? (
          <Text style={styles.todo}>
            Native Google uses the system browser (not the native Google SDK). Add this redirect URL in
            Supabase Auth → URL configuration: {getAuthRedirectUrl()}
          </Text>
        ) : isSupabaseConfigured ? (
          <Text style={styles.todo}>
            After Google, or after you open an email confirmation link, you return to{' '}
            {typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback'}.
          </Text>
        ) : (
          <Text style={styles.todo}>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/kinexus/.env to enable
            live Google sign-in.
          </Text>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <View style={styles.install}>
          <PwaInstallHint />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 440,
  },
  wordmark: {
    marginTop: 16,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  primaryLabel: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  switchLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  notice: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 19,
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
  install: {
    width: '100%',
    maxWidth: 440,
    marginTop: space.md,
  },
});
