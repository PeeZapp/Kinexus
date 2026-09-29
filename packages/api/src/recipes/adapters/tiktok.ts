import type { FetchPublicHtmlOptions } from '../../scrape/index.js';
import {
  extractOutboundRecipeUrls,
  findCrosspostedRecipeUrl,
  findProvechoRecipeUrl,
  isRecipeTeaser,
} from './recipe-links.js';
import { extractJsonObject, fetchOembedJson, fetchOgTags, type VideoMetadata } from './shared.js';

export async function fetchTiktokMetadata(
  canonicalUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<VideoMetadata | null> {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;
  const oembed =
    (await fetchOembedJson(oembedUrl, options)) ??
    (await fetchOembedJson(oembedUrl, {
      ...options,
      headers: {
        Accept: 'application/json, text/javascript;q=0.9, */*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    }));

  const page =
    oembed?.title && oembed.title.trim().length >= 40 && !isRecipeTeaser(oembed.title)
      ? null
      : await fetchOgTags(canonicalUrl, options);
  const videoId = canonicalUrl.match(/\/video\/(\d+)/)?.[1] ?? '';
  const embedded = page?.html && !isChallengeHtml(page.html) ? parseTiktokEmbedded(page.html, videoId) : null;
  const description =
    embedded?.description ||
    (page && !isChallengeHtml(page.html) ? page.description : undefined) ||
    oembed?.title;
  const title = (
    embedded?.title ||
    (page && !isChallengeHtml(page.html) ? page.title : undefined) ||
    oembed?.title ||
    'TikTok video'
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (!description && !oembed && !embedded) return null;
  const linkedUrls = await recipeLinks(canonicalUrl, description, options);
  return {
    title,
    description,
    authorName: oembed?.author_name ?? embedded?.authorName,
    thumbnailUrl: oembed?.thumbnail_url || page?.image || embedded?.thumbnailUrl,
    captions: description,
    linkedUrls: linkedUrls.length ? linkedUrls : undefined,
    siteName: 'TikTok',
    hasCaptions: Boolean(description && description.length > 40 && !isRecipeTeaser(description)),
  };
}

async function recipeLinks(
  canonicalUrl: string,
  description: string | undefined,
  options: FetchPublicHtmlOptions,
): Promise<string[]> {
  const direct = extractOutboundRecipeUrls(description);
  if (direct.length || !isRecipeTeaser(description)) return direct;
  const provecho = await findProvechoRecipeUrl(canonicalUrl, description ?? '', options);
  if (provecho) return [provecho];
  const crosspost = await findCrosspostedRecipeUrl(description ?? '', options);
  return crosspost ? [crosspost] : [];
}

export function isChallengeHtml(html: string): boolean {
  return /wafchallengeid|slardarClient|slardar_us_waf/i.test(html) && html.length < 12_000;
}

function parseTiktokEmbedded(html: string, videoId: string): {
  title?: string;
  description?: string;
  authorName?: string;
  thumbnailUrl?: string;
} | null {
  const universal =
    parseScriptId(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__') ??
    extractJsonObject(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
  const fromUniversal = asRecord(
    asRecord(asRecord(universal?.['__DEFAULT_SCOPE__'])?.['webapp.video-detail'])?.itemInfo,
  )?.itemStruct;

  const sigi = parseScriptId(html, 'SIGI_STATE') ?? extractJsonObject(html, 'SIGI_STATE');
  const itemModule = asRecord(sigi?.ItemModule);
  const fromSigi = itemModule ? asRecord(itemModule[firstKey(itemModule)]) : null;

  const rec = matchingItem(fromUniversal, itemModule, videoId) ?? (videoId ? null : fromSigi);
  if (!rec) return null;
  const desc = asString(rec.desc);
  const author = asRecord(rec.author);
  const video = asRecord(rec.video);
  return {
    title: desc?.slice(0, 120) || asString(rec.nickname),
    description: desc,
    authorName: asString(author?.nickname) ?? asString(author?.uniqueId),
    thumbnailUrl: asString(video?.cover) ?? asString(video?.originCover),
  };
}

function matchingItem(
  universal: unknown,
  itemModule: Record<string, unknown> | null,
  videoId: string,
): Record<string, unknown> | null {
  const universalRec = asRecord(universal);
  if (universalRec && (!videoId || String(universalRec.id ?? '') === videoId)) return universalRec;
  if (videoId && itemModule?.[videoId]) return asRecord(itemModule[videoId]);
  return null;
}

function parseScriptId(html: string, id: string): Record<string, unknown> | null {
  const match = html.match(new RegExp(`<script[^>]+id="${id}"[^>]*>([\\s\\S]*?)</script>`, 'i'));
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstKey(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  return Object.keys(value as Record<string, unknown>)[0] ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
