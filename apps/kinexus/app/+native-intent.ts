import { getShareExtensionKey } from 'expo-share-intent';

/** Expo Router entry for OS share intents (iOS Share Extension / Android SEND). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/shareintent';
    }
    return path;
  } catch {
    return '/';
  }
}
