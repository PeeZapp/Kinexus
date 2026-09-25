import type { StashDetailStatus } from './types';

/** Daily Render passes stop after this many misses so a blocked link does not run forever. */
export const STASH_DETAIL_ATTEMPT_LIMIT = 7;

export const STASH_DETAIL_PENDING_NOTE = 'Price and photo are added on the daily update.';

export const STASH_DETAIL_GAVE_UP_NOTE = 'This shop did not return a price. Enter one if you have it.';

export function detailStatusForSave(sourceUrl: string, currentPrice: number | null): StashDetailStatus {
  if (!sourceUrl.trim() || currentPrice != null) return 'ready';
  return 'pending';
}

export function detailNote(status: StashDetailStatus, attempts: number): string | null {
  if (status !== 'pending') return null;
  if (attempts >= STASH_DETAIL_ATTEMPT_LIMIT) return STASH_DETAIL_GAVE_UP_NOTE;
  return STASH_DETAIL_PENDING_NOTE;
}

/** A readable name from a product URL when the page itself did not return one. */
export function titleFromSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
    const named = parts.filter((part) => /[a-z]/i.test(part) && part.length > 3);
    named.sort((a, b) => b.split(/[-_]/).length - a.split(/[-_]/).length || b.length - a.length);
    const slug = (named[0] ?? parts[parts.length - 1] ?? '').replace(/\.[a-z0-9]{2,4}$/i, '');
    const words = slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (words.length < 2) return parsed.hostname.replace(/^www\./, '');
    return words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Saved item';
  }
}
