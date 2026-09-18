import { Link, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ModuleGlyph } from '@/src/features/shell/ModuleGlyph';
import { MODULES, SETTINGS_HREF, SETTINGS_PATH } from '@/src/features/shell/modules';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { activeHousehold } = useHousehold();
  const settingsActive = pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <View style={styles.markDot} />
          <View style={styles.markRing} />
        </View>
        <View>
          <Text style={styles.wordmark}>Kinexus</Text>
          <Text style={styles.tagline}>Meals · Lists · Money · Nutrition · Train</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {MODULES.map((mod) => {
          const active = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
          return (
            <Link
              key={mod.key}
              href={mod.href as Href}
              style={StyleSheet.flatten([styles.navItem, active && styles.navItemActive])}>
              <ModuleGlyph name={mod.key} active={active} size={22} />
              <Text style={StyleSheet.flatten([styles.navLabel, active && styles.navLabelActive])}>{mod.label}</Text>
            </Link>
          );
        })}
        <Link
          href={SETTINGS_HREF}
          style={StyleSheet.flatten([styles.navItem, settingsActive && styles.navItemActive])}>
          <ModuleGlyph name="settings" active={settingsActive} size={22} />
          <Text style={StyleSheet.flatten([styles.navLabel, settingsActive && styles.navLabelActive])}>
            Settings
          </Text>
        </Link>
      </View>

      <View style={styles.footer}>
        <Text style={styles.userLabel}>{user?.displayName ?? 'Signed in'}</Text>
        {activeHousehold ? <Text style={styles.devHint}>{activeHousehold.name}</Text> : null}
        {user?.isDevBypass ? <Text style={styles.devHint}>Dev bypass · Supabase keys pending</Text> : null}
        <Pressable onPress={() => void signOut()} style={styles.signOut}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 268,
    backgroundColor: colors.bgSidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 32,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  markRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.accentMuted,
  },
  wordmark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagline: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  nav: {
    flex: 1,
    gap: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  navItemActive: {
    backgroundColor: colors.accentSoft,
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.text,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: 6,
  },
  userLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  devHint: {
    color: colors.textDim,
    fontSize: 11,
  },
  signOut: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  signOutLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
