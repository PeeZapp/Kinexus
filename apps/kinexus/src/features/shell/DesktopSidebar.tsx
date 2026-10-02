import { useEffect, useState } from 'react';
import { Link, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { RolePreviewSwitcher } from '@/src/features/household/RolePreview';
import { ModuleGlyph, type ModuleGlyphName } from '@/src/features/shell/ModuleGlyph';
import { SETTINGS_HREF, SETTINGS_PATH, visibleModules } from '@/src/features/shell/modules';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const SIDEBAR_COLLAPSED_KEY = 'kinexus.sidebarCollapsed';

function readCollapsed(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function NavTip({ label }: { label: string }) {
  return (
    <View style={styles.tip} pointerEvents="none">
      <Text style={styles.tipText}>{label}</Text>
    </View>
  );
}

function CollapseButton({
  collapsed,
  tip,
  onTip,
  onPress,
}: {
  collapsed: boolean;
  tip: string | null;
  onTip: (label: string | null) => void;
  onPress: () => void;
}) {
  const label = collapsed ? 'Expand menu' : 'Collapse menu';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      onHoverIn={() => onTip(label)}
      onHoverOut={() => onTip(null)}
      hitSlop={6}
      style={[styles.collapseBtn, collapsed && styles.collapseBtnCollapsed]}>
      <Text style={styles.collapseGlyph}>{collapsed ? '›' : '‹'}</Text>
      {collapsed && tip === label ? <NavTip label={label} /> : null}
    </Pressable>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  collapsed,
  tip,
  onTip,
}: {
  href: Href;
  label: string;
  icon: ModuleGlyphName;
  active: boolean;
  collapsed: boolean;
  tip: string | null;
  onTip: (label: string | null) => void;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onHoverIn={() => onTip(label)}
        onHoverOut={() => onTip(null)}
        style={StyleSheet.flatten([
          styles.navItem,
          active && styles.navItemActive,
          collapsed && styles.navItemCollapsed,
        ])}>
        <ModuleGlyph name={icon} active={active} size={22} />
        {collapsed ? null : (
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
        )}
        {collapsed && tip === label ? <NavTip label={label} /> : null}
      </Pressable>
    </Link>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { activeHousehold, role } = useHousehold();
  const settingsActive = pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
  const [collapsed, setCollapsed] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      writeCollapsed(next);
      setTip(null);
      return next;
    });
  };

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
        <View style={styles.mark}>
          <View style={styles.markDot} />
          <View style={styles.markRing} />
        </View>
        {collapsed ? null : (
          <View style={styles.brandCopy}>
            <Text style={styles.wordmark}>Kinexus</Text>
            <Text style={styles.tagline}>Meals · Lists · Money · Nutrition · Train</Text>
          </View>
        )}
        {collapsed ? null : <CollapseButton collapsed={false} tip={tip} onTip={setTip} onPress={toggle} />}
      </View>

      {collapsed ? <CollapseButton collapsed tip={tip} onTip={setTip} onPress={toggle} /> : null}

      <View style={styles.nav}>
        {visibleModules(role).map((mod) => {
          const active = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
          return (
            <SidebarLink
              key={mod.key}
              href={mod.href as Href}
              label={mod.label}
              icon={mod.key}
              active={active}
              collapsed={collapsed}
              tip={tip}
              onTip={setTip}
            />
          );
        })}
        <SidebarLink
          href={SETTINGS_HREF}
          label="Settings"
          icon="settings"
          active={settingsActive}
          collapsed={collapsed}
          tip={tip}
          onTip={setTip}
        />
      </View>

      <View style={[styles.footer, collapsed && styles.footerCollapsed]}>
        {collapsed ? null : (
          <>
            <RolePreviewSwitcher />
            <Text style={styles.userLabel}>{user?.displayName ?? 'Signed in'}</Text>
            {activeHousehold ? <Text style={styles.devHint}>{activeHousehold.name}</Text> : null}
            {user?.isDevBypass ? <Text style={styles.devHint}>Dev bypass · Supabase keys pending</Text> : null}
          </>
        )}
        <Pressable
          onPress={() => void signOut()}
          accessibilityLabel="Sign out"
          onHoverIn={() => setTip('Sign out')}
          onHoverOut={() => setTip(null)}
          style={[styles.signOut, collapsed && styles.signOutCollapsed]}>
          <Text style={styles.signOutLabel}>{collapsed ? '↪' : 'Sign out'}</Text>
          {collapsed && tip === 'Sign out' ? <NavTip label="Sign out" /> : null}
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
    zIndex: 2,
  },
  sidebarCollapsed: {
    width: 76,
    paddingHorizontal: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 28,
  },
  brandCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
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
  collapseBtn: {
    width: 28,
    height: 28,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnCollapsed: {
    alignSelf: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  collapseGlyph: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: -1,
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
    position: 'relative',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 48,
    alignSelf: 'center',
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
  tip: {
    position: 'absolute',
    left: 52,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 5,
  },
  tipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: 6,
  },
  footerCollapsed: {
    alignItems: 'center',
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
  signOutCollapsed: {
    alignSelf: 'center',
    width: 48,
    height: 40,
    marginTop: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    position: 'relative',
  },
  signOutLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
