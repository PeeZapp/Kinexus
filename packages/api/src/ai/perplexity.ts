import type { AiClient, AiClientOptions, AiCompleteInput, AiProvider } from './provider.js';

export class PerplexityClient implements AiClient {
  readonly provider: AiProvider = 'perplexity';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts: AiClientOptions) {
    this.apiKey = opts.apiKey.trim();
    this.model = opts.model.trim();
    this.baseUrl = (opts.baseUrl?.trim() || 'https://api.perplexity.ai').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Perplexity API key is not set');
  }

  async complete(input: AiCompleteInput): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : input.system;
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: input.prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : { max_tokens: 4096 }),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Perplexity request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
