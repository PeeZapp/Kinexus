import { Platform } from 'react-native';

export function buildWishlistShareUrl(token: string): string {
  const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/share/list/${token}`;
  }
  if (webBase) {
    return `${webBase}/share/list/${token}`;
  }
  return `kinexus://share/list/${token}`;
}
