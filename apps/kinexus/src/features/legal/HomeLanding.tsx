import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalLinks } from '@/src/features/legal/LegalLinks';
import { AppMark } from '@/src/features/shell/AppMark';
import { colors, radius, space } from '@/src/features/shell/theme';

const MODULES = [
  { name: 'Today', detail: 'Day overview, tasks, and household rhythm' },
  { name: 'Meals', detail: 'Plans, recipes, shopping, and pantry' },
  { name: 'Calendar', detail: 'Family events with optional Google Calendar sync' },
  { name: 'Lists', detail: 'Wishlists, watchlists, reading, and saves' },
  { name: 'Money', detail: 'Budget and household finances' },
  { name: 'Train', detail: 'Workouts, plans, and family sessions' },
] as const;

/** Public marketing home — no auth required (Google OAuth / crawlers). */
export function HomeLanding() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 40), paddingBottom: Math.max(insets.bottom, 48) },
      ]}>
      <View style={styles.hero}>
        <AppMark size={88} />
        <Text style={styles.wordmark}>Kinexus</Text>
        <Text style={styles.lede}>
          One household suite for meals, calendar, lists, money, nutrition, and training.
        </Text>
        <View style={styles.ctaRow}>
          <Link href="/sign-in" asChild>
            <Pressable style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}>
              <Text style={styles.ctaPrimaryLabel}>Sign in</Text>
            </Pressable>
          </Link>
          <Link href="/sign-in" asChild>
            <Pressable style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}>
              <Text style={styles.ctaSecondaryLabel}>Create account</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={styles.sectionLabel}>What you get</Text>
      <View style={styles.moduleGrid}>
        {MODULES.map((mod) => (
          <View key={mod.name} style={styles.moduleTile}>
            <Text style={styles.moduleName}>{mod.name}</Text>
            <Text style={styles.moduleDetail}>{mod.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Google access</Text>
      <Text style={styles.body}>
        Sign in with Google is optional. If you connect Google Calendar, Kinexus uses that access only to sync
        calendars you choose. You can disconnect anytime in Settings.
      </Text>

      <Text style={styles.sectionLabel}>Contact</Text>
      <Text style={styles.body}>pzappft@gmail.com</Text>

      <View style={styles.footer}>
        <LegalLinks />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: space.xl,
  },
  wordmark: {
    marginTop: space.md,
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  lede: {
    marginTop: space.sm,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 520,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: space.lg,
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaPrimaryLabel: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  ctaSecondaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: space.md,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space.md,
  },
  moduleTile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
  },
  moduleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  moduleDetail: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.sm,
    maxWidth: 640,
  },
  footer: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
