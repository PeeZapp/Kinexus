import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import * as FileSystem from 'expo-file-system/legacy';

import { isShareStatementFile, type ShareTarget, type ShareTargetGuess } from '@kinexus/domain';

import { CookShell } from '@/src/features/cook/CookShell';
import { useReadlistSync } from '@/src/features/readlist/use-readlist-sync';
import { ShareTargetPicker, type ShareTargetPickerLists } from '@/src/features/share/ShareTargetPicker';
import {
  decideShareIntent,
  type ShareIntentFile,
  type ShareIntentPayload,
} from '@/src/features/share/share-intent-route';
import { stashShareIntentPayload, takeStashedShareIntentPayload } from '@/src/features/share/share-intent-stash';
import { handoffShareTarget } from '@/src/features/share/share-target-handlers';
import type { LastUsedShareList } from '@/src/features/share/share-target-last-list';
import { useStashSync } from '@/src/features/stash/use-stash-sync';
import { useWatchlistSync } from '@/src/features/stash/use-watchlist-sync';
import { colors, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { rememberAuthReturn } from '@/src/lib/auth-return';

async function withStatementPreviews(files: ShareIntentFile[]): Promise<ShareIntentFile[]> {
  return Promise.all(
    files.map(async (file) => {
      const fileName = file.fileName ?? file.file?.name ?? '';
      const mimeType = file.mimeType ?? file.file?.type ?? null;
      if (!isShareStatementFile({ fileName, mimeType })) return file;
      if (/\.pdf$/i.test(fileName) || mimeType === 'application/pdf') return file;
      if (file.textPreview) return file;
      try {
        if (file.file) {
          const text = await file.file.text();
          return { ...file, textPreview: text.slice(0, 4000) };
        }
        if (file.path) {
          const text = await FileSystem.readAsStringAsync(file.path, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return { ...file, textPreview: text.slice(0, 4000) };
        }
      } catch {
        /* classification falls back to filename */
      }
      return file;
    }),
  );
}

/**
 * Native iOS Share Extension / Android ACTION_SEND entry.
 * Links/text and multi-candidate files open the target picker; a single file candidate goes straight through.
 */
export default function ShareIntentRoute() {
  const router = useRouter();
  const { user, isReady: authReady } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();
  const handled = useRef(false);
  const authRedirected = useRef(false);
  const pickerOpened = useRef(false);
  const [guess, setGuess] = useState<ShareTargetGuess | null>(null);
  const [pendingFiles, setPendingFiles] = useState<ShareIntentFile[] | null>(null);
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
    if (!authReady || !isReady || handled.current || pickerOpened.current) return;

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
      const live: ShareIntentPayload | null = hasShareIntent
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
        handled.current = true;
        router.replace('/import' as Href);
        return;
      }

      if (payload.files?.length) {
        payload.files = await withStatementPreviews(payload.files);
      }

      const decision = decideShareIntent(payload);

      if (decision.kind === 'empty') {
        handled.current = true;
        resetShareIntent(true);
        router.replace('/import' as Href);
        return;
      }

      if (decision.kind === 'files') {
        if (decision.auto) {
          handled.current = true;
          try {
            const target = decision.guess.targets[0] ?? 'list_import';
            resetShareIntent(true);
            await handoffShareTarget(
              {
                target,
                url: null,
                text: null,
                list: null,
                files: decision.files,
              },
              router,
            );
          } catch {
            resetShareIntent(true);
            router.replace('/lists/import' as Href);
          }
          return;
        }
        pickerOpened.current = true;
        setPendingFiles(decision.files);
        setGuess(decision.guess);
        return;
      }

      pickerOpened.current = true;
      setPendingFiles(null);
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
          files: pendingFiles,
        },
        router,
      );
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    resetShareIntent(true);
    setPendingFiles(null);
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
