import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '@/src/features/household/ui';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function SettingsPage({
  error,
  children = null,
  loading,
  wide,
}: {
  error?: string | null;
  children?: ReactNode;
  loading?: boolean;
  /** Wider content column for split layouts (e.g. profile + units). */
  wide?: boolean;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const insets = useSafeAreaInsets();
  const desktopWide = desktop && wide;

  if (loading) {
    return (
      <View style={[styles.root, desktop && styles.rootDesktop]}>
        <Text style={styles.body}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, desktop && styles.rootDesktop]}
      contentContainerStyle={[
        styles.content,
        desktop && styles.contentDesktop,
        desktopWide && styles.contentDesktopWide,
        { paddingBottom: desktop ? 64 : insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <ErrorText message={error ?? null} />
      <View
        style={[
          styles.stack,
          desktop && styles.stackDesktop,
          desktopWide && styles.stackDesktopWide,
        ]}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  rootDesktop: {
    paddingHorizontal: 48,
    paddingTop: 24,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: 8,
  },
  contentDesktop: {
    paddingHorizontal: 0,
    paddingTop: 0,
    maxWidth: 720,
    gap: 8,
    width: '100%',
    alignSelf: 'center',
  },
  contentDesktopWide: {
    maxWidth: 1080,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    padding: space.md,
  },
  stack: {
    gap: 16,
  },
  stackDesktop: {
    maxWidth: 720,
    width: '100%',
  },
  stackDesktopWide: {
    maxWidth: 1080,
  },
});
