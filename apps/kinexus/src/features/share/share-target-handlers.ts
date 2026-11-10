import type { Href } from 'expo-router';

import { isHevyWorkoutImportUrl, isWatchlistListImportUrl, type ShareTarget } from '@kinexus/domain';

import { stashListImport } from '@/src/features/lists/list-import-stash';
import type { LastUsedShareList } from '@/src/features/share/share-target-last-list';
import { writeLastUsedShareList } from '@/src/features/share/share-target-last-list';

export type ShareTargetHandoffInput = {
  target: ShareTarget;
  url: string | null;
  text: string | null;
  list: LastUsedShareList | null;
};

export type ShareTargetRouter = {
  replace: (href: Href) => void;
};

/**
 * Hand off a picked share target to the existing destination flow.
 * No new import logic — only navigation / stash into current screens.
 */
export async function handoffShareTarget(
  input: ShareTargetHandoffInput,
  router: ShareTargetRouter,
): Promise<void> {
  const { target, url, text, list } = input;

  if (list && (target === 'watchlist' || target === 'readlist' || target === 'wishlist')) {
    await writeLastUsedShareList(target, list);
  }

  if (target === 'recipe') {
    if (url) {
      router.replace({ pathname: '/import', params: { url } } as Href);
      return;
    }
    router.replace('/import' as Href);
    return;
  }

  if (target === 'workout') {
    const link = url && isHevyWorkoutImportUrl(url) ? url : url;
    if (link) {
      stashListImport({
        fileName: 'link.txt',
        mimeType: 'text/plain',
        text: null,
        bytes: null,
        kindHint: 'workout',
        linkUrl: link,
      });
      router.replace({
        pathname: '/lists/import',
        params: { kind: 'workout', linkUrl: link },
      } as Href);
      return;
    }
    router.replace({ pathname: '/lists/import', params: { kind: 'workout' } } as Href);
    return;
  }

  if (target === 'watchlist') {
    if (url && isWatchlistListImportUrl(url)) {
      stashListImport({
        fileName: 'link.txt',
        mimeType: 'text/plain',
        text: null,
        bytes: null,
        kindHint: 'watchlist',
        linkUrl: url,
      });
      router.replace({
        pathname: '/lists/import',
        params: {
          kind: 'watchlist',
          linkUrl: url,
          ...(list?.id ? { listId: list.id } : {}),
        },
      } as Href);
      return;
    }
    router.replace({
      pathname: '/lists/watchlist',
      params: {
        ...(url ? { shareUrl: url } : {}),
        ...(list?.id ? { listId: list.id } : {}),
      },
    } as Href);
    return;
  }

  if (target === 'readlist') {
    const value = url ?? text;
    router.replace({
      pathname: '/lists/readlist',
      params: {
        ...(value ? { shareUrl: value } : {}),
        ...(list?.id ? { listId: list.id } : {}),
      },
    } as Href);
    return;
  }

  if (target === 'wishlist') {
    router.replace({
      pathname: '/lists/wishlists',
      params: {
        ...(url ? { shareUrl: url } : {}),
        ...(list?.id ? { listId: list.id } : {}),
      },
    } as Href);
    return;
  }

  // shopping
  const body = text?.trim() || url?.trim() || '';
  stashListImport({
    fileName: 'share.txt',
    mimeType: 'text/plain',
    text: body,
    bytes: null,
    kindHint: 'shopping',
  });
  router.replace({ pathname: '/lists/import', params: { kind: 'shopping' } } as Href);
}
