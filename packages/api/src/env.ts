import type { AiProvider } from './ai/provider.js';

export type { AiProvider };

export function aiProvider(): AiProvider {
  return process.env.AI_PROVIDER === 'deepseek' ? 'deepseek' : 'anthropic';
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Browser origins that load /ai/mcp during connector setup (Claude + ChatGPT + Perplexity UIs). */
export const MCP_CONNECTOR_BROWSER_ORIGINS = [
  'https://claude.ai',
  'https://www.claude.ai',
  'https://chatgpt.com',
  'https://www.chatgpt.com',
  'https://chat.openai.com',
  'https://www.perplexity.ai',
  'https://perplexity.ai',
  'https://enterprise.perplexity.ai',
] as const;

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
  list.push(...MCP_CONNECTOR_BROWSER_ORIGINS);
  return Array.from(new Set(list));
}
