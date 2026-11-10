import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShareTarget } from '@kinexus/domain';
import { isListShareTarget } from '@kinexus/domain';

export type ShareListKind = 'watchlist' | 'readlist' | 'wishlist';

export type LastUsedShareList = {
  id: string;
  name: string;
};

const PREFIX = 'kinexus:share-target:last-list:';

function key(kind: ShareListKind): string {
  return `${PREFIX}${kind}`;
}

export async function readLastUsedShareList(kind: ShareListKind): Promise<LastUsedShareList | null> {
  try {
    const raw = await AsyncStorage.getItem(key(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastUsedShareList>;
    if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') return null;
    if (!parsed.id.trim() || !parsed.name.trim()) return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

export async function writeLastUsedShareList(kind: ShareListKind, list: LastUsedShareList): Promise<void> {
  await AsyncStorage.setItem(key(kind), JSON.stringify(list));
}

export function shareListKind(target: ShareTarget): ShareListKind | null {
  return isListShareTarget(target) ? target : null;
}

export function resolveLastUsedList(
  lists: readonly LastUsedShareList[],
  preferred: LastUsedShareList | null,
): LastUsedShareList | null {
  if (lists.length === 0) return null;
  if (preferred) {
    const match = lists.find((list) => list.id === preferred.id);
    if (match) return match;
  }
  return lists[0] ?? null;
}
