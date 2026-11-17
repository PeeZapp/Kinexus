import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/features/shell/theme';

/** Compact Privacy / Terms links for Settings and sign-in. */
export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Link href="/privacy">
        <Text style={styles.link}>Privacy</Text>
      </Link>
      <Text style={styles.dot}>·</Text>
      <Link href="/terms">
        <Text style={styles.link}>Terms</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  link: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    color: colors.textDim,
    fontSize: 13,
  },
});
