import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export type ShareKind = 'list' | 'workout' | 'watchlist';

export function buildShareUrl(kind: ShareKind, token: string): string {
  const path = `/share/${kind}/${encodeURIComponent(token.trim())}`;
  const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  if (webBase) {
    return `${webBase}${path}`;
  }
  return Linking.createURL(path);
}

export function buildWishlistShareUrl(token: string): string {
  return buildShareUrl('list', token);
}
