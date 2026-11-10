import { createPlatformAiClient } from './registry.js';

export type AiProvider = 'anthropic' | 'deepseek' | 'openai' | 'gemini' | 'perplexity';

export type AiCompleteInput = {
  system?: string;
  prompt: string;
  json?: boolean;
  webSearch?: boolean;
  maxTokens?: number;
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
