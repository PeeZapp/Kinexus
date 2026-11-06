import { Platform } from 'react-native';

export type ShareKind = 'list' | 'workout' | 'watchlist';

export function buildShareUrl(kind: ShareKind, token: string): string {
  const path = `/share/${kind}/${token}`;
  const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  if (webBase) {
    return `${webBase}${path}`;
  }
  return `kinexus:/${path}`;
}

export function buildWishlistShareUrl(token: string): string {
  return buildShareUrl('list', token);
}
