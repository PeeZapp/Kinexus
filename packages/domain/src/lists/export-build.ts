import { serializeCsv } from '../csv';
import type { WeightUnit } from '../train/units';
import { formatWeight } from '../train/units';
import { scoreToLetterboxdRating } from './match-confidence';
import { defaultHeadersForKind } from './map-columns';
import { buildXlsxBytes } from './parse-xlsx';
import {
  KINEXUS_EXPORT_VERSION,
  type BuiltExport,
  type KinexusExport,
  type KinexusExportItem,
  type KinexusListKind,
  type ListExportFormat,
} from './types';

export type ExportListInput = {
  kind: KinexusListKind;
  listName: string;
  listId?: string | null;
  items: KinexusExportItem[];
  weightUnit?: WeightUnit;
  /** When exporting workouts, convert stored kg into display unit for CSV/text/xlsx. */
  storedWeightIsKg?: boolean;
};

function safeFileBase(name: string): string {
  return (name.trim() || 'list').replace(/[^\w\-]+/g, '_').slice(0, 60);
}

function displayItems(input: ExportListInput): KinexusExportItem[] {
  if (input.kind !== 'workout' || !input.storedWeightIsKg || !input.weightUnit) return input.items;
  return input.items.map((item) => ({
    ...item,
    weight:
      item.weight == null || !Number.isFinite(item.weight)
        ? item.weight ?? null
        : formatWeight(item.weight, input.weightUnit!),
  }));
}

export function buildKinexusExport(input: ExportListInput, exportedAt = new Date().toISOString()): KinexusExport {
  const items = displayItems(input);
  return {
    kinexusExport: KINEXUS_EXPORT_VERSION,
    kind: input.kind,
    exportedAt,
    list: { name: input.listName, id: input.listId ?? null },
    items,
    ...(input.kind === 'workout' && input.weightUnit ? { weightUnit: input.weightUnit } : {}),
  };
}

function matrixFor(input: ExportListInput): string[][] {
  const headers = defaultHeadersForKind(input.kind);
  const items = displayItems(input);
  const rows = items.map((item) =>
    headers.map((header) => {
      switch (header) {
        case 'title':
          return item.title ?? '';
        case 'year':
          return item.year != null ? String(item.year) : '';
        case 'tmdb_id':
          return item.tmdbId != null ? String(item.tmdbId) : '';
        case 'media_type':
          return item.mediaType ?? '';
        case 'notes':
          return item.notes ?? '';
        case 'url':
          return item.url ?? '';
        case 'price':
          return item.price ?? '';
        case 'quantity':
          return item.quantity ?? '';
        case 'sets':
          return item.sets != null ? String(item.sets) : '';
        case 'reps':
          return item.reps ?? '';
        case 'weight':
          return item.weight != null ? String(item.weight) : '';
        default:
          return '';
      }
    }),
  );
  return [headers, ...rows];
}

function textFor(input: ExportListInput): string {
  const items = displayItems(input);
  return items
    .map((item) => {
      if (input.kind === 'shopping' && item.quantity) return `${item.quantity}x ${item.title}`;
      if (input.kind === 'workout') {
        const parts = [item.title];
        if (item.sets != null) parts.push(`${item.sets} sets`);
        if (item.reps) parts.push(`${item.reps} reps`);
        if (item.weight != null && input.weightUnit) parts.push(`${item.weight} ${input.weightUnit}`);
        else if (item.weight != null) parts.push(String(item.weight));
        return parts.join(' · ');
      }
      if (item.url) return `${item.title}\t${item.url}`;
      return item.title;
    })
    .join('\n');
}

/**
 * Letterboxd-import-compatible CSV.
 * Columns per https://letterboxd.com/about/importing-data/ (Title, Year, imdbID, Rating, WatchedDate).
 * Rating is Letterboxd’s 0.5–5 scale; WatchedDate is YYYY-MM-DD when known.
 */
export function buildLetterboxdImportCsv(input: ExportListInput): BuiltExport {
  if (input.kind !== 'watchlist') {
    throw new Error('Letterboxd CSV export is only available for watchlists');
  }
  const headers = ['Title', 'Year', 'imdbID', 'Rating', 'WatchedDate'];
  const rows = displayItems(input).map((item) => {
    const rating = item.rating != null ? scoreToLetterboxdRating(item.rating) : null;
    const watchedDate =
      item.watchedDate ??
      (item.itemStatus === 'watched' ? null : null);
    return [
      item.title ?? '',
      item.year != null ? String(item.year) : '',
      item.imdbId ?? '',
      rating != null ? String(rating) : '',
      watchedDate ?? '',
    ];
  });
  const base = safeFileBase(input.listName);
  return {
    fileName: `${base}-letterboxd.csv`,
    mimeType: 'text/csv',
    text: `${serializeCsv([headers, ...rows])}\n`,
    bytes: null,
  };
}

export function buildListExport(input: ExportListInput, format: ListExportFormat): BuiltExport {
  const base = safeFileBase(input.listName);
  if (format === 'letterboxd-csv') {
    return buildLetterboxdImportCsv(input);
  }
  if (format === 'goodreads-csv') {
    throw new Error('Goodreads CSV export uses /readlist/export');
  }
  if (format === 'json') {
    const payload = buildKinexusExport(input);
    return {
      fileName: `${base}.json`,
      mimeType: 'application/json',
      text: `${JSON.stringify(payload, null, 2)}\n`,
      bytes: null,
    };
  }
  if (format === 'csv') {
    return {
      fileName: `${base}.csv`,
      mimeType: 'text/csv',
      text: `${serializeCsv(matrixFor(input))}\n`,
      bytes: null,
    };
  }
  if (format === 'text') {
    return {
      fileName: `${base}.txt`,
      mimeType: 'text/plain',
      text: `${textFor(input)}\n`,
      bytes: null,
    };
  }
  const bytes = buildXlsxBytes(matrixFor(input), input.listName);
  return {
    fileName: `${base}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    text: null,
    bytes,
  };
}
