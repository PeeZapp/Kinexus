import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModuleGlyph } from '@/src/features/shell/ModuleGlyph';
import { MODULES, SETTINGS_HREF, SETTINGS_PATH } from '@/src/features/shell/modules';
import { colors } from '@/src/features/shell/theme';

export function MobileTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const moreActive = pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);

  return (
    <View style={StyleSheet.flatten([styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }])}>
      {MODULES.map((mod) => {
        const active = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
        return (
          <Link
            key={mod.key}
            href={mod.href}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <ModuleGlyph short={mod.short} active={active} size={30} />
            <Text style={StyleSheet.flatten([styles.label, active && styles.labelActive])}>{mod.label}</Text>
          </Link>
        );
      })}
      <Link
        href={SETTINGS_HREF}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityState={{ selected: moreActive }}>
        <ModuleGlyph short="MO" active={moreActive} size={30} />
        <Text style={StyleSheet.flatten([styles.label, moreActive && styles.labelActive])}>More</Text>
      </Link>
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
