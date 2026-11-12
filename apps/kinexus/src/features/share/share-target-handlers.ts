import type { Href } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

import {
  isHevyWorkoutImportUrl,
  isShareImageFile,
  isShareStatementFile,
  isWatchlistListImportUrl,
  type ShareTarget,
} from '@kinexus/domain';

import {
  stashBudgetTxnShare,
  type StashedBudgetTxnScreenshot,
} from '@/src/features/finances/budget/budget-txn-share-stash';
import { readListFileUri, type PickedListFile } from '@/src/features/lists/list-file-io';
import { stashListImport } from '@/src/features/lists/list-import-stash';
import type { ShareIntentFile } from '@/src/features/share/share-intent-route';
import type { LastUsedShareList } from '@/src/features/share/share-target-last-list';
import { writeLastUsedShareList } from '@/src/features/share/share-target-last-list';

export type ShareTargetHandoffInput = {
  target: ShareTarget;
  url: string | null;
  text: string | null;
  list: LastUsedShareList | null;
  files?: ShareIntentFile[] | null;
};

export type ShareTargetRouter = {
  replace: (href: Href) => void;
};

function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function isBinaryShareName(fileName: string, mimeType: string | null): boolean {
  const ext = extensionOf(fileName);
  if (['xlsx', 'xls', 'docx', 'zip', 'pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext)) return true;
  if (mimeType?.startsWith('image/')) return true;
  if (mimeType === 'application/pdf') return true;
  return false;
}

async function readShareFile(file: ShareIntentFile): Promise<PickedListFile> {
  const fileName = file.fileName?.trim() || file.file?.name || 'import';
  const mimeType = file.mimeType ?? file.file?.type ?? null;

  if (file.file) {
    if (isBinaryShareName(fileName, mimeType)) {
      const buffer = await file.file.arrayBuffer();
      return { fileName, mimeType, text: null, bytes: new Uint8Array(buffer) };
    }
    const text = await file.file.text();
    return { fileName, mimeType, text, bytes: null };
  }

  if (file.path) {
    if (isBinaryShareName(fileName, mimeType)) {
      const base64 = await FileSystem.readAsStringAsync(file.path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { fileName, mimeType, text: null, bytes: base64ToBytes(base64) };
    }
    return readListFileUri(file.path, fileName, mimeType);
  }

  throw new Error('Shared file was missing a path');
}

async function readBudgetShare(files: ShareIntentFile[]) {
  const images = files.filter((file) =>
    isShareImageFile({ fileName: file.fileName ?? file.file?.name, mimeType: file.mimeType ?? file.file?.type }),
  );
  if (images.length > 0) {
    const screenshots: StashedBudgetTxnScreenshot[] = [];
    for (const file of images.slice(0, 6)) {
      const picked = await readShareFile(file);
      if (!picked.bytes) continue;
      screenshots.push({
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        bytes: picked.bytes,
      });
    }
    if (screenshots.length === 0) throw new Error('Could not read shared screenshots');
    return { kind: 'screenshots' as const, screenshots };
  }

  const statement = files.find((file) =>
    isShareStatementFile({ fileName: file.fileName ?? file.file?.name, mimeType: file.mimeType ?? file.file?.type }),
  );
  if (!statement) throw new Error('No statement file in this share');
  const picked = await readShareFile(statement);
  const text = picked.text?.trim() ?? '';
  const isPdf = /\.pdf$/i.test(picked.fileName) || picked.mimeType === 'application/pdf';
  if (!text && !isPdf) throw new Error('That statement file could not be read as text');
  return {
    kind: 'statement' as const,
    fileName: picked.fileName,
    mimeType: picked.mimeType,
    text: text || '',
  };
}

/**
 * Hand off a picked share target to the existing destination flow.
 * No new import logic — only navigation / stash into current screens.
 */
export async function handoffShareTarget(
  input: ShareTargetHandoffInput,
  router: ShareTargetRouter,
): Promise<void> {
  const { target, url, text, list, files } = input;

  if (list && (target === 'watchlist' || target === 'readlist' || target === 'wishlist')) {
    await writeLastUsedShareList(target, list);
  }

  if (target === 'bank_transactions') {
    const payload = await readBudgetShare(files ?? []);
    stashBudgetTxnShare(payload);
    router.replace({ pathname: '/finances', params: { addTransactions: '1' } } as Href);
    return;
  }

  if (target === 'list_import') {
    const file = files?.[0];
    if (file) {
      const picked = await readShareFile(file);
      stashListImport(picked);
    }
    router.replace('/lists/import' as Href);
    return;
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
