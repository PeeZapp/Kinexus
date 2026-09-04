import type { AiClient, AiCompleteInput, AiProvider } from './provider';

export class AnthropicClient implements AiClient {
  readonly provider: AiProvider = 'anthropic';

  async complete(input: AiCompleteInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    const baseUrl = (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/$/, '');
    const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : (input.system ?? 'You are a helpful assistant.');

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
  }
}
