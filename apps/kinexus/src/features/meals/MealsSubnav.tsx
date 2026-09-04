import { Link, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

const TABS: { href: Href; label: string; match: (path: string) => boolean }[] = [
  { href: '/meals' as Href, label: 'Plan', match: (p) => p === '/meals' },
  { href: '/meals/generate' as Href, label: 'Generate', match: (p) => p.startsWith('/meals/generate') },
  { href: '/meals/shopping' as Href, label: 'Shopping', match: (p) => p.startsWith('/meals/shopping') },
  { href: '/meals/recipes' as Href, label: 'Recipes', match: (p) => p.startsWith('/meals/recipes') },
];

export function MealsSubnav() {
  const pathname = usePathname();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  const tabs = TABS.map((tab) => {
    const active = tab.match(pathname);
    return (
      <Link
        key={tab.label}
        href={tab.href}
        style={StyleSheet.flatten([styles.tab, desktop && styles.tabDesktop, active && styles.tabActive])}>
        <Text style={StyleSheet.flatten([styles.label, active && styles.labelActive])}>{tab.label}</Text>
      </Link>
    );
  });

  if (desktop) {
    return <View style={styles.desktopRow}>{tabs}</View>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileRow}>
      {tabs}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  desktopRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 4,
  },
  mobileRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  tabDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.accent,
  },
});
