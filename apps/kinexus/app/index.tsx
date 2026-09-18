import { Redirect, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SETTINGS_HREF } from '@/src/features/shell/modules';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

export default function Index() {
  const pathname = usePathname();
  const { user, isReady } = useAuth();
  const { isReady: householdReady, memberships, pendingInviteToken } = useHousehold();

  if (!isReady || (user && !householdReady)) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Index stays in the root stack. Only send people onward when they are actually at `/`,
  // otherwise a remounted Redirect would steal whatever screen they had open.
  if (pathname !== '/' && pathname !== '') {
    return null;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (pendingInviteToken) {
    return <Redirect href={{ pathname: '/invite/[token]', params: { token: pendingInviteToken } }} />;
  }

  if (memberships.length === 0) {
    return <Redirect href={SETTINGS_HREF} />;
  }

  return <Redirect href="/meals" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
