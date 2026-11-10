import { isCompleteCleanRecipe, methodBlocksToStrings, normalizeRecipeUrl, RecipeUrlError } from '@kinexus/domain';

import { dishNameFromCaption } from '../recipes/adapters/recipe-links.js';
import { extractJsonLdRecipe } from '../recipes/extract-jsonld.js';
import { extractMicrodataRecipe } from '../recipes/extract-microdata.js';
import { extractProvechoRecipe } from '../recipes/extract-provecho.js';
import { fetchVideoMetadata, videoMetadataToText, videoTextIsUsable } from '../recipes/extract-video.js';
import { collectRecipeImageCandidates } from '../recipes/image-candidates.js';
import type { ExtractedRecipeCore } from '../recipes/parse.js';
import type { RecipeDraft } from '../recipe-draft.js';
import { fetchPublicHtml, scrapeRecipeUrl, type FetchPublicHtmlOptions, type ScrapeResult } from './index.js';

/**
 * Household recipe import reads `/scrape`. Social video pages are not recipe HTML:
 * use the public caption, comments, and auto-generated speech track instead.
 */
export async function scrapeRecipeSource(url: string, options: FetchPublicHtmlOptions = {}): Promise<ScrapeResult> {
  const social = await scrapeSocialVideo(url, options);
  if (social) {
    return withScrapeCoverCandidates(social.result, options, social.youtubeVideoId);
  }
  return withScrapeCoverCandidates(await scrapeRecipeUrl(url, options), options);
}

async function withScrapeCoverCandidates(
  result: ScrapeResult,
  options: FetchPublicHtmlOptions,
  youtubeVideoId?: string,
): Promise<ScrapeResult> {
  if (result.source === 'blocked' || result.source === 'not-found') return result;
  const seed = result.source === 'json-ld' ? result.recipe.imageUrl : result.imageUrl;
  const collected = await collectRecipeImageCandidates({
    youtubeVideoId,
    seedUrls: [seed],
    options,
  });
  const imageCandidates = collected.imageCandidates.length
    ? collected.imageCandidates
    : seed
      ? [seed]
      : undefined;
  const imageUrl = collected.imageUrl ?? imageCandidates?.[0] ?? seed;
  if (result.source === 'json-ld') {
    return {
      source: 'json-ld',
      recipe: { ...result.recipe, imageUrl, imageCandidates },
    };
  }
  return { source: 'text', content: result.content, imageUrl, imageCandidates };
}

async function scrapeSocialVideo(
  url: string,
  options: FetchPublicHtmlOptions,
): Promise<{ result: ScrapeResult; youtubeVideoId?: string } | null> {
  let normalized;
  try {
    normalized = normalizeRecipeUrl(url);
  } catch (err) {
    if (err instanceof RecipeUrlError) return null;
    throw err;
  }
  if (normalized.sourceKind === 'web') return null;

  const youtubeVideoId = normalized.sourceKind === 'youtube' ? normalized.videoId : undefined;
  const meta = await fetchVideoMetadata(normalized.sourceKind, normalized.canonicalUrl, options);
  if (!meta) {
    return {
      result: { source: 'not-found', url: normalized.canonicalUrl, recipeUrl: normalized.canonicalUrl },
      youtubeVideoId,
    };
  }
  const linked = await recipeFromLinkedPages(meta.linkedUrls, options);
  if (linked) {
    return {
      result: { source: 'json-ld', recipe: { ...linked, imageUrl: linked.imageUrl ?? meta.thumbnailUrl } },
      youtubeVideoId,
    };
  }
  const content = videoMetadataToText(meta).slice(0, 20_000);
  if (!videoTextIsUsable(meta, content)) {
    return {
      result: {
        source: 'not-found',
        url: normalized.canonicalUrl,
        recipeUrl: meta.linkedUrls?.[0] ?? normalized.canonicalUrl,
        dishName: dishNameFromCaption(meta.title) ?? dishNameFromCaption(meta.description),
      },
      youtubeVideoId,
    };
  }
  return {
    result: { source: 'text', content, imageUrl: meta.thumbnailUrl },
    youtubeVideoId,
  };
}

async function recipeFromLinkedPages(
  urls: string[] | undefined,
  options: FetchPublicHtmlOptions,
): Promise<RecipeDraft | null> {
  for (const raw of (urls ?? []).slice(0, 2)) {
    try {
      const response = await fetchPublicHtml(raw, options);
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 2_000_000);
      const core =
        extractProvechoRecipe(html) ?? extractJsonLdRecipe(html) ?? extractMicrodataRecipe(html);
      if (core && isCompleteCleanRecipe(core)) return coreToDraft(core);
    } catch {
      // skip a blocked or dead link and try the next one
    }
  }
  return null;
}

function coreToDraft(core: ExtractedRecipeCore): RecipeDraft {
  return {
    name: core.title,
    cuisine: core.cuisine,
    cookTime: core.cookTimeMinutes,
    servings: core.originalServings,
    vegetarian: core.vegetarian,
    ingredients: core.ingredients.map((line) => ({
      name: line.name,
      amount: line.quantity?.raw,
    })),
    method: methodBlocksToStrings(core.method),
    chefTip: core.chefTip,
    mealSlots: ['dinner'],
    imageUrl: core.imageUrl,
  };
}
