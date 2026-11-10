import { AnthropicClient } from './anthropic.js';
import { DeepSeekClient } from './deepseek.js';
import { GeminiClient } from './gemini.js';
import { OpenAiClient } from './openai.js';
import { PerplexityClient } from './perplexity.js';
import type { AiClient, AiClientOptions, AiProvider } from './provider.js';

export type ProviderDefinition = {
  id: AiProvider;
  label: string;
  baseUrl: string;
  defaultModel: string;
  supportsWebSearch: boolean;
  supportsJsonMode: boolean;
  validate: (apiKey: string) => Promise<void>;
  createClient: (opts: AiClientOptions) => AiClient;
};

async function assertOk(response: Response, label: string): Promise<void> {
  if (response.ok) return;
  const err = await response.text();
  throw new Error(`${label} key check failed (${response.status}): ${err.slice(0, 200)}`);
}

async function validateAnthropic(apiKey: string): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  await assertOk(response, 'Anthropic');
}

async function validateOpenAiCompatible(
  label: string,
  baseUrl: string,
  apiKey: string,
): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await assertOk(response, label);
}

async function validateGemini(apiKey: string): Promise<void> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`,
  );
  await assertOk(response, 'Gemini');
}

async function validatePerplexity(apiKey: string): Promise<void> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  await assertOk(response, 'Perplexity');
}

export const AI_PROVIDERS: Record<AiProvider, ProviderDefinition> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5',
    supportsWebSearch: true,
    supportsJsonMode: false,
    validate: validateAnthropic,
    createClient: (opts) => new AnthropicClient(opts),
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    supportsWebSearch: false,
    supportsJsonMode: true,
    validate: (apiKey) => validateOpenAiCompatible('DeepSeek', 'https://api.deepseek.com', apiKey),
    createClient: (opts) => new DeepSeekClient(opts),
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    supportsWebSearch: false,
    supportsJsonMode: true,
    validate: (apiKey) => validateOpenAiCompatible('OpenAI', 'https://api.openai.com', apiKey),
    createClient: (opts) => new OpenAiClient(opts),
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    supportsWebSearch: false,
    supportsJsonMode: true,
    validate: validateGemini,
    createClient: (opts) => new GeminiClient(opts),
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    supportsWebSearch: true,
    supportsJsonMode: false,
    validate: validatePerplexity,
    createClient: (opts) => new PerplexityClient(opts),
  },
};

export function providerDefinition(id: AiProvider): ProviderDefinition {
  const def = AI_PROVIDERS[id];
  if (!def) throw new Error(`Unknown AI provider: ${id}`);
  return def;
}

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && value in AI_PROVIDERS;
}

export function createAiClientFromKey(provider: AiProvider, apiKey: string, model?: string): AiClient {
  const def = providerDefinition(provider);
  return def.createClient({
    apiKey,
    model: model?.trim() || def.defaultModel,
    baseUrl: def.baseUrl,
  });
}

/** Platform factory: uses env keys so current server behaviour is unchanged. */
export function createPlatformAiClient(provider?: AiProvider): AiClient {
  const id =
    provider ??
    (process.env.AI_PROVIDER === 'deepseek'
      ? 'deepseek'
      : process.env.AI_PROVIDER === 'openai'
        ? 'openai'
        : process.env.AI_PROVIDER === 'gemini'
          ? 'gemini'
          : process.env.AI_PROVIDER === 'perplexity'
            ? 'perplexity'
            : 'anthropic');

  if (id === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
    const model = process.env.DEEPSEEK_MODEL?.trim() || AI_PROVIDERS.deepseek.defaultModel;
    const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || AI_PROVIDERS.deepseek.baseUrl;
    return new DeepSeekClient({ apiKey, model, baseUrl });
  }
  if (id === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    const model = process.env.OPENAI_MODEL?.trim() || AI_PROVIDERS.openai.defaultModel;
    const baseUrl = process.env.OPENAI_BASE_URL?.trim() || AI_PROVIDERS.openai.baseUrl;
    return new OpenAiClient({ apiKey, model, baseUrl });
  }
  if (id === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
    const model = process.env.GEMINI_MODEL?.trim() || AI_PROVIDERS.gemini.defaultModel;
    const baseUrl = process.env.GEMINI_BASE_URL?.trim() || AI_PROVIDERS.gemini.baseUrl;
    return new GeminiClient({ apiKey, model, baseUrl });
  }
  if (id === 'perplexity') {
    const apiKey = process.env.PERPLEXITY_API_KEY?.trim() ?? '';
    const model = process.env.PERPLEXITY_MODEL?.trim() || AI_PROVIDERS.perplexity.defaultModel;
    const baseUrl = process.env.PERPLEXITY_BASE_URL?.trim() || AI_PROVIDERS.perplexity.baseUrl;
    return new PerplexityClient({ apiKey, model, baseUrl });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  const model = process.env.ANTHROPIC_MODEL?.trim() || AI_PROVIDERS.anthropic.defaultModel;
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || AI_PROVIDERS.anthropic.baseUrl;
  return new AnthropicClient({ apiKey, model, baseUrl });
}
