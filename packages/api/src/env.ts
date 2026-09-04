export type AiProvider = 'anthropic' | 'deepseek';

export function aiProvider(): AiProvider {
  return process.env.AI_PROVIDER === 'deepseek' ? 'deepseek' : 'anthropic';
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5300';
  const list = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  for (const host of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    if (!host) continue;
    const origin = host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
    list.push(origin);
  }
  const web = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (web) list.push(web);
  return Array.from(new Set(list));
}
