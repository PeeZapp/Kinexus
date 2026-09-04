import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppChrome } from '@/src/features/shell/AppChrome';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

export default function AppGroupLayout() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <AppChrome>
      <Slot />
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
