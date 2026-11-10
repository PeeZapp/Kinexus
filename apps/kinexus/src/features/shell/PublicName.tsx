import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { colors } from '@/src/features/shell/theme';
import { creatorProfileHref } from '@/src/features/creators/creators-api';

export type PublicNameUser = {
  globalHandle: string;
  username?: string | null;
  isVerifiedCreator?: boolean;
};

export function publicPrimaryName(user: PublicNameUser): string {
  const username = user.username?.trim();
  return username || user.globalHandle;
}

export function publicProfileKey(user: PublicNameUser): string {
  return user.username?.trim() || user.globalHandle;
}

/** Global surfaces only: username if set, else permanent handle. Never real names/emails. */
export function PublicName({
  user,
  style,
  primaryStyle,
  secondaryStyle,
  numberOfLines = 1,
  link = false,
}: {
  user: PublicNameUser;
  style?: StyleProp<ViewStyle>;
  primaryStyle?: StyleProp<TextStyle>;
  secondaryStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** When true, tap opens `/u/<handle>`. */
  link?: boolean;
}) {
  const router = useRouter();
  const primary = publicPrimaryName(user);
  const showHandle = Boolean(user.username?.trim());
  const body = (
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

  if (!link || !publicProfileKey(user) || publicProfileKey(user) === 'Unknown') {
    return body;
  }

  return (
    <Pressable
      onPress={() => router.push(creatorProfileHref(publicProfileKey(user)) as Href)}
      accessibilityRole="link"
      accessibilityLabel={`@${publicProfileKey(user)}`}>
      {body}
    </Pressable>
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
