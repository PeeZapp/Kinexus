import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';

import { extractRecipeUrlFromShare, isListImportFileName } from '@kinexus/domain';

import { CookShell } from '@/src/features/cook/CookShell';
import { readListFileUri } from '@/src/features/lists/list-file-io';
import { stashListImport } from '@/src/features/lists/list-import-stash';
import { colors, space } from '@/src/features/shell/theme';

/**
 * Native iOS Share Extension / Android ACTION_SEND entry.
 * expo-share-intent deep-links here; recipe URLs go to /import, list files to /lists/import.
 */
export default function ShareIntentRoute() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace('/import' as Href);
      return;
    }
    if (!isReady || handled.current) return;
    if (!hasShareIntent) {
      handled.current = true;
      router.replace('/import' as Href);
      return;
    }

    handled.current = true;
    const file = shareIntent.files?.[0] ?? null;
    const fileName = file?.fileName ?? '';

    void (async () => {
      try {
        if (file && isListImportFileName(fileName)) {
          const picked = await readListFileUri(file.path, fileName, file.mimeType);
          stashListImport(picked);
          resetShareIntent(true);
          router.replace('/lists/import' as Href);
          return;
        }

        const extracted = extractRecipeUrlFromShare({
          webUrl: shareIntent.webUrl,
          text: shareIntent.text,
          title: shareIntent.meta?.title,
          url: shareIntent.webUrl,
        });
        resetShareIntent(true);

        if (extracted) {
          router.replace({ pathname: '/import', params: { url: extracted } } as Href);
          return;
        }

        router.replace('/import' as Href);
      } catch {
        resetShareIntent(true);
        router.replace('/lists/import' as Href);
      }
    })();
  }, [hasShareIntent, isReady, resetShareIntent, router, shareIntent.files, shareIntent.meta?.title, shareIntent.text, shareIntent.webUrl]);

  return (
    <CookShell title="Import" showInstall={false}>
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.label}>Opening shared file…</Text>
      </View>
    </CookShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
