import type { AiClient, AiCompleteInput, AiProvider } from './provider.js';

export class AnthropicClient implements AiClient {
  readonly provider: AiProvider = 'anthropic';

  async complete(input: AiCompleteInput): Promise<string> {
    try {
      return await this.completeOnce(input);
    } catch (err) {
      if (input.webSearch) return this.completeOnce({ ...input, webSearch: false });
      throw err;
    }
  }

  private async completeOnce(input: AiCompleteInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    const baseUrl = (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/$/, '');
    const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : (input.system ?? 'You are a helpful assistant.');

    const body: Record<string, unknown> = {
      model,
      max_tokens: input.maxTokens ?? (input.webSearch ? 8192 : 4096),
      system,
      messages: [{ role: 'user', content: input.prompt }],
    };
    if (input.webSearch) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];
    }

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
