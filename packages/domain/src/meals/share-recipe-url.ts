import { normalizeRecipeUrl } from './recipe-url';

export type SharedRecipePayload = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
  webUrl?: string | null;
};

/**
 * Pull a recipe/video URL out of an OS or PWA share payload.
 * Social apps often put the link in `url`/`webUrl`, or bury it inside caption `text`.
 */
export function extractRecipeUrlFromShare(payload: SharedRecipePayload): string | null {
  const ordered = [payload.webUrl, payload.url, payload.text, payload.title];
  for (const raw of ordered) {
    if (!raw?.trim()) continue;
    for (const candidate of urlCandidatesFrom(raw)) {
      try {
        return normalizeRecipeUrl(candidate).canonicalUrl;
      } catch {
        // try the next candidate
      }
    }
  }
  return null;
}

function urlCandidatesFrom(raw: string): string[] {
  const trimmed = raw.trim();
  const found = [...trimmed.matchAll(/https?:\/\/[^\s<>"'`]+/gi)].map((match) =>
    stripTrailingJunk(match[0] ?? ''),
  );
  if (found.length) return [...new Set(found.filter(Boolean))];
  if (looksLikeBareHost(trimmed)) return [trimmed];
  return [];
}

function stripTrailingJunk(url: string): string {
  return url.replace(/[),.!?;:]+$/g, '');
}

function looksLikeBareHost(raw: string): boolean {
  return /^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(raw) || /^localhost([/:?#]|$)/i.test(raw);
}
