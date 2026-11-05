import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from '@/src/features/shell/theme';

export type PublicNameUser = {
  globalHandle: string;
  username?: string | null;
  isVerifiedCreator?: boolean;
};

export function publicPrimaryName(user: PublicNameUser): string {
  const username = user.username?.trim();
  return username || user.globalHandle;
}

/** Global surfaces only: username if set, else permanent handle. Never real names/emails. */
export function PublicName({
  user,
  style,
  primaryStyle,
  secondaryStyle,
  numberOfLines = 1,
}: {
  user: PublicNameUser;
  style?: StyleProp<ViewStyle>;
  primaryStyle?: StyleProp<TextStyle>;
  secondaryStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const primary = publicPrimaryName(user);
  const showHandle = Boolean(user.username?.trim());
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.primaryRow}>
        <Text style={[styles.primary, primaryStyle]} numberOfLines={numberOfLines}>
          {primary}
        </Text>
        {user.isVerifiedCreator ? (
          <Text style={styles.badge} accessibilityLabel="Verified creator">
            ✓
          </Text>
        ) : null}
      </View>
      {showHandle ? (
        <Text style={[styles.secondary, secondaryStyle]} numberOfLines={1}>
          {user.globalHandle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, gap: 2 },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  primary: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  secondary: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  badge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
});
