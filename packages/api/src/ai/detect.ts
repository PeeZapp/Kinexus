import { AI_PROVIDERS, isAiProvider, type ProviderDefinition } from './registry.js';
import type { AiProvider } from './provider.js';

export type DetectResult =
  | { provider: AiProvider; needsProvider: false }
  | { provider: null; needsProvider: false } // ambiguous sk- — validate openai then deepseek
  | { provider: null; needsProvider: true };

export type ResolveKeyResult =
  | { ok: true; provider: AiProvider }
  | { ok: false; needsProvider: true }
  | { ok: false; error: string };

function last4(key: string): string {
  const trimmed = key.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

export function keyLast4(key: string): string {
  return last4(key);
}

/** Prefix detection only. Ambiguous `sk-` returns needsProvider=false with provider null via resolve. */
export function detectProviderFromKey(key: string): DetectResult {
  const trimmed = key.trim();
  if (!trimmed) return { provider: null, needsProvider: true };
  if (trimmed.startsWith('sk-ant-')) return { provider: 'anthropic', needsProvider: false };
  if (trimmed.startsWith('pplx-')) return { provider: 'perplexity', needsProvider: false };
  if (trimmed.startsWith('AIza')) return { provider: 'gemini', needsProvider: false };
  if (trimmed.startsWith('sk-')) {
    // Ambiguous OpenAI vs DeepSeek — resolved by validate order in resolveHouseholdAiKey.
    return { provider: null, needsProvider: false };
  }
  return { provider: null, needsProvider: true };
}

export async function resolveHouseholdAiKey(opts: {
  key: string;
  provider?: unknown;
}): Promise<ResolveKeyResult> {
  const key = opts.key.trim();
  if (!key) return { ok: false, error: 'Paste an API key.' };

  if (opts.provider != null && opts.provider !== '') {
    if (!isAiProvider(opts.provider)) return { ok: false, error: 'Unknown AI provider.' };
    try {
      await AI_PROVIDERS[opts.provider].validate(key);
      return { ok: true, provider: opts.provider };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'That key could not be validated.' };
    }
  }

  const detected = detectProviderFromKey(key);
  if (detected.needsProvider) return { ok: false, needsProvider: true };

  if (detected.provider) {
    try {
      await AI_PROVIDERS[detected.provider].validate(key);
      return { ok: true, provider: detected.provider };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'That key could not be validated.' };
    }
  }

  // Ambiguous sk-: try OpenAI then DeepSeek.
  for (const id of ['openai', 'deepseek'] as const) {
    try {
      await AI_PROVIDERS[id].validate(key);
      return { ok: true, provider: id };
    } catch {
      // try next
    }
  }
  return { ok: false, error: 'That key could not be validated with OpenAI or DeepSeek.' };
}

export function providerLabel(id: AiProvider): string {
  return (AI_PROVIDERS[id] as ProviderDefinition | undefined)?.label ?? id;
}
