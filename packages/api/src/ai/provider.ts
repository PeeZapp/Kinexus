import { AnthropicClient } from './anthropic.js';
import { DeepSeekClient } from './deepseek.js';

export type AiProvider = 'anthropic' | 'deepseek';

export type AiCompleteInput = {
  system?: string;
  prompt: string;
  json?: boolean;
};

export interface AiClient {
  readonly provider: AiProvider;
  complete(input: AiCompleteInput): Promise<string>;
}

export function createAiClient(provider?: AiProvider): AiClient {
  const id = provider ?? (process.env.AI_PROVIDER === 'deepseek' ? 'deepseek' : 'anthropic');
  return id === 'deepseek' ? new DeepSeekClient() : new AnthropicClient();
}
