import JSZip from 'jszip';

import { headerKey, parseCsv } from '../csv';
import { registerListSourceDetector, type ListSourceInput } from './detect';
import { letterboxdRatingToScore, normalizeImdbId } from './match-confidence';
import { emptyImportRow, type ImportRow } from './types';

const NAME_HEADERS = new Set(['name', 'title', 'film', 'film title']);
const YEAR_HEADERS = new Set(['year']);
const RATING_HEADERS = new Set(['rating', 'rating10']);
const DATE_HEADERS = new Set(['date', 'watcheddate', 'watched date', 'diary date']);
const URI_HEADERS = new Set(['letterboxd uri', 'letterboxduri', 'uri', 'url']);
const IMDB_HEADERS = new Set(['imdbid', 'imdb id', 'imdb']);
const TMDB_HEADERS = new Set(['tmdbid', 'tmdb id', 'tmdb']);
const NOTES_HEADERS = new Set(['review', 'notes', 'description', 'tags']);

const KNOWN_ZIP_FILES = /^(watchlist|watched|ratings|diary)\.csv$/i;
const LIST_ZIP_FILE = /^lists\/.+\.csv$/i;

function indexOf(headers: readonly string[], keys: Set<string>): number {
  return headers.findIndex((header) => keys.has(headerKey(header)));
}

export function looksLikeLetterboxdCsv(
  headers: readonly string[] | null | undefined,
  fileName?: string | null,
): boolean {
  const name = (fileName ?? '').toLowerCase().replace(/\\/g, '/');
  const base = name.split('/').pop() ?? name;
  if (KNOWN_ZIP_FILES.test(base) || /\/lists\/.+\.csv$/i.test(name) || base.startsWith('list ')) {
    return true;
  }
  if (!headers || headers.length === 0) return false;
  const keys = headers.map(headerKey);
  const hasName = keys.some((key) => NAME_HEADERS.has(key));
  const hasYear = keys.some((key) => YEAR_HEADERS.has(key));
  const hasUri = keys.some((key) => URI_HEADERS.has(key));
  const hasRating = keys.some((key) => RATING_HEADERS.has(key));
  // Letterboxd exports: Name + Year (+ often Letterboxd URI / Rating / Date)
  return hasName && hasYear && (hasUri || hasRating || keys.includes('date'));
}

function yearFromCell(raw: string): number | null {
  const match = raw.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : null;
}

function dateFromCell(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1] ?? null;
}

function ratingFromCells(cells: readonly string[], headers: readonly string[]): number | null {
  const rating10Idx = headers.findIndex((header) => headerKey(header) === 'rating10');
  if (rating10Idx >= 0) {
    const n = Number((cells[rating10Idx] ?? '').trim());
    if (Number.isInteger(n) && n >= 1 && n <= 10) return n;
  }
  const ratingIdx = indexOf(headers, new Set(['rating']));
  if (ratingIdx < 0) return null;
  const n = Number((cells[ratingIdx] ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 5) {
    const score = Math.round(n);
    return score >= 1 && score <= 10 ? score : null;
  }
  return letterboxdRatingToScore(n);
}

function kindHintFromFileName(fileName: string | null | undefined): 'watchlist' | 'watched' | 'ratings' | 'list' {
  const name = (fileName ?? '').toLowerCase().replace(/\\/g, '/');
  const base = name.split('/').pop() ?? name;
  if (base === 'watched.csv' || base === 'diary.csv') return 'watched';
  if (base === 'ratings.csv') return 'ratings';
  if (base === 'watchlist.csv') return 'watchlist';
  if (name.includes('/lists/') || base.startsWith('list')) return 'list';
  return 'watchlist';
}

export function parseLetterboxdCsv(text: string, fileName?: string | null): ImportRow[] {
  const parsed = parseCsv(text);
  if (!looksLikeLetterboxdCsv(parsed.headers, fileName)) {
    throw new Error('Not a Letterboxd export CSV');
  }
  const headers = parsed.headers ?? [];
  const nameIdx = indexOf(headers, NAME_HEADERS);
  const yearIdx = indexOf(headers, YEAR_HEADERS);
  const dateIdx = indexOf(headers, DATE_HEADERS);
  const uriIdx = indexOf(headers, URI_HEADERS);
  const imdbIdx = indexOf(headers, IMDB_HEADERS);
  const tmdbIdx = indexOf(headers, TMDB_HEADERS);
  const notesIdx = indexOf(headers, NOTES_HEADERS);
  const kind = kindHintFromFileName(fileName);

  const rows: ImportRow[] = [];
  for (const cells of parsed.rows) {
    const title = (nameIdx >= 0 ? cells[nameIdx] : '')?.trim() || '';
    if (!title) continue;
    const rating = ratingFromCells(cells, headers);
    // watchlist.csv "Date" is when added to the watchlist, not a watched date.
    const watchedDate =
      kind === 'watchlist' ? null : dateIdx >= 0 ? dateFromCell(cells[dateIdx] ?? '') : null;
    const itemStatus =
      kind === 'watched' || kind === 'ratings' || rating != null
        ? ('watched' as const)
        : ('want' as const);
    const tmdbRaw = tmdbIdx >= 0 ? Number((cells[tmdbIdx] ?? '').trim()) : NaN;
    rows.push(
      emptyImportRow({
        title,
        year: yearIdx >= 0 ? yearFromCell(cells[yearIdx] ?? '') : null,
        url: uriIdx >= 0 ? (cells[uriIdx] ?? '').trim() || null : null,
        imdbId: imdbIdx >= 0 ? normalizeImdbId(cells[imdbIdx]) : null,
        tmdbId: Number.isInteger(tmdbRaw) && tmdbRaw > 0 ? tmdbRaw : null,
        mediaType: 'movie',
        rating,
        watchedDate,
        itemStatus,
        notes: notesIdx >= 0 ? (cells[notesIdx] ?? '').trim() || null : null,
        status: 'ready',
        note: null,
      }),
    );
  }
  return rows;
}

function shouldParseZipEntry(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('__MACOSX') || normalized.startsWith('.')) return false;
  const base = normalized.split('/').pop() ?? normalized;
  return KNOWN_ZIP_FILES.test(base) || LIST_ZIP_FILE.test(normalized);
}

