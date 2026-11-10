import * as Crypto from 'expo-crypto';

import { supabase } from '@/src/lib/supabase';
import { buildShareUrl, type ShareKind } from '@/src/features/share/share-url';

function db() {
  if (!supabase) throw new Error('Not ready');
  return supabase;
}

type ShareTable = 'workouts' | 'watchlist_lists' | 'training_plans';
type EntityShareKind = Exclude<ShareKind, 'list' | 'readlist'>;

function tableFor(kind: EntityShareKind): ShareTable {
  if (kind === 'workout') return 'workouts';
  if (kind === 'plan') return 'training_plans';
  return 'watchlist_lists';
}

async function setShare(
  table: ShareTable,
  id: string,
  patch: { is_shared: boolean; share_token: string | null },
): Promise<void> {
  // training_plans share columns land with 7d migration; cast until db types regenerate.
  const { error } = await db().from(table).update(patch as never).eq('id', id);
  if (error) throw error;
}

export async function enableEntityShare(kind: EntityShareKind, id: string, currentToken: string | null): Promise<string> {
  const token = currentToken ?? Crypto.randomUUID();
  await setShare(tableFor(kind), id, {
    is_shared: true,
    share_token: token,
  });
  return buildShareUrl(kind, token);
}

export async function disableEntityShare(kind: EntityShareKind, id: string): Promise<null> {
  await setShare(tableFor(kind), id, {
    is_shared: false,
    share_token: null,
  });
  return null;
}

export async function resetEntityShare(kind: EntityShareKind, id: string): Promise<string> {
  const token = Crypto.randomUUID();
  await setShare(tableFor(kind), id, {
    is_shared: true,
    share_token: token,
  });
  return buildShareUrl(kind, token);
}

export function sharePreview(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
}
