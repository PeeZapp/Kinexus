import AsyncStorage from '@react-native-async-storage/async-storage';

function key(sessionId: string) {
  return `train.sessionFocus.${sessionId}`;
}

export async function loadSessionFocusSetId(sessionId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(sessionId));
  } catch {
    return null;
  }
}

export async function saveSessionFocusSetId(sessionId: string, setId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(sessionId), setId);
  } catch {
    // ignore storage failures
  }
}

export async function clearSessionFocusSetId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(sessionId));
  } catch {
    // ignore storage failures
  }
}
