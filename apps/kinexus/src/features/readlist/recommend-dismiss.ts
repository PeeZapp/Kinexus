import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(userId: string): string {
  return `readlist:dismissed-recs:${userId}`;
}

export async function loadDismissedRecommendations(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  } catch {
    return [];
  }
}

export async function dismissRecommendation(userId: string, workId: string): Promise<string[]> {
  const next = [...new Set([...(await loadDismissedRecommendations(userId)), workId])];
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}
