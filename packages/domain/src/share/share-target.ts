import { detectDelimiter, headerKey, splitDelimited } from '../csv';
import { BANKS } from '../finances/banks';
import { isValidIsbn, normalizeIsbn } from '../stash/readlist/books';
import { classifyRecipeHost } from '../meals/recipe-url';

export type ShareTarget =
  | 'recipe'
  | 'watchlist'
  | 'readlist'
  | 'wishlist'
  | 'shopping'
  | 'workout'
  | 'bank_transactions'
  | 'list_import';

export type ShareTargetInput = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};

export type ShareFileInput = {
  fileName?: string | null;
  mimeType?: string | null;
  /** Optional text peek (CSV header / statement sniff). */
  textPreview?: string | null;
};

export type ShareTargetGuess = {
  targets: ShareTarget[];
  url: string | null;
  text: string | null;
  preview: { host: string | null; title: string | null };
};

const ALL_TARGETS: ShareTarget[] = ['recipe', 'watchlist', 'readlist', 'wishlist', 'shopping', 'workout'];

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp']);
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const STATEMENT_EXTS = new Set(['csv', 'ofx', 'qfx', 'qif', 'qbo', 'pdf']);
const STATEMENT_MIMES = new Set([
  'text/csv',
  'application/csv',
  'application/x-ofx',
  'application/vnd.intu.qfx',
  'application/x-qif',
  'application/vnd.intu.qbo',
  'application/pdf',
]);

const DATE_HEADER_KEYS = new Set([
  'date',
  'transaction date',
  'tran date',
  'processed date',
  'value date',
  'posted date',
  'posted',
  'effective date',
  'txn date',
  'trans date',
]);
const AMOUNT_HEADER_KEYS = new Set([
  'amount',
  'transaction amount',
  'value',
  'aud',
  'nzd',
  'usd',
  'gbp',
  'eur',
  'txn amount',
  'debit',
  'debit amount',
  'withdrawal',
  'withdrawals',
  'money out',
  'spent',
  'payments',
  'credit',
  'credit amount',
  'deposit',
  'deposits',
  'money in',
  'received',
  'receipts',
]);
const DESC_HEADER_KEYS = new Set([
  'description',
  'narrative',
  'narration',
  'particulars',
  'details',
  'merchant',
  'transaction details',
  'payee',
  'memo',
  'transaction',
  'transaction description',
  'reference',
  'name',
]);

const BANK_NAME_NEEDLES = BANKS.filter((bank) => bank.id !== 'other').flatMap((bank) => {
  const name = bank.name.toLowerCase();
  const extras: string[] = [name, bank.id];
  if (bank.id === 'commbank') extras.push('cba', 'commonwealth');
  if (bank.id === 'boq') extras.push('bank of queensland', 'queensland');
  if (bank.id === 'stgeorge') extras.push('st george', 'st. george');
  return extras;
});

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
    host === 'boxd.it' ||
    host.endsWith('.boxd.it') ||
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

function extensionOf(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function isShareImageFile(file: ShareFileInput): boolean {
  const mime = (file.mimeType ?? '').toLowerCase();
  if (IMAGE_MIMES.has(mime) || mime.startsWith('image/')) {
    const ext = extensionOf(file.fileName);
    if (!ext || IMAGE_EXTS.has(ext)) return true;
  }
  return IMAGE_EXTS.has(extensionOf(file.fileName));
}

export function isShareStatementFile(file: ShareFileInput): boolean {
  const mime = (file.mimeType ?? '').toLowerCase();
  if (STATEMENT_MIMES.has(mime)) return true;
  return STATEMENT_EXTS.has(extensionOf(file.fileName));
}

function filePreviewTitle(files: ShareFileInput[]): string | null {
  const names = files.map((file) => file.fileName?.trim()).filter(Boolean) as string[];
  if (names.length === 0) return null;
  if (names.length === 1) return names[0] ?? null;
  return `${names[0]} +${names.length - 1}`;
}

function looksLikeBankCsvHeaders(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const line =
    text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find(Boolean) ?? '';
  if (!line) return false;
  const delimiter = detectDelimiter(line);
  const cells = splitDelimited(line, delimiter).map(headerKey);
  const hasDate = cells.some((cell) => DATE_HEADER_KEYS.has(cell));
  const hasAmount = cells.some((cell) => AMOUNT_HEADER_KEYS.has(cell));
  const hasDesc = cells.some((cell) => DESC_HEADER_KEYS.has(cell));
  return hasDate && hasAmount && hasDesc;
}

function needleInHay(hay: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.length <= 2) {
    return new RegExp(`(?:^|[^a-z0-9])${needle}(?:[^a-z0-9]|$)`, 'i').test(hay);
  }
  return hay.includes(needle);
}

function fileNameLooksLikeBankExport(fileName: string | null | undefined): boolean {
  const hay = (fileName ?? '').toLowerCase();
  if (!hay) return false;
  if (/\b(statement|transactions?|txn|export)\b/i.test(hay)) return true;
  return BANK_NAME_NEEDLES.some((needle) => needleInHay(hay, needle));
}

function textLooksLikeBankExport(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  if (looksLikeBankCsvHeaders(text)) return true;
  const head = text.slice(0, 4000).toLowerCase();
  if (head.includes('ofxheader') || head.includes('<ofx') || head.startsWith('!type:bank')) return true;
  return BANK_NAME_NEEDLES.some((needle) => needleInHay(head, needle));
}

/** True when filename/header signals a bank statement export. */
export function looksLikeBankExportFile(file: ShareFileInput): boolean {
  if (fileNameLooksLikeBankExport(file.fileName)) return true;
  if (textLooksLikeBankExport(file.textPreview)) return true;
  return false;
}

/**
 * Rank where shared file(s) should land.
 * Images / statement files → Bank transactions + List import (no Recipe photo target yet).
 * Other files → List import only.
 */
export function guessShareFiles(files: readonly ShareFileInput[]): ShareTargetGuess {
  const list = files.filter((file) => Boolean(file.fileName?.trim() || file.mimeType?.trim()));
  const preview = { host: null as string | null, title: filePreviewTitle(list) };

  if (list.length === 0) {
    return { targets: ['list_import'], url: null, text: null, preview };
  }

  const allImages = list.every(isShareImageFile);
  if (allImages) {
    return {
      targets: ['bank_transactions', 'list_import'],
      url: null,
      text: null,
      preview,
    };
  }

  const allStatements = list.every(isShareStatementFile);
  if (allStatements) {
    const bankFirst = list.some(looksLikeBankExportFile);
    return {
      targets: bankFirst ? ['bank_transactions', 'list_import'] : ['list_import', 'bank_transactions'],
      url: null,
      text: null,
      preview,
    };
  }

  return {
    targets: ['list_import'],
    url: null,
    text: null,
    preview,
  };
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
    case 'bank_transactions':
      return 'Bank transactions';
    case 'list_import':
      return 'List import';
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
    case 'bank_transactions':
      return 'Add transactions';
    case 'list_import':
      return 'Import list';
  }
}

export function isListShareTarget(target: ShareTarget): target is 'watchlist' | 'readlist' | 'wishlist' {
  return target === 'watchlist' || target === 'readlist' || target === 'wishlist';
}
