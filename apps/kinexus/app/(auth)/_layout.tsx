import { Redirect, Slot, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { takeAuthReturn } from '@/src/lib/auth-return';

export default function AuthLayout() {
  const pathname = usePathname();
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (user && (pathname === '/sign-in' || pathname.startsWith('/sign-in/'))) {
    const next = takeAuthReturn('/');
    return <Redirect href={next as Href} />;
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