export async function parseLetterboxdZip(bytes: Uint8Array): Promise<{
  rows: ImportRow[];
  suggestedName: string;
  filesUsed: string[];
}> {
  const zip = await JSZip.loadAsync(bytes);
  const filesUsed: string[] = [];
  const byKey = new Map<string, ImportRow>();

  const entries = Object.keys(zip.files)
    .filter((path) => !zip.files[path]!.dir && shouldParseZipEntry(path))
    .sort((a, b) => {
      // Prefer watchlist, then watched, ratings, lists
      const rank = (path: string) => {
        const base = path.split('/').pop()?.toLowerCase() ?? '';
        if (base === 'watchlist.csv') return 0;
        if (base === 'watched.csv') return 1;
        if (base === 'ratings.csv') return 2;
        if (base === 'diary.csv') return 3;
        return 4;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  for (const path of entries) {
    const text = await zip.files[path]!.async('string');
    let parsed: ImportRow[];
    try {
      parsed = parseLetterboxdCsv(text, path);
    } catch {
      continue;
    }
    filesUsed.push(path);
    for (const row of parsed) {
      const key = row.imdbId
        ? `imdb:${row.imdbId}`
        : row.tmdbId != null
          ? `tmdb:${row.tmdbId}`
          : `title:${row.title.toLowerCase()}|${row.year ?? ''}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, row);
        continue;
      }
      // Merge: watched/rating wins over watchlist want
      byKey.set(key, {
        ...existing,
        ...row,
        title: existing.title || row.title,
        year: existing.year ?? row.year,
        imdbId: existing.imdbId ?? row.imdbId,
        tmdbId: existing.tmdbId ?? row.tmdbId,
        rating: row.rating ?? existing.rating,
        watchedDate: row.watchedDate ?? existing.watchedDate,
        itemStatus:
          row.itemStatus === 'watched' || existing.itemStatus === 'watched'
            ? 'watched'
            : (row.itemStatus ?? existing.itemStatus),
        notes: row.notes ?? existing.notes,
        url: existing.url ?? row.url,
      });
    }
  }

  if (byKey.size === 0) {
    throw new Error('No Letterboxd watchlist, watched, ratings, or list CSVs found in zip');
  }

  return {
    rows: [...byKey.values()],
    suggestedName: 'Letterboxd import',
    filesUsed,
  };
}

function detectLetterboxd(input: ListSourceInput) {
  const fileName = (input.fileName ?? '').toLowerCase();
  const mime = (input.mimeType ?? '').toLowerCase();
  if (fileName.endsWith('.zip') || mime.includes('zip')) return 'letterboxd-zip' as const;
  if (input.bytes && input.bytes.length >= 4 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b) {
    // ZIP without extension — treat as Letterboxd zip only when filename hints letterboxd
    if (fileName.includes('letterboxd') || fileName.includes('lb-')) return 'letterboxd-zip' as const;
  }
  const text = input.text?.replace(/^\uFEFF/, '') ?? null;
  if (!text) return null;
  if (!(fileName.endsWith('.csv') || mime.includes('csv') || text.includes(','))) return null;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const headers = firstLine.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim());
  if (looksLikeLetterboxdCsv(headers, input.fileName)) return 'letterboxd-csv' as const;
  return null;
}

registerListSourceDetector({ id: 'letterboxd', detect: detectLetterboxd });
