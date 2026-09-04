import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleGlyph } from '@/src/features/shell/ModuleGlyph';
import { MODULES } from '@/src/features/shell/modules';
import { colors } from '@/src/features/shell/theme';

export function MobileTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {MODULES.map((mod) => {
        const active = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
        return (
          <Link key={mod.key} href={mod.href} asChild>
            <Pressable style={styles.tab} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <ModuleGlyph short={mod.short} active={active} size={30} />
              <Text style={[styles.label, active && styles.labelActive]}>{mod.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgSidebar,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
  label: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.accent,
  },
});
