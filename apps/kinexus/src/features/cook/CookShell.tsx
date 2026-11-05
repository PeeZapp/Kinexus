import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CookChrome } from '@/src/features/cook/CookChrome';
import { AppChrome } from '@/src/features/shell/AppChrome';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

/**
 * Signed-in: normal app shell (tabs / sidebar).
 * Signed-out: standalone CookChrome for public cook / import links.
 */
export function CookShell({
  title,
  children,
  showInstall = true,
}: {
  title: string;
  children: ReactNode;
  showInstall?: boolean;
}) {
  const { user, isReady } = useAuth();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (user) {
    return (
      <AppChrome>
        <View style={[styles.body, desktop && styles.bodyDesktop]}>{children}</View>
      </AppChrome>
    );
  }

  return (
    <CookChrome title={title} showInstall={showInstall}>
      {children}
    </CookChrome>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
  bodyDesktop: {
    alignItems: 'center',
  },
});
