import type { AiClient, AiCompleteInput, AiProvider } from './provider.js';

export class DeepSeekClient implements AiClient {
  readonly provider: AiProvider = 'deepseek';

  async complete(input: AiCompleteInput): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/$/, '');
    const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');

    const messages: Array<{ role: string; content: string }> = [];
    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : input.system;
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: input.prompt });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
