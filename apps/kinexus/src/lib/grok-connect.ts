import { Linking, Platform } from 'react-native';

const GROK_BOT_APP = 'grokbot://';
const GROK_BOT_INSTALL = 'https://x.ai/bot';

function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && !host.endsWith('.local');
  } catch {
    return false;
  }
}

/** Prefer the API's public address, then the site the app is open on, then the store build's web URL. */
export function connectorAddress(serverUrl: string, token: string): string {
  let serverOrigin = '';
  try {
    serverOrigin = new URL(serverUrl).origin;
  } catch {
    serverOrigin = '';
  }
  const page = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
  const configured = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/$/, '');
  const site = [serverOrigin, page, configured].find((origin) => isPublicHttps(origin)) || serverOrigin || page || configured;
  const url = new URL('/mcp', site.endsWith('/') ? site : `${site}/`);
  url.searchParams.set('token', token);
  return url.toString();
}

export function connectorIsPublic(address: string): boolean {
  try {
    return isPublicHttps(new URL(address).origin);
  } catch {
    return false;
  }
}

export function grokBotConnectMessage(address: string): string {
  return `Add a custom MCP server called Kinexus at ${address} using streamable HTTP.`;
}

function openGrokBotWeb(): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = GROK_BOT_APP;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function openGrokBot(): Promise<void> {
  if (Platform.OS === 'web') {
    openGrokBotWeb();
    return;
  }
  try {
    if (await Linking.canOpenURL(GROK_BOT_APP)) {
      await Linking.openURL(GROK_BOT_APP);
      return;
    }
  } catch {
    // A store build lists the grokbot scheme so this check can succeed.
  }
  await Linking.openURL(GROK_BOT_INSTALL);
}
