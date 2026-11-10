import type { AiClient, AiClientOptions, AiCompleteInput, AiProvider } from './provider.js';

export class OpenAiClient implements AiClient {
  readonly provider: AiProvider = 'openai';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts: AiClientOptions) {
    this.apiKey = opts.apiKey.trim();
    this.model = opts.model.trim();
    this.baseUrl = (opts.baseUrl?.trim() || 'https://api.openai.com').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('OpenAI API key is not set');
  }

  async complete(input: AiCompleteInput): Promise<string> {
    const messages: Array<{ role: string; content: unknown }> = [];
    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : input.system;
    if (system) messages.push({ role: 'system', content: system });
    const images = input.images ?? [];
    const userContent =
      images.length === 0
        ? input.prompt
        : [
            { type: 'text', text: input.prompt },
            ...images.map((image) => ({
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` },
            })),
          ];
    messages.push({ role: 'user', content: userContent });

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : { max_tokens: 4096 }),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
