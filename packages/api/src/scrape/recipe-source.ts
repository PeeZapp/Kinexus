import { normalizeRecipeUrl, RecipeUrlError } from '@kinexus/domain';

import { fetchVideoMetadata, videoMetadataToText, videoTextIsUsable } from '../recipes/extract-video.js';
import { scrapeRecipeUrl, type FetchPublicHtmlOptions, type ScrapeResult } from './index.js';

/**
 * Household recipe import reads `/scrape`. Social video pages are not recipe HTML:
 * use the public caption, comments, and auto-generated speech track instead.
 */
export async function scrapeRecipeSource(url: string, options: FetchPublicHtmlOptions = {}): Promise<ScrapeResult> {
  const social = await scrapeSocialVideo(url, options);
  if (social) return social;
  return scrapeRecipeUrl(url, options);
}

async function scrapeSocialVideo(url: string, options: FetchPublicHtmlOptions): Promise<ScrapeResult | null> {
  let normalized;
  try {
    normalized = normalizeRecipeUrl(url);
  } catch (err) {
    if (err instanceof RecipeUrlError) return null;
    throw err;
  }
  if (normalized.sourceKind === 'web') return null;

  const meta = await fetchVideoMetadata(normalized.sourceKind, normalized.canonicalUrl, options);
  if (!meta) return { source: 'blocked', blocked: true };
  const content = videoMetadataToText(meta).slice(0, 20_000);
  if (!videoTextIsUsable(meta, content)) return { source: 'blocked', blocked: true };
  return { source: 'text', content };
}
