import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { avatarPresetSource } from '@/src/features/shell/avatar-presets';
import { colors } from '@/src/features/shell/theme';
import { resolveAvatarDisplay } from '@/src/lib/identity-avatar';
import { fetchFacebookAvatarPictureUrl } from '@/src/lib/profile-avatar-facebook';

/** Renders a profile avatar from preset and optional Google / Facebook photo fields. */
export function ProfileAvatar({
  avatarUrl,
  avatarSource,
  avatarGoogleUrl,
  avatarFacebookId,
  size = 56,
}: {
  avatarUrl?: string | null;
  avatarSource?: 'preset' | 'google' | 'facebook' | null;
  avatarGoogleUrl?: string | null;
  avatarFacebookId?: string | null;
  size?: number;
}) {
  const display = resolveAvatarDisplay({
    avatarUrl,
    avatarSource,
    avatarGoogleUrl,
    avatarFacebookId,
  });
  const [googleFailed, setGoogleFailed] = useState(false);
  const [facebookUri, setFacebookUri] = useState<string | null>(null);
  const [facebookFailed, setFacebookFailed] = useState(false);
  const [facebookRetry, setFacebookRetry] = useState(0);

  useEffect(() => {
    setGoogleFailed(false);
  }, [display.kind === 'google' ? display.uri : null]);

  useEffect(() => {
    if (display.kind !== 'facebook') {
      setFacebookUri(null);
      setFacebookFailed(false);
      return;
    }
    let cancelled = false;
    setFacebookFailed(false);
    setFacebookUri(null);
    void fetchFacebookAvatarPictureUrl()
      .then((url) => {
        if (!cancelled) setFacebookUri(url);
      })
      .catch(() => {
        if (!cancelled) setFacebookFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [display.kind === 'facebook' ? display.facebookId : null, facebookRetry]);

  const showGoogle = display.kind === 'google' && !googleFailed;
  const showFacebook = display.kind === 'facebook' && !facebookFailed && Boolean(facebookUri);

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
      ) : showFacebook ? (
        <Image
          source={{ uri: facebookUri! }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => {
            // Expired CDN URL: refresh once via the API, then fall back to preset.
            if (facebookRetry === 0) {
              setFacebookRetry(1);
              return;
            }
            setFacebookFailed(true);
          }}
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
