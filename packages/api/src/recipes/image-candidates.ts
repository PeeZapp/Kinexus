import { assertPublicHttpUrl, assertResolvedPublicHost, defaultHostnameLookup } from '../scrape/ssrf.js';
import type { FetchPublicHtmlOptions } from '../scrape/index.js';

export type RankedImage = { url: string; bytes: number };

/** YouTube’s missing-maxres grey stub is 120×90 (~1KB). Anything under this is not a real still. */
export const YOUTUBE_PLACEHOLDER_MAX_BYTES = 2_500;

export function youtubeThumbUrls(videoId: string): string[] {
  const id = videoId.trim();
  if (!id) return [];
  const base = `https://i.ytimg.com/vi/${encodeURIComponent(id)}`;
  return [
    `${base}/maxresdefault.jpg`,
    `${base}/sddefault.jpg`,
    `${base}/hqdefault.jpg`,
    `${base}/1.jpg`,
    `${base}/2.jpg`,
    `${base}/3.jpg`,
  ];
}

export function isYoutubeGreyPlaceholder(contentLength: number | null | undefined): boolean {
  if (contentLength == null || !Number.isFinite(contentLength)) return false;
  return contentLength > 0 && contentLength < YOUTUBE_PLACEHOLDER_MAX_BYTES;
}

/** Dedupe by URL, largest first, cap at `max`. */
export function rankImageCandidates(ranked: readonly RankedImage[], max = 10): string[] {
  const seen = new Set<string>();
  return [...ranked]
    .filter((item) => item.url && item.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.url.localeCompare(b.url))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, Math.max(0, max))
    .map((item) => item.url);
}

export function dedupeUrls(urls: readonly (string | undefined)[], max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

export async function headValidateImage(
  imageUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<RankedImage | null> {
  let parsed;
  try {
    parsed = assertPublicHttpUrl(imageUrl);
    await assertResolvedPublicHost(parsed.hostname, options.lookup ?? defaultHostnameLookup);
  } catch {
    return null;
  }
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(imageUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
        Referer: `${parsed.origin}/`,
        ...options.headers,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!type.startsWith('image/')) return null;
  const lengthRaw = response.headers.get('content-length');
  const bytes = lengthRaw != null && /^\d+$/.test(lengthRaw) ? Number(lengthRaw) : 0;
  if (isYoutubeGreyPlaceholder(bytes)) return null;
  return { url: imageUrl, bytes: bytes > 0 ? bytes : 1 };
}

export async function collectRecipeImageCandidates(input: {
  youtubeVideoId?: string;
  seedUrls?: readonly (string | undefined)[];
  options?: FetchPublicHtmlOptions;
  max?: number;
}): Promise<{ imageUrl?: string; imageCandidates: string[] }> {
  const youtubeUrls = youtubeThumbUrls(input.youtubeVideoId ?? '');
  const seedUrls = dedupeUrls(input.seedUrls ?? [], 24);
  const toProbe = dedupeUrls([...youtubeUrls, ...seedUrls], 24);
  const youtubeSet = new Set(youtubeUrls);
  const ranked: RankedImage[] = [];
  const softKeep: RankedImage[] = [];
  await Promise.all(
    toProbe.map(async (url) => {
      const hit = await headValidateImage(url, input.options);
      if (hit) {
        ranked.push(hit);
        return;
      }
      // YouTube stills must pass HEAD (drop grey placeholders). Other seeds stay as fallbacks.
      if (!youtubeSet.has(url)) softKeep.push({ url, bytes: 1 });
    }),
  );
  const imageCandidates = rankImageCandidates([...ranked, ...softKeep], input.max ?? 10);
  return { imageUrl: imageCandidates[0], imageCandidates };
}
