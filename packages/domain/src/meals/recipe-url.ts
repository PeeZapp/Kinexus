import type { RecipeSourceKind } from './clean-recipe';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'igshid',
  'igsh',
  'si',
  'feature',
  'pp',
  'ref',
  'ref_src',
]);

const DEFAULT_PREFIX_HOSTS = new Set([
  'kinexus.app',
  'www.kinexus.app',
  'localhost',
  '127.0.0.1',
]);

export class RecipeUrlError extends Error {
  readonly code: 'invalid_url' | 'unsupported_url';

  constructor(code: 'invalid_url' | 'unsupported_url', message: string) {
    super(message);
    this.name = 'RecipeUrlError';
    this.code = code;
  }
}

export type NormalizedRecipeUrl = {
  inputUrl: string;
  canonicalUrl: string;
  sourceKind: RecipeSourceKind;
  displayHost: string;
  /** Stable platform id (YouTube video id, TikTok video id, Instagram shortcode). */
  videoId?: string;
};

export function classifyRecipeHost(hostname: string): RecipeSourceKind {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (
    host === 'facebook.com' ||
    (host.endsWith('.facebook.com') && host !== 'graph.facebook.com') ||
    host === 'fb.watch' ||
    host === 'fb.com' ||
    host === 'fb.me'
  ) {
    return 'facebook';
  }
  return 'web';
}

/**
 * Accept a pasted http(s) URL, or the PWA prefix form
 * `https://kinexus.app/https://source.example/recipe` (also `/https:/` after slash collapse).
 */
export function normalizeRecipeUrl(
  raw: string,
  options?: { prefixHosts?: readonly string[] },
): NormalizedRecipeUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new RecipeUrlError('invalid_url', 'A recipe URL is required');
  }
  if (trimmed.length > 2048) {
    throw new RecipeUrlError('invalid_url', 'That URL is too long');
  }

  const prefixHosts = new Set([
    ...DEFAULT_PREFIX_HOSTS,
    ...(options?.prefixHosts ?? []).map((host) => host.replace(/^www\./i, '').toLowerCase()),
  ]);

  const unwrapped = unwrapPrefixUrl(trimmed, prefixHosts);
  let parsed: URL;
  try {
    parsed = new URL(unwrapped);
  } catch {
    throw new RecipeUrlError('invalid_url', 'Enter a valid URL starting with https://');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RecipeUrlError('invalid_url', 'Enter a valid URL starting with https://');
  }

  const canonical = canonicalizeRecipeUrl(parsed);
  const sourceKind = classifyRecipeHost(canonical.hostname);
  const videoId = videoIdFromCanonical(canonical, sourceKind);
  return {
    inputUrl: trimmed,
    canonicalUrl: canonical.href,
    sourceKind,
    displayHost: canonical.hostname.replace(/^www\./i, ''),
    videoId,
  };
}

