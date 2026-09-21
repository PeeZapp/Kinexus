import type { FetchPublicHtmlOptions } from '../../scrape/index.js';
import { fetchOgTags, type VideoMetadata } from './shared.js';

export async function fetchInstagramMetadata(
  canonicalUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<VideoMetadata | null> {
  const page = await fetchOgTags(canonicalUrl, options);
  if (!page) return null;
  const caption = page.description || page.title;
  return {
    title: page.title ?? 'Instagram video',
    description: page.description,
    thumbnailUrl: page.image,
    captions: caption,
    siteName: page.siteName ?? 'Instagram',
    hasCaptions: Boolean(caption && caption.length > 40),
  };
}
