const KEYISH =
  /\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|pplx-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,})\b/g;

const AUTH_HEADER = /(authorization|x-api-key)\s*[:=]\s*["']?Bearer\s+[^"'\s,;}]+["']?/gi;
const AUTH_HEADER_BARE = /(authorization|x-api-key)\s*[:=]\s*["']?[^"'\s,;}]+["']?/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._\-+=/]+/gi;

/** Redact API keys and auth headers. Keeps at most last4 of any key-shaped token. */
export function scrubSecrets(value: string): string {
  let out = value.replace(KEYISH, (match) => `••••${match.slice(-4)}`);
  out = out.replace(AUTH_HEADER, '$1: [redacted]');
  out = out.replace(AUTH_HEADER_BARE, '$1: [redacted]');
  out = out.replace(BEARER, 'Bearer [redacted]');
  return out;
}

export function scrubUnknown(value: unknown): unknown {
  if (typeof value === 'string') return scrubSecrets(value);
  if (Array.isArray(value)) return value.map(scrubUnknown);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (key === 'authorization' || key === 'x-api-key' || key === 'apikey' || key === 'key') {
        out[k] = typeof v === 'string' && v.length > 4 ? `••••${v.slice(-4)}` : '[redacted]';
      } else {
        out[k] = scrubUnknown(v);
      }
    }
    return out;
  }
  return value;
}

export function scrubErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return scrubSecrets(raw);
}
