/**
 * TODO(Phase 5): implement Anthropic and DeepSeek behind this interface.
 * Select the default with AI_PROVIDER=anthropic|deepseek.
 */

export type AiProvider = 'anthropic' | 'deepseek';

export interface AiClient {
  complete(input: { system?: string; prompt: string; json?: boolean }): Promise<string>;
}

export function createAiClient(_provider: AiProvider = 'anthropic'): AiClient {
  return {
    async complete() {
      throw new Error('TODO(Phase 5): AI providers are not implemented yet.');
    },
  };
}
