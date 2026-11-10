import { createPlatformAiClient } from './registry.js';

export type AiProvider = 'anthropic' | 'deepseek' | 'openai' | 'gemini' | 'perplexity';

export type AiImageInput = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
};

export type AiCompleteInput = {
  system?: string;
  prompt: string;
  json?: boolean;
  webSearch?: boolean;
  maxTokens?: number;
  /** Optional images for vision-capable providers. */
  images?: AiImageInput[];
};

export type AiClientOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export interface AiClient {
  readonly provider: AiProvider;
  complete(input: AiCompleteInput): Promise<string>;
}

export { createPlatformAiClient } from './registry.js';

/** Platform env-key client. Household keys are not used here (17b). */
export function createAiClient(provider?: AiProvider): AiClient {
  return createPlatformAiClient(provider);
}
