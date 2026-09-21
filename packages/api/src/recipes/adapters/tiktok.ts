import type { FetchPublicHtmlOptions } from '../../scrape/index.js';
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

  if (oembed?.title && oembed.title.trim().length >= 40) {
    const title = oembed.title.replace(/\s+/g, ' ').trim();
    return {
      title,
      description: title,
      authorName: oembed.author_name,
      thumbnailUrl: oembed.thumbnail_url,
      captions: title,
      siteName: 'TikTok',
      hasCaptions: true,
    };
  }

  const page = await fetchOgTags(canonicalUrl, options);
  const embedded = page?.html && !isChallengeHtml(page.html) ? parseTiktokEmbedded(page.html) : null;
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
  return {
    title,
    description,
    authorName: oembed?.author_name ?? embedded?.authorName,
    thumbnailUrl: oembed?.thumbnail_url || page?.image || embedded?.thumbnailUrl,
    captions: description,
    siteName: 'TikTok',
    hasCaptions: Boolean(description && description.length > 40),
  };
}

export function isChallengeHtml(html: string): boolean {
  return /wafchallengeid|slardarClient|slardar_us_waf/i.test(html) && html.length < 12_000;
}

function parseTiktokEmbedded(html: string): {
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

  const rec = asRecord(fromUniversal) ?? fromSigi;
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
