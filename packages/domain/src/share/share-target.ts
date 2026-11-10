import { isValidIsbn, normalizeIsbn } from '../stash/readlist/books';
import { classifyRecipeHost } from '../meals/recipe-url';

export type ShareTarget = 'recipe' | 'watchlist' | 'readlist' | 'wishlist' | 'shopping' | 'workout';

export type ShareTargetInput = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};

export type ShareTargetGuess = {
  targets: ShareTarget[];
  url: string | null;
  text: string | null;
  preview: { host: string | null; title: string | null };
};

const ALL_TARGETS: ShareTarget[] = ['recipe', 'watchlist', 'readlist', 'wishlist', 'shopping', 'workout'];

const RECIPE_HOSTS = new Set([
  'allrecipes.com',
  'nytcooking.com',
  'cooking.nytimes.com',
  'seriouseats.com',
  'bonappetit.com',
  'epicurious.com',
  'foodnetwork.com',
  'simplyrecipes.com',
  'tasty.co',
  'bbcgoodfood.com',
  'budgetbytes.com',
  'minimalistbaker.com',
  'cookieandkate.com',
  'smittenkitchen.com',
]);

const SHOP_HOSTS = new Set([
  'ebay.com',
  'ebay.com.au',
  'etsy.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'ikea.com',
  'wayfair.com',
  'shopify.com',
  'jbhifi.com.au',
  'kogan.com',
  'catch.com.au',
  'myer.com.au',
  'davidjones.com',
  'harveynorman.com.au',
]);

function rankWithPrimary(primary: ShareTarget, rest: ShareTarget[] = ALL_TARGETS): ShareTarget[] {
  const tail = rest.filter((target) => target !== primary);
  return [primary, ...tail];
}

function stripWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

function firstUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const found = [...trimmed.matchAll(/https?:\/\/[^\s<>"'`]+/gi)].map((match) =>
    (match[0] ?? '').replace(/[),.!?;:]+$/g, ''),
  );
  if (found[0]) return found[0];
  if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(trimmed) || /^localhost([/:?#]|$)/i.test(trimmed)) {
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  return null;
}

function parseUrl(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isWatchlistHost(host: string): boolean {
  return (
    host === 'imdb.com' ||
    host.endsWith('.imdb.com') ||
    host === 'themoviedb.org' ||
    host.endsWith('.themoviedb.org') ||
    host === 'letterboxd.com' ||
    host.endsWith('.letterboxd.com') ||
    host === 'justwatch.com' ||
    host.endsWith('.justwatch.com')
  );
}

function isReadlistHost(host: string): boolean {
  return (
    host === 'goodreads.com' ||
    host.endsWith('.goodreads.com') ||
    host === 'openlibrary.org' ||
    host.endsWith('.openlibrary.org') ||
    host === 'hardcover.app' ||
    host.endsWith('.hardcover.app') ||
    host === 'books.google.com' ||
    host.startsWith('books.google.') ||
    host.endsWith('.books.google.com')
  );
}

function isAmazonHost(host: string): boolean {
  return host === 'amazon.com' || /^amazon\.[a-z.]+$/i.test(host) || host.endsWith('.amazon.com');
}

function amazonAsin(path: string): string | null {
  const match =
    path.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:\/|$|\?)/i) ??
    path.match(/\/ASIN\/([A-Z0-9]{10})(?:\/|$|\?)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Amazon /dp/ (and siblings) count as books when ISBN-like ASINs or book category signals appear. */
function amazonLooksLikeBook(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  const hay = `${path}?${url.search}`.toLowerCase();
  if (/kindle|stripbooks|digital-text|\/books?\b|book-/.test(hay)) return true;
  if (url.searchParams.get('i')?.toLowerCase() === 'stripbooks') return true;
  const asin = amazonAsin(url.pathname);
  if (asin && isValidIsbn(asin)) return true;
  return false;
}

function isShopHost(host: string): boolean {
  if (SHOP_HOSTS.has(host)) return true;
  if (host.endsWith('.myshopify.com')) return true;
  return [...SHOP_HOSTS].some((shop) => host.endsWith(`.${shop}`));
}

function isHevyShareHost(host: string): boolean {
  return host === 'hevy.com' || host === 'hevy.app' || host.endsWith('.hevy.com') || host.endsWith('.hevy.app');
}

function isProductPath(path: string): boolean {
  return /\/(product|products|dp|gp\/product|item|p)\b/i.test(path);
}

function isRecipeUrl(url: URL): boolean {
  const host = stripWww(url.hostname);
  const kind = classifyRecipeHost(host);
  if (kind !== 'web') return true;
  if (RECIPE_HOSTS.has(host) || [...RECIPE_HOSTS].some((known) => host.endsWith(`.${known}`))) return true;
  if (/\/recipes?\b/i.test(url.pathname)) return true;
  return false;
}

function isbnFromText(text: string | null): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (isValidIsbn(trimmed)) return normalizeIsbn(trimmed);
  const match = trimmed.match(/\b(?:ISBN(?:-1[03])?:?\s*)?((?:\d[\d-]{8,}[\dXx])|(?:\d{13}))\b/i);
  if (!match?.[1]) return null;
  const isbn = normalizeIsbn(match[1]);
  return isbn && isValidIsbn(isbn) ? isbn : null;
}

function isMultiLinePlainText(text: string | null, url: string | null): boolean {
  if (url) return false;
  if (!text?.trim()) return false;
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length >= 2;
}

function previewHost(url: URL | null): string | null {
  if (!url) return null;
  return stripWww(url.hostname);
}

/**
 * Rank where a shared link/text should land in Kinexus.
 * Pure — no network. Callers still hand off to existing import/add flows.
 */
export function guessShareTarget(input: ShareTargetInput): ShareTargetGuess {
  const title = input.title?.trim() || null;
  const rawText = input.text?.trim() || null;
  const extractedUrl = firstUrl(input.url) ?? firstUrl(rawText) ?? firstUrl(title);
  const parsed = parseUrl(extractedUrl);
  const host = parsed ? stripWww(parsed.hostname) : null;
  const preview = { host, title };
  const text = rawText;

  if (parsed && host && isHevyShareHost(host)) {
    return { targets: rankWithPrimary('workout'), url: parsed.href, text, preview };
  }

  if (parsed && host && isWatchlistHost(host)) {
    return { targets: rankWithPrimary('watchlist'), url: parsed.href, text, preview };
  }

  const isbn = !parsed ? isbnFromText(text) : null;
  if (isbn) {
    return { targets: rankWithPrimary('readlist'), url: null, text: isbn, preview: { host: null, title: title ?? isbn } };
  }

  if (parsed && host && isReadlistHost(host)) {
    return { targets: rankWithPrimary('readlist'), url: parsed.href, text, preview };
  }

  if (parsed && host && isAmazonHost(host)) {
    if (amazonLooksLikeBook(parsed)) {
      return { targets: rankWithPrimary('readlist', ['readlist', 'wishlist', 'recipe', 'watchlist', 'shopping']), url: parsed.href, text, preview };
    }
    if (amazonAsin(parsed.pathname) || isProductPath(parsed.pathname)) {
      return { targets: rankWithPrimary('wishlist'), url: parsed.href, text, preview };
    }
  }

  if (parsed && isRecipeUrl(parsed)) {
    return { targets: rankWithPrimary('recipe'), url: parsed.href, text, preview };
  }

  if (parsed && host && (isShopHost(host) || isProductPath(parsed.pathname))) {
    return { targets: rankWithPrimary('wishlist'), url: parsed.href, text, preview };
  }

  if (isMultiLinePlainText(text, extractedUrl)) {
    return { targets: rankWithPrimary('shopping'), url: null, text, preview: { host: null, title } };
  }

  if (parsed) {
    return {
      targets: ['recipe', 'wishlist', 'watchlist', 'readlist', 'shopping'],
      url: parsed.href,
      text,
      preview,
    };
  }

  return {
    targets: rankWithPrimary('recipe'),
    url: null,
    text,
    preview: { host: null, title },
  };
}

export function shareTargetLabel(target: ShareTarget): string {
  switch (target) {
    case 'recipe':
      return 'Recipe';
    case 'watchlist':
      return 'Watchlist';
    case 'readlist':
      return 'Readlist';
    case 'wishlist':
      return 'Wishlist';
    case 'shopping':
      return 'Shopping';
    case 'workout':
      return 'Workout';
  }
}

export function shareTargetPrimaryActionLabel(target: ShareTarget): string {
  switch (target) {
    case 'recipe':
      return 'Import recipe';
    case 'watchlist':
      return 'Add to Watchlist';
    case 'readlist':
      return 'Add to Readlist';
    case 'wishlist':
      return 'Add to Wishlist';
    case 'shopping':
      return 'Add to Shopping';
    case 'workout':
      return 'Import workout';
  }
}

export function isListShareTarget(target: ShareTarget): target is 'watchlist' | 'readlist' | 'wishlist' {
  return target === 'watchlist' || target === 'readlist' || target === 'wishlist';
}
