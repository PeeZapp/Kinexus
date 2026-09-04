import { Platform } from 'react-native';

export function parseInviteToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const fromPath = trimmed.match(/\/invite\/([A-Za-z0-9_-]+)/);
  if (fromPath?.[1]) return fromPath[1];

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const inviteIdx = parts.lastIndexOf('invite');
    const token = inviteIdx >= 0 ? parts[inviteIdx + 1] : undefined;
    if (token) return token;
  } catch {
    // Not a URL — treat the whole string as the token.
  }

  return trimmed;
}

export function buildInviteUrl(token: string): string {
  const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/invite/${token}`;
  }
  if (webBase) {
    return `${webBase}/invite/${token}`;
  }
  return `kinexus://invite/${token}`;
}
