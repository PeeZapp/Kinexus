import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';

export function FinancesChrome({
  desktop,
  kicker,
  title,
  subtitle,
  children,
}: {
  desktop: boolean;
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function MoneyBar({ progress, over }: { progress: number; over?: boolean }) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, over && styles.barOver, { width: `${pct}%` }]} />
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  wide,
}: {
  label: string;
  value: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 16, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, paddingTop: 8, maxWidth: 1100 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  titleDesktop: { fontSize: 36 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgHover,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  barOver: {
    backgroundColor: colors.danger,
  },
  stat: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 6,
  },
  statWide: {
    minWidth: 220,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statHint: {
    color: colors.textDim,
    fontSize: 13,
  },
});
