import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { mode } = useExperienceMode();
  return (
    <View style={[styles.block, mode === 'desktop' && styles.blockDesktop]}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  kicker,
  title,
  body,
  children,
}: {
  kicker?: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  return (
    <View style={[styles.card, desktop && styles.cardDesktop]}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Couldn’t do that</Text>
      <Text style={styles.errorBody}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: space.lg,
  },
  blockDesktop: {
    paddingTop: 48,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 10,
  },
  cardDesktop: {
    padding: space.lg,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  titleDesktop: {
    fontSize: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 4,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  errorBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
