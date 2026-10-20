import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Slot, usePathname } from 'expo-router';
import type { Href } from 'expo-router';

import { StaffChrome } from '@/src/features/staff/StaffChrome';
import { useStaffAccess } from '@/src/features/staff/use-staff';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

export default function StaffLayout() {
  const pathname = usePathname();
  const { user, isReady } = useAuth();
  const access = useStaffAccess();
  const isSignIn = pathname.includes('/sign-in');

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (isSignIn) {
    if (user && access.ready && access.isStaff) {
      return <Redirect href={'/staff' as Href} />;
    }
    return <Slot />;
  }

  if (!user) {
    return <Redirect href={'/staff/sign-in' as Href} />;
  }

  if (!access.ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.label}>Checking staff access…</Text>
      </View>
    );
  }

  if (!access.isStaff) {
    return <Redirect href={'/staff/sign-in' as Href} />;
  }

  return (
    <StaffChrome>
      <Slot />
    </StaffChrome>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#071018',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
