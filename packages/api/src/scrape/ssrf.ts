export class SsrfError extends Error {
  constructor(message = 'That URL is not allowed') {
    super(message);
    this.name = 'SsrfError';
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('A valid http/https URL is required');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('A valid http/https URL is required');
  }
  if (parsed.username || parsed.password) {
    throw new SsrfError();
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new SsrfError();
  }
  return parsed;
}

export function isIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (/^\d+$/.test(host)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(':');
}

export function isPrivateIp(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return isPrivateIpv4(v4);
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  if (host === '0.0.0.0' || host === '255.255.255.255') return true;
  if (host.endsWith('.internal') || host === 'metadata.google.internal') return true;
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (Number.isFinite(n) && n >= 0) {
      const a = (n >>> 24) & 255;
      const b = (n >>> 16) & 255;
      const c = (n >>> 8) & 255;
      const d = n & 255;
      return isPrivateIpv4(`${a}.${b}.${c}.${d}`);
    }
  }
  return isPrivateIpv4(host);
}

function isPrivateIpv4(host: string): boolean {
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (host === '0.0.0.0' || host === '255.255.255.255') return true;
  return false;
}

export type HostnameLookup = (hostname: string) => Promise<string[]>;

export async function defaultHostnameLookup(hostname: string): Promise<string[]> {
  const dns = await import('node:dns/promises');
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((row) => row.address);
}

export async function assertResolvedPublicHost(
  hostname: string,
  lookup: HostnameLookup = defaultHostnameLookup,
): Promise<void> {
  if (isPrivateHost(hostname)) throw new SsrfError();
  if (isIpLiteral(hostname)) {
    if (isPrivateIp(hostname.replace(/^\[|\]$/g, ''))) throw new SsrfError();
    return;
  }
  let addresses: string[] = [];
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      addresses = await Promise.race([
        lookup(hostname),
        new Promise<string[]>((_, reject) => {
          setTimeout(() => reject(new Error('DNS timeout')), 5_000);
        }),
      ]);
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      if (err instanceof SsrfError) throw err;
    }
  }
  if (lastError || addresses.length === 0) {
    throw new SsrfError('That URL is not allowed');
  }
  for (const address of addresses) {
    if (isPrivateIp(address) || isPrivateHost(address)) throw new SsrfError();
  }
}
