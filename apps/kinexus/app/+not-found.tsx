import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={styles.container}>
        <EmptyState
          kicker="404"
          title="This screen does not exist"
          body="The link may be old, or the page moved. Meals, Settings, and sign-in are still in the sidebar / tabs.">
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Back to Kinexus</Text>
          </Link>
        </EmptyState>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: colors.bg,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  link: {
    marginTop: 4,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '700',
  },
});