function unwrapPrefixUrl(raw: string, prefixHosts: Set<string>): string {
  if (/^\/https?:/i.test(raw) || /^\/https\//i.test(raw) || /^\/http\//i.test(raw)) {
    return fixNestedScheme(raw.replace(/^\//, ''));
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : looksLikeHostPath(raw) ? `https://${raw}` : raw;

  const nested = candidate.match(/^(https:\/\/[^/]+)\/((?:https?:\/+|https\/|http\/).+)$/i);
  if (nested?.[1] && nested[2]) {
    try {
      const outer = new URL(nested[1]);
      const host = outer.hostname.replace(/^www\./i, '').toLowerCase();
      if (prefixHosts.has(host) || host.endsWith('.localhost')) {
        return fixNestedScheme(nested[2]);
      }
    } catch {
      // keep candidate
    }
  }

  return candidate;
}

function looksLikeHostPath(raw: string): boolean {
  return /^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(raw) || /^localhost([/:?#]|$)/i.test(raw);
}

/** Browsers often turn `/https://host` into `/https:/host` or `/https/host`. */
function fixNestedScheme(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^https:\//i.test(raw)) return raw.replace(/^https:\//i, 'https://');
  if (/^http:\//i.test(raw)) return raw.replace(/^http:\//i, 'http://');
  if (/^https\//i.test(raw)) return raw.replace(/^https\//i, 'https://');
  if (/^http\//i.test(raw)) return raw.replace(/^http\//i, 'http://');
  return raw;
}

function canonicalizeRecipeUrl(url: URL): URL {
  const next = new URL(url.href);
  next.hash = '';
  next.username = '';
  next.password = '';
  next.hostname = next.hostname.toLowerCase();
  next.pathname = next.pathname.replace(/\/+$/, '') || '/';

  const kind = classifyRecipeHost(next.hostname);

  if (kind === 'youtube') {
    const id = youtubeVideoId(next);
    if (!id) throw new RecipeUrlError('unsupported_url', 'That YouTube link is missing a video id');
    return new URL(`https://www.youtube.com/watch?v=${id}`);
  }

  if (kind === 'tiktok') {
    const userVideo = next.pathname.match(/\/(@[^/]+\/video\/\d+)/);
    if (userVideo?.[1]) return new URL(`https://www.tiktok.com/${userVideo[1]}`);
    const video = next.pathname.match(/\/video\/(\d+)/);
    if (video?.[1]) return new URL(`https://www.tiktok.com/video/${video[1]}`);
    stripTrackingParams(next);
    next.hostname = 'www.tiktok.com';
    return next;
  }

  if (kind === 'instagram') {
    const match = next.pathname.match(/\/(reels?|p|tv)\/([^/?#]+)/i);
    if (match?.[1] && match[2]) {
      const kindPath = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase();
      return new URL(`https://www.instagram.com/${kindPath}/${match[2]}`);
    }
    stripTrackingParams(next);
    next.hostname = 'www.instagram.com';
    return next;
  }

  if (kind === 'facebook') {
    return canonicalizeFacebookUrl(next);
  }

  stripTrackingParams(next);

  if (kind === 'web' && next.hostname.startsWith('www.')) {
    next.hostname = next.hostname.slice(4);
  }

  return next;
}

function stripTrackingParams(url: URL): void {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      url.searchParams.delete(key);
    }
  }
}

/** YouTube watch/shorts/embed/live/share/youtu.be → the video id. Tracking params are ignored. */
export function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    return cleanYoutubeId(url.pathname.split('/').filter(Boolean)[0]);
  }
  const fromQuery = cleanYoutubeId(url.searchParams.get('v'));
  if (fromQuery) return fromQuery;
  const fromPath = url.pathname.match(/\/(?:shorts|embed|live|v|watch)\/([^/?#]+)/i);
  return cleanYoutubeId(fromPath?.[1]);
}

function cleanYoutubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().split('?')[0]?.split('&')[0]?.split('#')[0] ?? '';
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  return id;
}

function videoIdFromCanonical(url: URL, kind: RecipeSourceKind): string | undefined {
  if (kind === 'youtube') return youtubeVideoId(url) ?? undefined;
  if (kind === 'tiktok') {
    const match = url.pathname.match(/\/video\/(\d+)/);
    return match?.[1];
  }
  if (kind === 'instagram') {
    const match = url.pathname.match(/\/(?:reels?|p|tv)\/([^/]+)/i);
    return match?.[1];
  }
  if (kind === 'facebook') return facebookVideoId(url);
  return undefined;
}

function canonicalizeFacebookUrl(url: URL): URL {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const share = path.match(/^\/share\/([rvp])\/([^/]+)/i);
  if (share?.[1] && share[2]) {
    return new URL(`https://www.facebook.com/share/${share[1].toLowerCase()}/${share[2]}`);
  }
  const reel = path.match(/^\/reels?\/(\d{6,})/i);
  if (reel?.[1]) return new URL(`https://www.facebook.com/reel/${reel[1]}`);
  const watchId = url.searchParams.get('v');
  if (/\/watch/i.test(path) && watchId && /^\d{6,}$/.test(watchId)) {
    return new URL(`https://www.facebook.com/watch/?v=${watchId}`);
  }
  const videoId = facebookNumericVideoId(path);
  if (videoId) return new URL(`https://www.facebook.com/reel/${videoId}`);

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'fb.watch') {
    const code = path.split('/').filter(Boolean)[0];
    if (code) return new URL(`https://fb.watch/${code}`);
  }

  const next = new URL(url.href);
  next.hash = '';
  next.username = '';
  next.password = '';
  stripTrackingParams(next);
  next.hostname = host === 'fb.watch' ? 'fb.watch' : 'www.facebook.com';
  next.pathname = path;
  return next;
}

function facebookVideoId(url: URL): string | undefined {
  const share = url.pathname.match(/^\/share\/[rvp]\/([^/]+)/i);
  if (share?.[1]) return share[1];
  const reel = url.pathname.match(/^\/reels?\/([^/]+)/i);
  if (reel?.[1]) return reel[1];
  const watch = url.searchParams.get('v');
  if (watch && /^\d{6,}$/.test(watch)) return watch;
  const numeric = facebookNumericVideoId(url.pathname);
  if (numeric) return numeric;
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'fb.watch') return url.pathname.split('/').filter(Boolean)[0];
  return undefined;
}

function facebookNumericVideoId(pathname: string): string | undefined {
  const matches = [...pathname.matchAll(/\/(?:videos|reel|reels)\/(?:[^/]+\/)*(\d{6,})/gi)];
  return matches.at(-1)?.[1];
}
