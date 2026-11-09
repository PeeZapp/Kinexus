import { normalizeRecipeUrl, type NormalizedRecipeUrl } from '@kinexus/domain';

import { assertPublicHttpUrl, assertResolvedPublicHost, defaultHostnameLookup, type HostnameLookup } from '../scrape/ssrf.js';
import { RecipeImportFailure } from './errors.js';

export const TIKTOK_LINK_OPEN_FAILED =
  "We couldn't open that TikTok link. Open the video in TikTok, tap Share > Copy link again, or paste the recipe text.";

const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const MAX_HOPS = 5;
const TIMEOUT_MS = 5_000;
const MEDIA_PATH = /\/(?:@[^/]+\/)?(?:video|photo)\/(\d+)/i;

export type ResolveTiktokOptions = {
  fetch?: typeof fetch;
  lookup?: HostnameLookup;
};

/**
 * Follow TikTok short-link redirects until a /video/<id> or /photo/<id> Location appears.
 * SSRF-checks every hop. Does not download the final page body.
 */
export async function resolveTiktokRecipeUrl(
  normalized: NormalizedRecipeUrl,
  options: ResolveTiktokOptions = {},
): Promise<NormalizedRecipeUrl> {
  if (normalized.sourceKind !== 'tiktok' || !normalized.needsResolve) {
    return normalized;
  }

  const doFetch = options.fetch ?? fetch;
  const lookup =
    options.lookup ??
    (process.env.VITEST ? (async () => ['8.8.8.8'] as string[]) : defaultHostnameLookup);
  const inputHost = hostOnly(normalized.canonicalUrl);
  let current = normalized.canonicalUrl;
  let hops = 0;

  try {
    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      const media = mediaTarget(current);
      if (media) {
        return finishResolve(normalized, media.href, inputHost, hops, media.videoId);
      }

      const parsed = assertPublicHttpUrl(current);
      await assertResolvedPublicHost(parsed.hostname, lookup);
      hops += 1;

      const response = await doFetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': MOBILE_SAFARI_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw tiktokOpenFailed();
        const nextUrl = new URL(location, current);
        if (isDeadTiktokLanding(nextUrl)) throw tiktokOpenFailed();
        const nextMedia = mediaTarget(nextUrl.href);
        if (nextMedia) {
          return finishResolve(normalized, nextMedia.href, inputHost, hops, nextMedia.videoId);
        }
        current = nextUrl.href;
        continue;
      }

      const landed = mediaTarget(response.url && response.url !== current ? response.url : current);
      if (landed) {
        return finishResolve(normalized, landed.href, inputHost, hops, landed.videoId);
      }
      if (isDeadTiktokLanding(new URL(current))) throw tiktokOpenFailed();
      throw tiktokOpenFailed();
    }
    throw tiktokOpenFailed();
  } catch (err) {
    if (err instanceof RecipeImportFailure) {
      logResolve(inputHost, hostOnly(current), hops, undefined);
      throw err;
    }
    logResolve(inputHost, hostOnly(current), hops, undefined);
    throw tiktokOpenFailed();
  }
}

function finishResolve(
  original: NormalizedRecipeUrl,
  mediaUrl: string,
  inputHost: string,
  hops: number,
  videoId: string,
): NormalizedRecipeUrl {
  const resolved = normalizeRecipeUrl(mediaUrl);
  logResolve(inputHost, resolved.displayHost, hops, videoId);
  return {
    ...resolved,
    inputUrl: original.inputUrl,
  };
}

function mediaTarget(raw: string): { href: string; videoId: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(MEDIA_PATH);
  if (!match?.[1]) return null;
  const kind = /\/photo\//i.test(parsed.pathname) ? 'photo' : 'video';
  const user = parsed.pathname.match(/\/(@[^/]+)\//)?.[1];
  const href = user
    ? `https://www.tiktok.com/${user}/${kind}/${match[1]}`
    : `https://www.tiktok.com/${kind}/${match[1]}`;
  return { href, videoId: match[1] };
}

function isDeadTiktokLanding(url: URL): boolean {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'tiktok.com' && !host.endsWith('.tiktok.com')) return false;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/404' || /\/404$/i.test(path);
}

function tiktokOpenFailed(): RecipeImportFailure {
  return new RecipeImportFailure('fetch_failed', TIKTOK_LINK_OPEN_FAILED);
}

function hostOnly(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, '');
  } catch {
    return 'unknown';
  }
}

function logResolve(inputHost: string, resolvedHost: string, hops: number, videoId: string | undefined): void {
  console.info('[recipe-import:tiktok-resolve]', {
    inputHost,
    resolvedHost,
    hops,
    videoId: videoId ?? null,
  });
}
