import type { AiClient, AiClientOptions, AiCompleteInput, AiProvider } from './provider.js';

export class AnthropicClient implements AiClient {
  readonly provider: AiProvider = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts: AiClientOptions) {
    this.apiKey = opts.apiKey.trim();
    this.model = opts.model.trim();
    this.baseUrl = (opts.baseUrl?.trim() || 'https://api.anthropic.com').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Anthropic API key is not set');
  }

  async complete(input: AiCompleteInput): Promise<string> {
    try {
      return await this.completeOnce(input);
    } catch (err) {
      if (input.webSearch) return this.completeOnce({ ...input, webSearch: false });
      throw err;
    }
  }

  private async completeOnce(input: AiCompleteInput): Promise<string> {
    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : (input.system ?? 'You are a helpful assistant.');

    const images = input.images ?? [];
    const userContent =
      images.length === 0
        ? input.prompt
        : [
            ...images.map((image) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: image.mime,
                data: image.base64,
              },
            })),
            { type: 'text' as const, text: input.prompt },
          ];

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: input.maxTokens ?? (input.webSearch ? 8192 : 4096),
      system,
      messages: [{ role: 'user', content: userContent }],
    };
    if (input.webSearch) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    return (data.content ?? [])
      .filter((block) => block.type === 'text' || Boolean(block.text))
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();
  }
}
