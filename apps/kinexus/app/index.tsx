import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

export default function Index() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={user ? '/meals' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
