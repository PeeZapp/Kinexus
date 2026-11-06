import { headerKey, parseCsv } from '../csv';
import { registerListSourceDetector, type ListSourceInput } from './detect';
import { normalizeImdbId } from './match-confidence';
import { emptyImportRow, type ImportRow } from './types';

const IMDB_ID_HEADERS = new Set(['const', 'tconst', 'imdb id', 'imdbid', 'title id']);
const TITLE_HEADERS = new Set(['title', 'name', 'original title', 'title name']);
const YEAR_HEADERS = new Set(['year', 'release year', 'start year']);
const RATING_HEADERS = new Set(['your rating', 'rating', 'imdb rating yours']);
const DATE_HEADERS = new Set(['date rated', 'created', 'modified']);
const TYPE_HEADERS = new Set(['title type', 'titletype', 'type']);
const URL_HEADERS = new Set(['url', 'title url']);
const NOTES_HEADERS = new Set(['description', 'notes', 'comment']);

function indexOf(headers: readonly string[], keys: Set<string>): number {
  return headers.findIndex((header) => keys.has(headerKey(header)));
}

export function looksLikeImdbCsv(headers: readonly string[] | null | undefined): boolean {
  if (!headers || headers.length === 0) return false;
  const keys = headers.map(headerKey);
  const hasId = keys.some((key) => IMDB_ID_HEADERS.has(key));
  const hasTitle = keys.some((key) => TITLE_HEADERS.has(key) || key === 'title');
  const hasType = keys.some((key) => TYPE_HEADERS.has(key));
  // Classic IMDb exports always include Const/tconst plus Title (and usually Title Type).
  return hasId && (hasTitle || hasType);
}

function mediaTypeFromImdb(raw: string | null | undefined): 'movie' | 'tv' | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('tv') || value.includes('series') || value.includes('episode') || value.includes('mini')) {
    return 'tv';
  }
  if (value.includes('movie') || value.includes('film') || value.includes('video') || value.includes('short')) {
    return 'movie';
  }
  return null;
}

function yearFromCell(raw: string): number | null {
  const match = raw.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : null;
}

function ratingFromImdb(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  const score = Math.round(n);
  return score >= 1 && score <= 10 ? score : null;
}

function dateFromImdb(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const mm = slash[1]!.padStart(2, '0');
    const dd = slash[2]!.padStart(2, '0');
    return `${slash[3]}-${mm}-${dd}`;
  }
  return null;
}

export function parseImdbCsv(text: string): ImportRow[] {
  const parsed = parseCsv(text);
  if (!looksLikeImdbCsv(parsed.headers)) {
    throw new Error('Not an IMDb export CSV');
  }
  const headers = parsed.headers ?? [];
  const idIdx = indexOf(headers, IMDB_ID_HEADERS);
  const titleIdx = indexOf(headers, TITLE_HEADERS);
  const yearIdx = indexOf(headers, YEAR_HEADERS);
  const ratingIdx = indexOf(headers, RATING_HEADERS);
  const dateIdx = indexOf(headers, DATE_HEADERS);
  const typeIdx = indexOf(headers, TYPE_HEADERS);
  const urlIdx = indexOf(headers, URL_HEADERS);
  const notesIdx = indexOf(headers, NOTES_HEADERS);
  const yourRating = ratingIdx >= 0 && headerKey(headers[ratingIdx]!).includes('your');

  const rows: ImportRow[] = [];
  for (const cells of parsed.rows) {
    const imdbId = normalizeImdbId(idIdx >= 0 ? cells[idIdx] : null);
    const title = (titleIdx >= 0 ? cells[titleIdx] : '')?.trim() || '';
    if (!title && !imdbId) continue;
    const ratingRaw = yourRating && ratingIdx >= 0 ? cells[ratingIdx] ?? '' : '';
    const rating = ratingFromImdb(ratingRaw);
    rows.push(
      emptyImportRow({
        title: title || imdbId || 'Untitled',
        year: yearIdx >= 0 ? yearFromCell(cells[yearIdx] ?? '') : null,
        imdbId,
        mediaType: typeIdx >= 0 ? mediaTypeFromImdb(cells[typeIdx]) : null,
        url: urlIdx >= 0 ? (cells[urlIdx] ?? '').trim() || null : null,
        notes: notesIdx >= 0 ? (cells[notesIdx] ?? '').trim() || null : null,
        rating,
        itemStatus: rating != null ? 'watched' : 'want',
        watchedDate: dateIdx >= 0 ? dateFromImdb(cells[dateIdx] ?? '') : null,
        status: title || imdbId ? 'ready' : 'invalid',
        note: null,
      }),
    );
  }
  return rows;
}

function detectImdb(input: ListSourceInput) {
  const fileName = (input.fileName ?? '').toLowerCase();
  if (fileName.endsWith('.zip')) return null;
  const text = input.text?.replace(/^\uFEFF/, '') ?? null;
  if (!text) return null;
  if (!(fileName.endsWith('.csv') || (input.mimeType ?? '').includes('csv') || text.includes(','))) return null;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const headers = firstLine.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim());
  if (looksLikeImdbCsv(headers)) return 'imdb-csv' as const;
  return null;
}

registerListSourceDetector({ id: 'imdb', detect: detectImdb });
