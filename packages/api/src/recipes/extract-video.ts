import type { RecipeSourceKind } from '@kinexus/domain';

import type { FetchPublicHtmlOptions } from '../scrape/index.js';
import { fetchFacebookMetadata } from './adapters/facebook.js';
import { fetchInstagramMetadata } from './adapters/instagram.js';
import { fetchTiktokMetadata } from './adapters/tiktok.js';
import { fetchYoutubeMetadata } from './adapters/youtube.js';
import type { VideoMetadata } from './adapters/shared.js';
import { isRecipeTeaser } from './adapters/recipe-links.js';

export type { VideoMetadata } from './adapters/shared.js';

const MIN_TEXT = 40;

export async function fetchVideoMetadata(
  sourceKind: Exclude<RecipeSourceKind, 'web'>,
  canonicalUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<VideoMetadata | null> {
  if (sourceKind === 'youtube') return fetchYoutubeMetadata(canonicalUrl, options);
  if (sourceKind === 'tiktok') return fetchTiktokMetadata(canonicalUrl, options);
  if (sourceKind === 'facebook') return fetchFacebookMetadata(canonicalUrl, options);
  return fetchInstagramMetadata(canonicalUrl, options);
}

export function videoMetadataToText(meta: VideoMetadata): string {
  return [
    meta.title ? `Title: ${meta.title}` : '',
    meta.authorName ? `By ${meta.authorName}` : '',
    meta.description ? `Description:\n${meta.description}` : '',
    meta.captions && meta.captions !== meta.description ? `Captions:\n${meta.captions}` : '',
    meta.extraText && meta.extraText !== meta.description ? `Comments:\n${meta.extraText}` : '',
    meta.linkedUrls?.length ? `Linked recipe URLs:\n${meta.linkedUrls.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Enough public text to try LLM structuring. A dish-name teaser is not a recipe. */
export function videoTextIsUsable(meta: VideoMetadata, _text: string): boolean {
  const body = uniqueVideoBody(meta);
  const teaser = isRecipeTeaser(meta.description) || isRecipeTeaser(meta.captions) || isRecipeTeaser(meta.title);
  if (teaser && !hasRecipeAmounts(body)) return false;
  return body.length >= MIN_TEXT || hasRecipeAmounts(body);
}

function hasRecipeAmounts(text: string): boolean {
  return text.length >= 25 && /\d/.test(text);
}

function uniqueVideoBody(meta: VideoMetadata): string {
  const parts = [meta.description, meta.captions, meta.extraText, meta.title]
    .map((part) => part?.replace(/\s+/g, ' ').trim())
    .filter((part): part is string => Boolean(part));
  const unique: string[] = [];
  for (const part of parts) {
    if (unique.some((existing) => existing === part || existing.includes(part))) continue;
    const covered = unique.findIndex((existing) => part.includes(existing));
    if (covered >= 0) unique.splice(covered, 1);
    unique.push(part);
  }
  return unique.join('\n');
}
