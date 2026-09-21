import type { FetchPublicHtmlOptions } from '../../scrape/index.js';
import { decodeEntities, fetchPublicHtml } from '../../scrape/index.js';
import { extractJsonObject, fetchOembedJson, type VideoMetadata } from './shared.js';

export async function fetchYoutubeMetadata(
  canonicalWatchUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<VideoMetadata | null> {
  const oembed = await fetchOembedJson(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalWatchUrl)}`,
    options,
  );
  const page = await fetchWatchPage(canonicalWatchUrl, options);
  const captions = page?.captionUrl ? await fetchCaptionTrack(page.captionUrl, options) : undefined;
  const title = page?.title || oembed?.title;
  const description = page?.description;
  if (!title && !description && !captions) return null;

  return {
    title: title ?? 'YouTube video',
    description,
    authorName: oembed?.author_name ?? page?.authorName,
    thumbnailUrl: oembed?.thumbnail_url ?? page?.thumbnailUrl,
    captions,
    siteName: 'YouTube',
    hasCaptions: Boolean(captions && captions.length > 40),
  };
}

async function fetchWatchPage(watchUrl: string, options: FetchPublicHtmlOptions) {
  try {
    const response = await fetchPublicHtml(watchUrl, options);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 2_000_000);
    const player = extractJsonObject(html, 'ytInitialPlayerResponse');
    const details = asRecord(player?.videoDetails);
    const micro = asRecord(asRecord(player?.microformat)?.playerMicroformatRenderer);
    const captionUrl = pickCaptionUrl(player);
    const description =
      asString(details?.shortDescription) ||
      asString(asRecord(micro?.description)?.simpleText) ||
      asString(micro?.description);
    return {
      title: asString(details?.title),
      description: description?.trim() || undefined,
      authorName: asString(details?.author),
      thumbnailUrl: thumbnailFromDetails(details),
      captionUrl,
    };
  } catch {
    return null;
  }
}

function pickCaptionUrl(player: Record<string, unknown> | null): string | undefined {
  const captions = asRecord(player?.captions);
  const list = asRecord(captions?.playerCaptionsTracklistRenderer);
  const tracks = Array.isArray(list?.captionTracks) ? list.captionTracks : [];
  const preferred =
    tracks.find((track) => asString(asRecord(track)?.languageCode)?.toLowerCase().startsWith('en')) ?? tracks[0];
  const baseUrl = asString(asRecord(preferred)?.baseUrl);
  if (!baseUrl) return undefined;
  try {
    const parsed = new URL(baseUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
    if (!parsed.hostname.endsWith('youtube.com')) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

async function fetchCaptionTrack(captionUrl: string, options: FetchPublicHtmlOptions): Promise<string | undefined> {
  try {
    const response = await fetchPublicHtml(captionUrl, { ...options, timeoutMs: 8_000 });
    if (!response.ok) return undefined;
    const xml = await response.text();
    const text = decodeEntities(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    return text.slice(0, 100_000) || undefined;
  } catch {
    return undefined;
  }
}

function thumbnailFromDetails(details: Record<string, unknown> | null): string | undefined {
  const thumbs = asRecord(details?.thumbnail);
  const list = Array.isArray(thumbs?.thumbnails) ? thumbs.thumbnails : [];
  const last = list[list.length - 1];
  return asString(asRecord(last)?.url);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
