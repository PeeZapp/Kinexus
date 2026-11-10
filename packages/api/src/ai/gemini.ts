import type { AiClient, AiClientOptions, AiCompleteInput, AiProvider } from './provider.js';

export class GeminiClient implements AiClient {
  readonly provider: AiProvider = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts: AiClientOptions) {
    this.apiKey = opts.apiKey.trim();
    this.model = opts.model.trim();
    this.baseUrl = (opts.baseUrl?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Gemini API key is not set');
  }

  async complete(input: AiCompleteInput): Promise<string> {
    const system = input.json
      ? `${input.system ?? 'You are a helpful assistant.'}\nAlways respond with valid JSON only — no markdown, no code fences.`
      : (input.system ?? 'You are a helpful assistant.');

    const url =
      `${this.baseUrl}/v1beta/models/${encodeURIComponent(this.model)}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const images = input.images ?? [];
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    for (const image of images) {
      parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
    }

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: input.maxTokens ?? 4096,
        ...(input.json ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${err.slice(0, 400)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('\n')
      .trim();
  }
}
