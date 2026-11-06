import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { avatarPresetSource } from '@/src/features/shell/avatar-presets';
import { colors } from '@/src/features/shell/theme';
import { resolveAvatarDisplay } from '@/src/lib/identity-avatar';

/** Renders a profile avatar from preset and optional Google photo fields. */
export function ProfileAvatar({
  avatarUrl,
  avatarSource,
  avatarGoogleUrl,
  size = 56,
}: {
  avatarUrl?: string | null;
  avatarSource?: 'preset' | 'google' | null;
  avatarGoogleUrl?: string | null;
  size?: number;
}) {
  const display = resolveAvatarDisplay({ avatarUrl, avatarSource, avatarGoogleUrl });
  const [googleFailed, setGoogleFailed] = useState(false);
  const showGoogle = display.kind === 'google' && !googleFailed;

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
      {showGoogle ? (
        <Image
          source={{ uri: display.uri }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setGoogleFailed(true)}
          style={{ width: size, height: size }}
        />
      ) : (
        <Image
          source={avatarPresetSource(display.preset)}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      )}
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
