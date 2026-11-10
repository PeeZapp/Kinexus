import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';

import type { ShareTarget, ShareTargetGuess } from '@kinexus/domain';

import { CookShell } from '@/src/features/cook/CookShell';
import { readListFileUri } from '@/src/features/lists/list-file-io';
import { stashListImport } from '@/src/features/lists/list-import-stash';
import { useReadlistSync } from '@/src/features/readlist/use-readlist-sync';
import { ShareTargetPicker, type ShareTargetPickerLists } from '@/src/features/share/ShareTargetPicker';
import { decideShareIntent } from '@/src/features/share/share-intent-route';
import { stashShareIntentPayload, takeStashedShareIntentPayload } from '@/src/features/share/share-intent-stash';
import { handoffShareTarget } from '@/src/features/share/share-target-handlers';
import type { LastUsedShareList } from '@/src/features/share/share-target-last-list';
import { useStashSync } from '@/src/features/stash/use-stash-sync';
import { useWatchlistSync } from '@/src/features/stash/use-watchlist-sync';
import { colors, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { rememberAuthReturn } from '@/src/lib/auth-return';

/**
 * Native iOS Share Extension / Android ACTION_SEND entry.
 * Files keep list-import branching; links/text open a target picker.
 */
export default function ShareIntentRoute() {
  const router = useRouter();
  const { user, isReady: authReady } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const handledFile = useRef(false);
  const authRedirected = useRef(false);
  const pickerOpened = useRef(false);
  const [guess, setGuess] = useState<ShareTargetGuess | null>(null);
  const [busy, setBusy] = useState(false);

  const watchlist = useWatchlistSync();
  const readlist = useReadlistSync();
  const stash = useStashSync();

  const lists = useMemo<ShareTargetPickerLists>(
    () => ({
      watchlist: watchlist.lists
        .filter((list) => list.kind === 'custom')
        .map((list) => ({ id: list.id, name: list.name })),
      readlist: readlist.lists.map((list) => ({ id: list.id, name: list.name })),
      wishlist: stash.lists
        .filter((list) => list.kind === 'wishlist')
        .map((list) => ({ id: list.id, name: list.name })),
    }),
    [readlist.lists, stash.lists, watchlist.lists],
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace('/import' as Href);
      return;
    }
    if (!authReady || !isReady || handledFile.current || pickerOpened.current) return;

    if (!user) {
      if (authRedirected.current) return;
      authRedirected.current = true;
      void (async () => {
        if (hasShareIntent) {
          await stashShareIntentPayload({
            files: shareIntent.files,
            webUrl: shareIntent.webUrl,
            text: shareIntent.text,
            title: shareIntent.meta?.title,
          });
        }
        rememberAuthReturn('/shareintent');
        router.replace('/sign-in' as Href);
      })();
      return;
    }

    void (async () => {
      const live = hasShareIntent
        ? {
            files: shareIntent.files,
            webUrl: shareIntent.webUrl,
            text: shareIntent.text,
            title: shareIntent.meta?.title,
          }
        : null;
      const stashed = live ? null : await takeStashedShareIntentPayload();
      const payload = live ?? stashed;

      if (!payload) {
        handledFile.current = true;
        router.replace('/import' as Href);
        return;
      }

      const decision = decideShareIntent(payload);

      if (decision.kind === 'file') {
        handledFile.current = true;
        try {
          const file = decision.file;
          const picked = await readListFileUri(file.path ?? '', file.fileName ?? 'import', file.mimeType);
          stashListImport(picked);
          resetShareIntent(true);
          router.replace('/lists/import' as Href);
        } catch {
          resetShareIntent(true);
          router.replace('/lists/import' as Href);
        }
        return;
      }

      if (decision.kind === 'empty') {
        handledFile.current = true;
        resetShareIntent(true);
        router.replace('/import' as Href);
        return;
      }

      pickerOpened.current = true;
      setGuess(decision.guess);
    })();
  }, [
    authReady,
    hasShareIntent,
    isReady,
    resetShareIntent,
    router,
    shareIntent.files,
    shareIntent.meta?.title,
    shareIntent.text,
    shareIntent.webUrl,
    user,
  ]);

  async function onPick(input: { target: ShareTarget; list: LastUsedShareList | null }) {
    if (!guess) return;
    setBusy(true);
    try {
      resetShareIntent(true);
      await handoffShareTarget(
        {
          target: input.target,
          url: guess.url,
          text: guess.text,
          list: input.list,
        },
        router,
      );
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    resetShareIntent(true);
    router.replace('/' as Href);
  }

  if (guess) {
    return (
      <CookShell title="Share" showInstall={false}>
        <View style={styles.root}>
          <ShareTargetPicker
            visible
            guess={guess}
            lists={lists}
            busy={busy}
            onCancel={onCancel}
            onPick={(next) => void onPick(next)}
          />
        </View>
      </CookShell>
    );
  }

  return (
    <CookShell title="Import" showInstall={false}>
      <View style={styles.root}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.label}>Opening shared item…</Text>
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
