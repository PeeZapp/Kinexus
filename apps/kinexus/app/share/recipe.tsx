import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  extractRecipeUrlFromShare,
  isShareStatementFile,
  type ShareTarget,
  type ShareTargetGuess,
} from '@kinexus/domain';

import { CookShell } from '@/src/features/cook/CookShell';
import { recipeParam } from '@/src/features/meals/recipe-href';
import { useReadlistSync } from '@/src/features/readlist/use-readlist-sync';
import { ShareTargetPicker, type ShareTargetPickerLists } from '@/src/features/share/ShareTargetPicker';
import { decideShareIntent, type ShareIntentFile } from '@/src/features/share/share-intent-route';
import {
  clearSharedShareTargetFiles,
  takeSharedShareTargetFiles,
} from '@/src/features/share/share-target-files';
import { handoffShareTarget } from '@/src/features/share/share-target-handlers';
import type { LastUsedShareList } from '@/src/features/share/share-target-last-list';
import { useStashSync } from '@/src/features/stash/use-stash-sync';
import { useWatchlistSync } from '@/src/features/stash/use-watchlist-sync';
import { colors, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { rememberAuthReturn } from '@/src/lib/auth-return';

function decoderPreview(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 4000));
  } catch {
    return '';
  }
}

/**
 * PWA Web Share Target landing (and any deep link with shared fields).
 * Android Chromium installed PWAs POST here via the service worker, which
 * stashes files in Cache API and 303-redirects here with query params.
 */
export default function ShareRecipeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    url?: string | string[];
    text?: string | string[];
    title?: string | string[];
    sharedFiles?: string | string[];
  }>();
  const { user, isReady: authReady } = useAuth();
  const handled = useRef(false);
  const authRedirected = useRef(false);
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
    if (!authReady || handled.current) return;

    const sharedFilesFlag = recipeParam(params.sharedFiles) === '1';
    const url = recipeParam(params.url);
    const text = recipeParam(params.text);
    const title = recipeParam(params.title);

    if (!user) {
      if (authRedirected.current) return;
      authRedirected.current = true;
      rememberAuthReturn(
        sharedFilesFlag
          ? `/share/recipe?sharedFiles=1${url ? `&url=${encodeURIComponent(url)}` : ''}${text ? `&text=${encodeURIComponent(text)}` : ''}${title ? `&title=${encodeURIComponent(title)}` : ''}`
          : `/share/recipe${url || text || title ? `?${new URLSearchParams({ ...(url ? { url } : {}), ...(text ? { text } : {}), ...(title ? { title } : {}) }).toString()}` : ''}`,
      );
      router.replace('/sign-in' as Href);
      return;
    }

    void (async () => {
      if (sharedFilesFlag) {
        const shared = await takeSharedShareTargetFiles();
        if (shared.length > 0) {
          const files: ShareIntentFile[] = shared.map((file) => {
            const base: ShareIntentFile = {
              fileName: file.fileName,
              mimeType: file.mimeType,
              file: new File([file.bytes], file.fileName, { type: file.mimeType ?? undefined }),
            };
            if (
              isShareStatementFile({ fileName: file.fileName, mimeType: file.mimeType }) &&
              !/\.pdf$/i.test(file.fileName)
            ) {
              base.textPreview = decoderPreview(file.bytes);
            }
            return base;
          });
          const decision = decideShareIntent({ files, url, text, title });
          if (decision.kind === 'files') {
            if (decision.auto) {
              handled.current = true;
              try {
                await handoffShareTarget(
                  {
                    target: decision.guess.targets[0] ?? 'list_import',
                    url: null,
                    text: null,
                    list: null,
                    files: decision.files,
                  },
                  router,
                );
              } catch {
                router.replace('/lists/import' as Href);
              }
              return;
            }
            handled.current = true;
            setPendingFiles(decision.files);
            setGuess(decision.guess);
            return;
          }
        }
      }

      handled.current = true;
      const extracted = extractRecipeUrlFromShare({ url, text, title });
      if (extracted) {
        router.replace({ pathname: '/import', params: { url: extracted } } as Href);
        return;
      }

      const linkDecision = decideShareIntent({ url, text, title });
      if (linkDecision.kind === 'picker') {
        setPendingFiles(null);
        setGuess(linkDecision.guess);
        return;
      }

      router.replace('/import' as Href);
    })();
  }, [authReady, params.sharedFiles, params.text, params.title, params.url, router, user]);

  async function onPick(input: { target: ShareTarget; list: LastUsedShareList | null }) {
    if (!guess) return;
    setBusy(true);
    try {
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
    void clearSharedShareTargetFiles();
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
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.label}>Opening shared item…</Text>
    </View>
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
