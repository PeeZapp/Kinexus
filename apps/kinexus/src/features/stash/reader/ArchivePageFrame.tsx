import { createElement, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/src/features/household/ui';
import { buildArchiveFrameUrl } from '@/src/features/stash/stash-api';
import { colors, radius, space } from '@/src/features/shell/theme';

export function ArchivePageFrame({
  uri,
  title,
  tall,
}: {
  uri: string;
  title: string;
  tall?: boolean;
}) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFrameSrc(null);
    setError(null);
    void buildArchiveFrameUrl(uri)
      .then((src) => {
        if (!cancelled) setFrameSrc(src);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open archive viewer');
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.nativeCopy}>
          Embedded page preview is available on web. Open the archived snapshot to view the full layout.
        </Text>
        <Btn label="Open archived page" variant="secondary" onPress={() => void Linking.openURL(uri)} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.nativeCopy}>{error}</Text>
        <Btn label="Open archived page" variant="secondary" onPress={() => void Linking.openURL(uri)} />
      </View>
    );
  }

  if (!frameSrc) {
    return (
      <View style={[styles.frame, tall && styles.frameTall, styles.loading]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.nativeCopy}>Loading archive viewer…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, tall && styles.frameTall]}>
      {createElement('iframe', {
        src: frameSrc,
        title: title || 'Archived page',
        style: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: radius.md,
          backgroundColor: '#ffffff',
        },
        // No allow-top-navigation: blocks archive.is frame-busting from leaving the app.
        sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads',
        referrerPolicy: 'no-referrer',
        loading: 'lazy',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 560,
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  frameTall: {
    height: 720,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
  },
  nativeFallback: {
    gap: 12,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  nativeCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
