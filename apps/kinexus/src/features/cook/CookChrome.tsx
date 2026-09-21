import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { PwaInstallHint } from '@/src/features/shell/PwaInstallHint';
import { colors, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function CookChrome({
  title,
  children,
  showInstall = true,
}: {
  title: string;
  children: ReactNode;
  showInstall?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.push('/import' as Href)} hitSlop={8}>
          <Text style={styles.brand}>Kinexus</Text>
          <Text style={styles.title}>{title}</Text>
        </Pressable>
        <View style={styles.nav}>
          <Pressable onPress={() => router.push('/import' as Href)} hitSlop={8}>
            <Text style={styles.navLink}>Import</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/recipes' as Href)} hitSlop={8}>
            <Text style={styles.navLink}>My Recipes</Text>
          </Pressable>
          {user ? (
            <Pressable onPress={() => router.push('/meals/recipes' as Href)} hitSlop={8}>
              <Text style={styles.navLink}>Library</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/sign-in' as Href)} hitSlop={8}>
              <Text style={styles.navLink}>Sign in</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={[styles.body, desktop && styles.bodyDesktop]}>{children}</View>
      {showInstall ? <PwaInstallHint /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSidebar,
    gap: 12,
  },
  brand: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 14,
    paddingBottom: 4,
  },
  navLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyDesktop: {
    alignItems: 'center',
  },
});
