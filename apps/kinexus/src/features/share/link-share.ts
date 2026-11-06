import * as Crypto from 'expo-crypto';

import { supabase } from '@/src/lib/supabase';
import { buildShareUrl, type ShareKind } from '@/src/features/share/share-url';

function db() {
  if (!supabase) throw new Error('Not ready');
  return supabase;
}

async function setShare(
  table: 'workouts' | 'watchlist_lists',
  id: string,
  patch: { is_shared: boolean; share_token: string | null },
): Promise<void> {
  const { error } = await db().from(table).update(patch).eq('id', id);
  if (error) throw error;
}

export async function enableEntityShare(kind: Exclude<ShareKind, 'list'>, id: string, currentToken: string | null): Promise<string> {
  const token = currentToken ?? Crypto.randomUUID();
  await setShare(kind === 'workout' ? 'workouts' : 'watchlist_lists', id, {
    is_shared: true,
    share_token: token,
  });
  return buildShareUrl(kind, token);
}

export async function disableEntityShare(kind: Exclude<ShareKind, 'list'>, id: string): Promise<null> {
  await setShare(kind === 'workout' ? 'workouts' : 'watchlist_lists', id, {
    is_shared: false,
    share_token: null,
  });
  return null;
}

export async function resetEntityShare(kind: Exclude<ShareKind, 'list'>, id: string): Promise<string> {
  const token = Crypto.randomUUID();
  await setShare(kind === 'workout' ? 'workouts' : 'watchlist_lists', id, {
    is_shared: true,
    share_token: token,
  });
  return buildShareUrl(kind, token);
}

export function sharePreview(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
}
