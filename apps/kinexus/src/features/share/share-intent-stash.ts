import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShareIntentPayload } from '@/src/features/share/share-intent-route';

const KEY = 'kinexus:share-intent:pending';

export async function stashShareIntentPayload(payload: ShareIntentPayload): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function takeStashedShareIntentPayload(): Promise<ShareIntentPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    await AsyncStorage.removeItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShareIntentPayload;
  } catch {
    return null;
  }
}
