import { extractRecipeFromText, extractRecipeFromUrlHint } from './ai/extract';
import { createAiClient } from './ai/provider';
import { scrapeRecipeUrl } from './scrape/index';
import type { RecipeDraft } from './recipe-draft';

export type AiTask = 'extract_recipe' | 'extract_recipe_from_url';

export type AiRequestBody = {
  task?: string;
  content?: string;
  url?: string;
};

export type ScrapeRequestBody = {
  url?: string;
};

export async function handleScrape(body: ScrapeRequestBody) {
  const url = body.url?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: { error: 'A valid http/https URL is required' } };
  }
  try {
    const result = await scrapeRecipeUrl(url);
    return { status: 200 as const, body: result };
  } catch (err) {
    return scrapeError(err);
  }
}

export async function handleAi(body: AiRequestBody): Promise<{
  status: number;
  body: { recipe: RecipeDraft; provider: string } | { error: string };
}> {
  const task = body.task;
  if (task !== 'extract_recipe' && task !== 'extract_recipe_from_url') {
    return { status: 400, body: { error: 'task must be extract_recipe or extract_recipe_from_url' } };
  }

  try {
    const client = createAiClient();
    if (task === 'extract_recipe') {
      const content = body.content?.trim() ?? '';
      if (content.length < 20) return { status: 400, body: { error: 'Paste more of the recipe text' } };
      if (content.length > 20_000) return { status: 400, body: { error: 'Recipe text is too long' } };
      const recipe = await extractRecipeFromText(client, content);
      return { status: 200, body: { recipe, provider: client.provider } };
    }
    const url = body.url?.trim() ?? '';
    if (!url) return { status: 400, body: { error: 'url is required' } };
    const recipe = await extractRecipeFromUrlHint(client, url);
    return { status: 200, body: { recipe, provider: client.provider } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    if (message.includes('is not set')) return { status: 503, body: { error: 'AI provider is not configured' } };
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}

function scrapeError(err: unknown): { status: number; body: { error: string } } {
  const message = err instanceof Error ? err.message : 'Could not reach that URL';
  const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
  if (message.includes('timeout') || message.includes('abort') || message.includes('Timeout')) {
    return { status: 504, body: { error: 'The page took too long to load. Try pasting the recipe text instead.' } };
  }
  if (message.includes('not allowed') || message.includes('valid http')) {
    return { status: 400, body: { error: message } };
  }
  if (status === 422) return { status: 422, body: { error: message } };
  return { status: 500, body: { error: 'Could not reach that URL. Try pasting the recipe text instead.' } };
}
