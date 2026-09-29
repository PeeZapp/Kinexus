import type { FetchPublicHtmlOptions } from '../../scrape/index.js';
import { fetchPublicHtml } from '../../scrape/index.js';

const TEASER =
  /\b(?:full\s+)?recipe\b.{0,40}\b(?:in\s+(?:my\s+|the\s+)?bio|in\s+(?:the\s+)?comments?|below|in\s+(?:the\s+)?description)\b|\blink in bio\b/i;

const SKIP_HOST =
  /(^|\.)((youtube|youtu\.be|tiktok|instagram|facebook|fb|google|gstatic|ggpht)\.(com|be)|youtu\.be)$/i;

export function isRecipeTeaser(text: string | undefined): boolean {
  const body = (text ?? '').replace(/\s+/g, ' ').trim();
  return body.length > 0 && body.length < 280 && TEASER.test(body);
}

export function extractOutboundRecipeUrls(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) {
    const url = cleanUrl(match[0]);
    if (!url || found.includes(url) || !isRecipeHost(url)) continue;
    found.push(url);
    if (found.length >= 2) break;
  }
  return found;
}

/** A search result only counts when it is the same caption, not another video about the same kind of dish. */
export function recipeUrlFromYoutubeResults(html: string, caption: string): string | undefined {
  const dish = normalizeDish(caption);
  if (dish.length < 4) return undefined;
  const pattern =
    /"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"\}[\s\S]{0,4000}?"descriptionSnippet":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g;
  for (const match of html.matchAll(pattern)) {
    const title = jsonUnescape(match[1] ?? '');
    const snippet = jsonUnescape(match[2] ?? '');
    if (normalizeDish(title) !== dish) continue;
    const url = extractOutboundRecipeUrls(snippet)[0];
    if (url) return url;
  }
  return undefined;
}

export async function findCrosspostedRecipeUrl(
  caption: string,
  options: FetchPublicHtmlOptions = {},
): Promise<string | undefined> {
  try {
    const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(caption)}`;
    const response = await fetchPublicHtml(search, { ...options, timeoutMs: options.timeoutMs ?? 12_000 });
    if (!response.ok) return undefined;
    const html = (await response.text()).slice(0, 2_000_000);
    return recipeUrlFromYoutubeResults(html, caption);
  } catch {
    return undefined;
  }
}

export function recipeIdFromProvechoHub(html: string, caption: string): string | undefined {
  const dish = normalizeDish(caption);
  if (dish.length < 4) return undefined;
  for (const match of html.matchAll(/\{"id":"([A-Za-z0-9]+)","name":"((?:\\.|[^"\\])*)"/g)) {
    const name = normalizeDish(jsonUnescape(match[2] ?? ''));
    if (name === dish) return match[1];
  }
  return undefined;
}

/** TikTok "recipe in bio" for Provecho creators points at their hub. Pick the card that names this dish. */
export async function findProvechoRecipeUrl(
  tiktokUrl: string,
  caption: string,
  options: FetchPublicHtmlOptions = {},
): Promise<string | undefined> {
  const handle = tiktokUrl.match(/tiktok\.com\/@([^/?#]+)/i)?.[1]?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!handle) return undefined;
  try {
    const response = await fetchPublicHtml(`https://provecho.co/${handle}`, {
      ...options,
      timeoutMs: options.timeoutMs ?? 12_000,
    });
    if (!response.ok) return undefined;
    const html = (await response.text()).slice(0, 2_000_000);
    const id = recipeIdFromProvechoHub(html, caption);
    return id ? `https://www.provecho.co/platform/recipe/${id}` : undefined;
  } catch {
    return undefined;
  }
}

export function dishNameFromCaption(value: string | undefined): string | undefined {
  const stripped = (value ?? '')
    .replace(/\b(?:full\s+)?recipe\b.{0,40}\b(?:in\s+(?:my\s+|the\s+)?bio|in\s+(?:the\s+)?comments?|below|in\s+(?:the\s+)?description)\b/gi, ' ')
    .replace(/\blink in bio\b/gi, ' ')
    .replace(/[:)(!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length < 3 || stripped.length > 80) return undefined;
  return stripped;
}

export function normalizeDish(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:full\s+)?recipe(?:\s+in\s+(?:my\s+|the\s+)?bio|\s+in\s+(?:the\s+)?comments?|\s+below|\s+in\s+(?:the\s+)?description)?\b/g, ' ')
    .replace(/\blink in bio\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonUnescape(value: string): string {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"');
}

function cleanUrl(raw: string): string | null {
  const trimmed = raw.replace(/[.,);]+$/g, '');
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function isRecipeHost(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase();
    return !SKIP_HOST.test(host);
  } catch {
    return false;
  }
}
