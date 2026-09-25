const STOP_WORDS = new Set([
  'get',
  'got',
  'my',
  'recipe',
  'recipes',
  'for',
  'the',
  'and',
  'comments',
  'comment',
  'below',
  'this',
  'that',
  'with',
  'from',
  'your',
  'you',
  'printable',
  'full',
  'link',
  'video',
  'facebook',
  'watch',
  'share',
  'reel',
]);

const SKIP_HOST_PARTS = [
  'facebook.com',
  'fb.com',
  'fb.watch',
  'fbcdn.net',
  'fbsbx.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'zoom.us',
  'bluejeans.com',
  'stockx.com',
  'w3.org',
  'google.com',
  'gstatic.com',
];

export type FacebookCrawlerExtract = {
  comments: string[];
  extraText?: string;
  linkedUrls: string[];
};

export function parseFacebookCrawlerHtml(html: string, title?: string): FacebookCrawlerExtract {
  const comments = uniqueStrings(
    extractGraphqlTexts(html).filter((text) => text.length >= 20 && text.length <= 8_000),
  );
  const ranked = comments
    .map((text) => ({ text, score: scoreComment(text, title), urls: urlsFromText(text) }))
    .sort((a, b) => b.score - a.score);

  const extra = ranked
    .filter((row) => row.score > 0)
    .slice(0, 6)
    .map((row) => row.text);

  const linkedUrls: string[] = [];
  for (const row of ranked) {
    if (row.score <= 0) continue;
    for (const url of row.urls) {
      if (!linkedUrls.includes(url)) linkedUrls.push(url);
      if (linkedUrls.length >= 2) break;
    }
    if (linkedUrls.length >= 2) break;
  }

  return {
    comments,
    extraText: extra.length ? extra.join('\n\n') : undefined,
    linkedUrls,
  };
}

/** Spoken/auto caption track for the main video. Related-video tracks are ignored. */
export function facebookCaptionTrackUrl(html: string): string | undefined {
  for (const chunk of sourceChunks(html)) {
    if (isRelatedRecirc(chunk)) continue;
    const match = chunk.match(/"captions_url"\s*:\s*"((?:\\.|[^"\\])+)"/);
    const url = match?.[1] ? facebookCaptionFileUrl(decodeGraphqlString(match[1])) : undefined;
    if (url) return url;
  }
  return undefined;
}

export function facebookCaptionFileToText(body: string): string | undefined {
  const head = body.slice(0, 240);
  if (/<!doctype|<html|<title>\s*error\s*<\/title>/i.test(head)) return undefined;
  const lines = body.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const parts: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'WEBVTT' || /^\d+$/.test(trimmed)) continue;
    if (/^\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s+-->/.test(trimmed)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    parts.push(trimmed);
  }
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.length >= 20 ? text.slice(0, 20_000) : undefined;
}

function facebookCaptionFileUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return undefined;
    const host = url.hostname.toLowerCase();
    if (host !== 'fbcdn.net' && !host.endsWith('.fbcdn.net')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function extractGraphqlTexts(html: string): string[] {
  const texts: string[] = [];
  for (const chunk of sourceChunks(html)) {
    if (isRelatedRecirc(chunk)) continue;
    for (const match of chunk.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\]){12,8000})"/g)) {
      if (isOtherVideoTitle(chunk, match.index ?? 0)) continue;
      const decoded = decodeGraphqlString(match[1] ?? '').trim();
      if (decoded) texts.push(decoded);
    }
  }
  return texts;
}

function sourceChunks(html: string): string[] {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1] ?? '');
  return scripts.length ? scripts : [html];
}

/** Logged-out reel pages embed other posts' full captions under this section. */
function isRelatedRecirc(chunk: string): boolean {
  return chunk.includes('video_home_www_related_videos_section');
}

/** Other reels on the page publish their captions as savable_title / savable_description. */
function isOtherVideoTitle(chunk: string, index: number): boolean {
  const before = chunk.slice(Math.max(0, index - 48), index);
  return /"savable_(?:title|description)"\s*:\s*\{\s*$/.test(before);
}

function decodeGraphqlString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw.replace(/\\n/g, '\n').replace(/\\\//g, '/').replace(/\\"/g, '"');
  }
}

function scoreComment(text: string, title?: string): number {
  const urls = urlsFromText(text);
  const recipeBody = looksLikeRecipeBody(text);
  const teaser = isTeaserCaption(text);
  if (teaser && !urls.length && !recipeBody) return -8;

  const tokens = titleTokens(title);
  const overlap = tokens.filter((token) => text.toLowerCase().includes(token)).length;
  let score = overlap * 3;
  if (urls.length) score += 6;
  if (recipeBody) score += 10;
  if (tokens.length >= 2 && overlap === 0 && !recipeBody) score -= 4;
  return score;
}

export function titleTokens(title?: string): string[] {
  if (!title) return [];
  const folded = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return uniqueStrings(
    folded
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)),
  );
}

function isTeaserCaption(text: string): boolean {
  return (
    /in the comments below|recipe in the comments|recipe (is )?linked below|link in (the |my )?(bio|profile)|comment \S+ and i[’']ll send|commenting has been turned off/i.test(
      text,
    ) && !looksLikeRecipeBody(text)
  );
}

function looksLikeRecipeBody(text: string): boolean {
  const signals = text.match(
    /\b(cups?|tbsp|tsp|tablespoons?|teaspoons?|grams?|ounces?|oz\b|ml\b|ingredients?|preheat|whisk|simmer|chop|bake)\b/gi,
  );
  return (signals?.length ?? 0) >= 3;
}

function urlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return uniqueStrings(matches.map(cleanUrl).filter(isFollowableRecipeUrl));
}

function cleanUrl(raw: string): string {
  return raw.replace(/&amp;/g, '&').replace(/[),.;!?]+$/g, '');
}

function isFollowableRecipeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (SKIP_HOST_PARTS.some((part) => host === part || host.endsWith(`.${part}`) || host.includes(part))) {
      return false;
    }
    const path = url.pathname.replace(/\/+$/, '');
    return path.length > 1;
  } catch {
    return false;
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
