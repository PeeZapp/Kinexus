import { Image, StyleSheet, View } from 'react-native';

import { avatarPresetSource } from '@/src/features/shell/avatar-presets';
import { colors } from '@/src/features/shell/theme';
import { resolveAvatarPresetId } from '@/src/lib/identity-avatar';

/** Renders a profile avatar from a stored avatar_url (preset id or legacy value). */
export function ProfileAvatar({
  avatarUrl,
  size = 56,
}: {
  avatarUrl?: string | null;
  size?: number;
}) {
  const preset = resolveAvatarPresetId(avatarUrl);
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}>
      <Image
        source={avatarPresetSource(preset)}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        style={{ width: size * 0.62, height: size * 0.62 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
