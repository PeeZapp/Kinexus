import { headerKey } from '../csv';
import { emptyImportRow, type ColumnMapping, type ImportField, type ImportRow, type KinexusListKind } from './types';

const FIELD_ALIASES: Record<ImportField, string[]> = {
  title: ['title', 'name', 'item', 'product', 'movie', 'show', 'exercise', 'task', 'ingredient', 'film'],
  year: ['year', 'release year', 'release_year', 'aired'],
  quantity: ['quantity', 'qty', 'amount', 'count'],
  notes: ['notes', 'note', 'comment', 'comments', 'description', 'memo'],
  url: ['url', 'link', 'source', 'source url', 'source_url', 'href', 'website'],
  price: ['price', 'cost', 'current price', 'current_price', 'amount paid'],
  sets: ['sets', 'target sets', 'target_sets'],
  reps: ['reps', 'rep', 'target reps', 'target_reps', 'repetitions'],
  weight: ['weight', 'kg', 'lb', 'lbs', 'target weight', 'target_weight'],
  duration: ['duration', 'time', 'duration_seconds', 'duration seconds', 'seconds', 'sec'],
  distance: ['distance', 'distance_km', 'distance km', 'distance_miles', 'distance miles', 'km', 'miles', 'mi'],
  tmdbId: ['tmdb', 'tmdb id', 'tmdb_id', 'tmdbid'],
  mediaType: ['media', 'media type', 'media_type', 'type', 'kind'],
  imdbId: ['imdb', 'imdb id', 'imdb_id', 'imdbid', 'const', 'tconst'],
  rating: ['rating', 'score', 'your rating', 'rating10'],
  watchedDate: ['watched date', 'watcheddate', 'date watched', 'date rated', 'watched'],
  itemStatus: ['status', 'item status', 'item_status', 'watch status'],
  skip: [],
};

export function guessColumnMapping(headers: readonly string[] | null | undefined): ColumnMapping {
  const mapping: ColumnMapping = {};
  if (!headers || headers.length === 0) return mapping;
  const used = new Set<ImportField>();
  headers.forEach((header, index) => {
    const key = headerKey(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [ImportField, string[]][]) {
      if (field === 'skip' || used.has(field)) continue;
      if (aliases.includes(key)) {
        mapping[index] = field;
        used.add(field);
        return;
      }
    }
    mapping[index] = 'skip';
  });
  if (![...Object.values(mapping)].includes('title') && headers.length > 0) {
    mapping[0] = 'title';
  }
  return mapping;
}

export function defaultHeadersForKind(kind: KinexusListKind): string[] {
  switch (kind) {
    case 'watchlist':
      return ['title', 'year', 'tmdb_id', 'media_type', 'notes'];
    case 'workout':
      return ['title', 'sets', 'reps', 'weight', 'duration', 'distance', 'notes'];
    case 'wishlist':
      return ['title', 'url', 'price', 'notes'];
    case 'shopping':
      return ['title', 'quantity', 'notes'];
    case 'checklist':
      return ['title', 'notes'];
    case 'readlist':
      return ['title', 'author', 'isbn13', 'notes'];
  }
}

function asInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asFloat(raw: string): number | null {
  const trimmed = raw.trim().replace(/[^\d.+-]/g, '');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function rowFromCells(
  cells: readonly string[],
  mapping: ColumnMapping,
  headers?: readonly string[] | null,
): ImportRow {
  const row = emptyImportRow();
  for (const [indexRaw, field] of Object.entries(mapping)) {
    const index = Number(indexRaw);
    const value = (cells[index] ?? '').trim();
    if (!value || field === 'skip') continue;
    const headerKeyValue = headerKey(headers?.[index] ?? '');
    switch (field) {
      case 'title':
        row.title = value;
        break;
      case 'year':
        row.year = asInt(value);
        break;
      case 'quantity':
        row.quantity = value;
        break;
      case 'notes':
        row.notes = value;
        break;
      case 'url':
        row.url = value;
        break;
      case 'price':
        row.price = value.replace(/^\$/, '');
        break;
      case 'sets':
        row.sets = asInt(value);
        break;
      case 'reps':
        row.reps = value;
        break;
      case 'weight':
        row.weight = asFloat(value);
        break;
      case 'duration': {
        const n = asFloat(value);
        if (n == null || n < 0) break;
        // Bare small numbers: treat as minutes; large / explicit seconds stay seconds.
        const lower = value.toLowerCase();
        if (/\b(min|mins|minutes|m)\b/.test(lower) && !/\b(sec|secs|seconds|s)\b/.test(lower)) {
          row.durationSec = Math.round(n * 60);
        } else if (/\b(sec|secs|seconds)\b/.test(lower) || n > 180) {
          row.durationSec = Math.round(n);
        } else {
          row.durationSec = Math.round(n);
        }
        break;
      }
      case 'distance': {
        const n = asFloat(value);
        if (n == null || n < 0) break;
        const lower = value.toLowerCase();
        const milesHeader =
          headerKeyValue.includes('mile') ||
          headerKeyValue.endsWith('_mi') ||
          headerKeyValue === 'miles' ||
          headerKeyValue === 'mi';
        if (milesHeader || /\b(mi|mile|miles)\b/.test(lower)) {
          row.distanceKm = Math.round(n * 1.609344 * 1000) / 1000;
        } else if (/\bm\b/.test(lower) && !/\b(min|mi|mile|km)\b/.test(lower)) {
          row.distanceKm = Math.round((n / 1000) * 1000) / 1000;
        } else {
          row.distanceKm = Math.round(n * 1000) / 1000;
        }
        break;
      }
      case 'tmdbId':
        row.tmdbId = asInt(value);
        break;
      case 'imdbId': {
        const match = value.match(/^(tt)?(\d{5,10})$/i);
        row.imdbId = match ? `tt${match[2]}` : value;
        break;
      }
      case 'rating': {
        const n = Number(value.replace(/,/g, ''));
        if (!Number.isFinite(n) || n <= 0) break;
        if (n <= 5) row.rating = Math.round(n * 2);
        else row.rating = Math.round(n);
        if (row.rating != null && (row.rating < 1 || row.rating > 10)) row.rating = null;
        break;
      }
      case 'watchedDate': {
        const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
        row.watchedDate = iso?.[1] ?? value.slice(0, 10);
        break;
      }
      case 'itemStatus': {
        const lower = value.toLowerCase();
        row.itemStatus =
          lower === 'watched' || lower === 'watching' || lower === 'want'
            ? lower
            : lower === 'seen' || lower === 'completed'
              ? 'watched'
              : null;
        break;
      }
      case 'mediaType': {
        const lower = value.toLowerCase();
        row.mediaType = lower === 'tv' || lower === 'show' || lower === 'series' ? 'tv' : lower === 'movie' || lower === 'film' ? 'movie' : null;
        break;
      }
    }
  }
  if (!row.title) {
    row.status = 'invalid';
    row.note = 'Missing title';
  } else {
    row.status = 'ready';
  }
  return row;
}

export function rowsFromMatrix(
  matrix: readonly (readonly string[])[],
  mapping: ColumnMapping,
  opts?: { hasHeader?: boolean },
): ImportRow[] {
  const start = opts?.hasHeader === false ? 0 : 1;
  const headers = opts?.hasHeader === false ? null : matrix[0] ?? null;
  const data = opts?.hasHeader === false ? matrix : matrix.slice(start);
  return data
    .map((cells) => rowFromCells(cells, mapping, headers))
    .filter((row) => row.title || row.status !== 'invalid');
}
