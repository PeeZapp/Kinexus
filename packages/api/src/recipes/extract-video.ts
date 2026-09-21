import type { RecipeSourceKind } from '@kinexus/domain';

import type { FetchPublicHtmlOptions } from '../scrape/index.js';
import { fetchFacebookMetadata } from './adapters/facebook.js';
import { fetchInstagramMetadata } from './adapters/instagram.js';
import { fetchTiktokMetadata } from './adapters/tiktok.js';
import { fetchYoutubeMetadata } from './adapters/youtube.js';
import type { VideoMetadata } from './adapters/shared.js';

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

/** Enough public text to try LLM structuring. Title-only is not enough (do not invent). */
export function videoTextIsUsable(meta: VideoMetadata, text: string): boolean {
  if (meta.linkedUrls?.length) return true;
  const body = [meta.description, meta.captions, meta.extraText].filter(Boolean).join('\n');
  return body.trim().length >= MIN_TEXT || text.trim().length >= MIN_TEXT + 20;
}
