import { Link, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
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
            href={mod.href as Href}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={mod.label}
            accessibilityState={{ selected: active }}>
            <ModuleGlyph name={mod.key} active={active} size={30} />
          </Link>
        );
      })}
      <Link
        href={SETTINGS_HREF}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityLabel="More"
        accessibilityState={{ selected: moreActive }}>
        <ModuleGlyph name="settings" active={moreActive} size={30} />
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
    justifyContent: 'center',
    minHeight: 48,
  },
});
