import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { colors, radius } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

const NAV: { href: Href; label: string; match: string }[] = [
  { href: '/staff' as Href, label: 'Digest', match: '/staff' },
  { href: '/staff/applications' as Href, label: 'Applications', match: '/staff/applications' },
  { href: '/staff/creators' as Href, label: 'Creators', match: '/staff/creators' },
  { href: '/staff/team' as Href, label: 'Team', match: '/staff/team' },
];

export function StaffChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View>
          <Text style={styles.kicker}>Kinexus staff</Text>
          <Text style={styles.title}>Creator control</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email ?? user?.displayName ?? 'Staff'}
          </Text>
          <Pressable
            onPress={() => void signOut().then(() => router.replace('/staff/sign-in' as Href))}
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.nav}>
        {NAV.map((item) => {
          const active =
            item.match === '/staff'
              ? pathname === '/staff' || pathname === '/staff/'
              : pathname.startsWith(item.match);
          return (
            <Pressable
              key={item.match}
              onPress={() => router.push(item.href)}
              style={[styles.navItem, active && styles.navItemActive]}>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071018',
  },
  top: {
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  kicker: {
    color: '#7DD3C7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: '#F4F7FA',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  topRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  email: {
    color: '#8D9AAB',
    fontSize: 13,
    maxWidth: 240,
  },
  signOut: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  nav: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(62, 207, 191, 0.14)',
  },
  navLabel: {
    color: '#8D9AAB',
    fontSize: 13,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#3ECFBF',
  },
  body: {
    flex: 1,
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.85,
  },
});
