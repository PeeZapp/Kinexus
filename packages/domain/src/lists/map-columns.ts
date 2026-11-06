import { headerKey } from '../csv';
import type { ColumnMapping, ImportField, ImportRow, KinexusListKind } from './types';

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
  tmdbId: ['tmdb', 'tmdb id', 'tmdb_id', 'tmdbid'],
  mediaType: ['media', 'media type', 'media_type', 'type', 'kind'],
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
      return ['title', 'sets', 'reps', 'weight', 'notes'];
    case 'wishlist':
      return ['title', 'url', 'price', 'notes'];
    case 'shopping':
      return ['title', 'quantity', 'notes'];
    case 'checklist':
      return ['title', 'notes'];
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

function emptyRow(): ImportRow {
  return {
    title: '',
    year: null,
    quantity: null,
    notes: null,
    url: null,
    price: null,
    sets: null,
    reps: null,
    weight: null,
    tmdbId: null,
    mediaType: null,
    status: 'invalid',
    note: null,
  };
}

export function rowFromCells(cells: readonly string[], mapping: ColumnMapping): ImportRow {
  const row = emptyRow();
  for (const [indexRaw, field] of Object.entries(mapping)) {
    const index = Number(indexRaw);
    const value = (cells[index] ?? '').trim();
    if (!value || field === 'skip') continue;
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
      case 'tmdbId':
        row.tmdbId = asInt(value);
        break;
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
  const data = opts?.hasHeader === false ? matrix : matrix.slice(start);
  return data
    .map((cells) => rowFromCells(cells, mapping))
    .filter((row) => row.title || row.status !== 'invalid');
}
