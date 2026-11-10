import { parseCsv } from '../csv';
import type { WeightUnit } from '../train/units';
import { detectListSource, type ListSourceInput } from './detect';
import { classifyMatchConfidence } from './match-confidence';
import { guessColumnMapping, rowFromCells, rowsFromMatrix } from './map-columns';
import { parseDocxBytes } from './parse-docx';
import { parseHevyCsv } from './parse-hevy';
import { parseImdbCsv } from './parse-imdb';
import { parseLetterboxdCsv, parseLetterboxdZip } from './parse-letterboxd';
import { parseStrongCsv } from './parse-strong';
import { parsePlainTextList } from './parse-text';
import { parseXlsxMatrix } from './parse-xlsx';
import {
  refreshWorkoutImportPlan,
  routinesFromSessions,
  routinesToRows,
} from './workout-import';
import {
  emptyImportRow,
  KINEXUS_EXPORT_VERSION,
  type ColumnMapping,
  type ImportApplySummary,
  type ImportMatchCandidate,
  type ImportPlan,
  type ImportRow,
  type KinexusExport,
  type KinexusListKind,
  type ListSourceFormat,
} from './types';

export type ExistingDedupeItem = {
  title: string;
  url?: string | null;
  tmdbId?: number | null;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function dedupeKey(kind: KinexusListKind, row: { title: string; url?: string | null; tmdbId?: number | null }): string | null {
  if (kind === 'watchlist') {
    return row.tmdbId != null ? `tmdb:${row.tmdbId}` : null;
  }
  if (kind === 'wishlist') {
    return `name-url:${normalizeName(row.title)}|${normalizeUrl(row.url)}`;
  }
  if (kind === 'readlist') {
    return `name:${normalizeName(row.title)}`;
  }
  return `name:${normalizeName(row.title)}`;
}

export function applyDedupeStatus(
  kind: KinexusListKind,
  rows: ImportRow[],
  existing: readonly ExistingDedupeItem[],
): ImportRow[] {
  const existingKeys = new Set(
    existing
      .map((item) => dedupeKey(kind, item))
      .filter((key): key is string => Boolean(key)),
  );
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.status === 'invalid') return row;
    if (kind === 'watchlist' && row.tmdbId == null) {
      return {
        ...row,
        status: 'needsMatch',
        note: row.note ?? 'Needs TMDB match',
      };
    }
    const key = dedupeKey(kind, row);
    if (!key) return row;
    if (existingKeys.has(key) || seen.has(key)) {
      return { ...row, status: 'duplicate', note: 'Already on list' };
    }
    seen.add(key);
    return { ...row, status: 'ready', note: null };
  });
}

export function parseKinexusJson(text: string): { export: KinexusExport; rows: ImportRow[] } {
  const parsed = JSON.parse(text) as KinexusExport;
  if (typeof parsed?.kinexusExport !== 'number') {
    throw new Error('Not a Kinexus export file');
  }
  if (parsed.kinexusExport > KINEXUS_EXPORT_VERSION) {
    throw new Error(`Unsupported export version ${parsed.kinexusExport}`);
  }
  const rows: ImportRow[] = (parsed.items ?? []).map((item) =>
    emptyImportRow({
      title: (item.title ?? '').trim(),
      year: item.year ?? null,
      quantity: item.quantity ?? null,
      notes: item.notes ?? null,
      url: item.url ?? null,
      price: item.price ?? null,
      sets: item.sets ?? null,
      reps: item.reps ?? null,
      weight: item.weight ?? null,
      tmdbId: item.tmdbId ?? null,
      mediaType: item.mediaType ?? null,
      imdbId: item.imdbId ?? null,
      itemStatus: item.itemStatus ?? null,
      rating: item.rating ?? null,
      watchedDate: item.watchedDate ?? null,
      status: (item.title ?? '').trim() ? 'ready' : 'invalid',
      note: (item.title ?? '').trim() ? null : 'Missing title',
    }),
  );
  return { export: parsed, rows };
}

function suggestedNameFrom(fileName: string | null | undefined, fallback: string): string {
  if (!fileName) return fallback;
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || fallback;
}

function kindFromFormat(format: ListSourceFormat, jsonKind: KinexusListKind | null): KinexusListKind | null {
  if (format === 'imdb-csv' || format === 'letterboxd-csv' || format === 'letterboxd-zip') return 'watchlist';
  if (format === 'hevy-csv' || format === 'strong-csv') return 'workout';
  if (format === 'goodreads-csv') return 'readlist';
  return jsonKind;
}

function isWorkoutExportFormat(format: ListSourceFormat): boolean {
  return format === 'hevy-csv' || format === 'strong-csv';
}

export type MatchResultInput = {
  /** Index into plan.rows */
  index: number;
  confidence: number;
  match: {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    year: number | null;
    posterPath?: string | null;
    imdbId?: string | null;
  } | null;
  candidates?: ImportMatchCandidate[] | null;
};

/** Apply server match results onto needsMatch rows (auto-accept high confidence). */
export function applyMatchResults(plan: ImportPlan, results: readonly MatchResultInput[]): ImportPlan {
  if (!plan.kind || plan.kind !== 'watchlist') return plan;
  const rows = plan.rows.map((row, index) => {
    const hit = results.find((result) => result.index === index);
    if (!hit || row.status === 'invalid' || row.status === 'duplicate') return row;
    const candidates = hit.candidates ?? null;
    if (!hit.match) {
      const next: ImportRow = {
        ...row,
        status: 'needsMatch',
        note: 'No match — search manually',
        matchConfidence: hit.confidence,
        candidates,
      };
      return next;
    }
    const band = classifyMatchConfidence(hit.confidence);
    if (band === 'auto') {
      const next: ImportRow = {
        ...row,
        title: hit.match.title || row.title,
        year: hit.match.year ?? row.year,
        tmdbId: hit.match.tmdbId,
        mediaType: hit.match.mediaType,
        imdbId: hit.match.imdbId ?? row.imdbId,
        status: 'ready',
        note: null,
        matchConfidence: hit.confidence,
        candidates: null,
      };
      return next;
    }
    if (band === 'confirm') {
      const next: ImportRow = {
        ...row,
        status: 'needsMatch',
        note: 'Needs confirmation',
        matchConfidence: hit.confidence,
        candidates:
          candidates && candidates.length > 0
            ? candidates
            : [
                {
                  tmdbId: hit.match.tmdbId,
                  mediaType: hit.match.mediaType,
                  title: hit.match.title,
                  year: hit.match.year,
                  posterPath: hit.match.posterPath ?? null,
                  imdbId: hit.match.imdbId ?? null,
                  confidence: hit.confidence,
                },
              ],
      };
      return next;
    }
    const next: ImportRow = {
      ...row,
      status: 'needsMatch',
      note: 'No confident match — search manually',
      matchConfidence: hit.confidence,
      candidates,
    };
    return next;
  });
  return { ...plan, rows: applyDedupeStatus(plan.kind, rows, []) };
}

export function acceptImportMatch(
  plan: ImportPlan,
  index: number,
  candidate: ImportMatchCandidate,
  existing: readonly ExistingDedupeItem[] = [],
): ImportPlan {
  if (!plan.kind) return plan;
  const rows = plan.rows.map((row, i) => {
    if (i !== index) return row;
    return {
      ...row,
      title: candidate.title || row.title,
      year: candidate.year ?? row.year,
      tmdbId: candidate.tmdbId,
      mediaType: candidate.mediaType,
      imdbId: candidate.imdbId ?? row.imdbId,
      status: 'ready' as const,
      note: null,
      matchConfidence: candidate.confidence,
      candidates: null,
    };
  });
  return { ...plan, rows: applyDedupeStatus(plan.kind, rows, existing) };
}

export async function buildImportPlan(
  input: ListSourceInput & { kindHint?: KinexusListKind | null; weightUnit?: WeightUnit | null },
): Promise<ImportPlan> {
  const format = detectListSource(input);
  let kind: KinexusListKind | null = input.kindHint ?? null;
  let suggestedName = suggestedNameFrom(input.fileName, 'Imported list');
  let headers: string[] | null = null;
  let mapping: ColumnMapping = {};
  let rows: ImportRow[] = [];
  let weightUnit: WeightUnit | null = input.weightUnit ?? null;
  let matrix: string[][] | null = null;
  let workoutSessions: ImportPlan['workoutSessions'] = null;
  let workoutRoutines: ImportPlan['workoutRoutines'] = null;
  let sourceWeightUnit: WeightUnit | null = null;
  let supportsHistory = false;
  let customExercisesSupported = false;

  if (format === 'kinexus-json') {
    const text = input.text?.trim();
    if (!text) throw new Error('Empty JSON');
    const parsed = parseKinexusJson(text);
    kind = parsed.export.kind;
    suggestedName = parsed.export.list?.name?.trim() || suggestedName;
    rows = parsed.rows;
    weightUnit = parsed.export.weightUnit ?? weightUnit;
  } else if (format === 'imdb-csv') {
    rows = parseImdbCsv(input.text ?? '');
    kind = 'watchlist';
    suggestedName = suggestedNameFrom(input.fileName, 'IMDb import');
  } else if (format === 'letterboxd-csv') {
    rows = parseLetterboxdCsv(input.text ?? '', input.fileName);
    kind = 'watchlist';
    suggestedName = suggestedNameFrom(input.fileName, 'Letterboxd import');
  } else if (format === 'letterboxd-zip') {
    if (!input.bytes) throw new Error('Zip bytes required');
    const parsed = await parseLetterboxdZip(input.bytes);
    rows = parsed.rows;
    kind = 'watchlist';
    suggestedName = suggestedNameFrom(input.fileName, parsed.suggestedName);
  } else if (format === 'hevy-csv') {
    const parsed = parseHevyCsv(input.text ?? '');
    kind = 'workout';
    suggestedName = suggestedNameFrom(input.fileName, 'Hevy import');
    sourceWeightUnit = parsed.sourceWeightUnit;
    weightUnit = parsed.sourceWeightUnit;
    workoutSessions = parsed.sessions;
    workoutRoutines = routinesFromSessions(parsed.sessions);
    rows = routinesToRows(workoutRoutines);
    supportsHistory = true;
    customExercisesSupported = false;
  } else if (format === 'strong-csv') {
    const parsed = parseStrongCsv(input.text ?? '', { fallbackWeightUnit: input.weightUnit ?? 'kg' });
    kind = 'workout';
    suggestedName = suggestedNameFrom(input.fileName, 'Strong import');
    sourceWeightUnit = parsed.sourceWeightUnit;
    weightUnit = parsed.sourceWeightUnit;
    workoutSessions = parsed.sessions;
    workoutRoutines = routinesFromSessions(parsed.sessions);
    rows = routinesToRows(workoutRoutines);
    supportsHistory = true;
    customExercisesSupported = false;
  } else if (format === 'csv' || format === 'tsv') {
    const text = input.text ?? '';
    const parsed = parseCsv(text, { delimiter: format === 'tsv' ? '\t' : undefined });
    headers = parsed.headers;
    mapping = guessColumnMapping(headers);
    matrix = parsed.allRows;
    rows = rowsFromMatrix(parsed.allRows, mapping, { hasHeader: Boolean(headers) });
  } else if (format === 'xlsx' || format === 'xls') {
    if (!input.bytes) throw new Error('Spreadsheet bytes required');
    matrix = parseXlsxMatrix(input.bytes);
    headers = matrix[0] ?? null;
    mapping = guessColumnMapping(headers);
    rows = rowsFromMatrix(matrix, mapping, { hasHeader: Boolean(headers) });
  } else if (format === 'docx') {
    if (!input.bytes) throw new Error('Document bytes required');
    rows = await parseDocxBytes(input.bytes);
  } else if (format === 'text') {
    rows = parsePlainTextList(input.text ?? '');
  } else {
    throw new Error('Could not detect a supported list format');
  }

  kind = kindFromFormat(format, kind) ?? kind;

  if (kind && !isWorkoutExportFormat(format)) {
    rows = applyDedupeStatus(kind, rows, []);
  }

  const plan: ImportPlan = {
    format,
    kind,
    suggestedName,
    headers,
    mapping,
    rows,
    weightUnit,
    matrix,
    workoutSessions,
    workoutRoutines,
    sourceWeightUnit,
    supportsHistory,
    importHistory: false,
    customExercisesSupported,
  };

  if (isWorkoutExportFormat(format)) {
    return refreshWorkoutImportPlan(plan, [], []);
  }
  return plan;
}

export function remapImportPlan(plan: ImportPlan, mapping: ColumnMapping, matrix: readonly (readonly string[])[]): ImportPlan {
  const rows = rowsFromMatrix(matrix, mapping, { hasHeader: Boolean(plan.headers) });
  return {
    ...plan,
    mapping,
    rows: plan.kind ? applyDedupeStatus(plan.kind, rows, []) : rows,
  };
}

export function refreshImportPlanRows(
  plan: ImportPlan,
  existing: readonly ExistingDedupeItem[],
): ImportPlan {
  if (!plan.kind) return plan;
  return { ...plan, rows: applyDedupeStatus(plan.kind, plan.rows, existing) };
}

export function summarizeImportRows(rows: readonly ImportRow[]): Omit<ImportApplySummary, 'cancelled'> {
  let imported = 0;
  let skippedDuplicate = 0;
  let skippedNeedsMatch = 0;
  let skippedInvalid = 0;
  for (const row of rows) {
    if (row.status === 'ready') imported += 1;
    else if (row.status === 'duplicate') skippedDuplicate += 1;
    else if (row.status === 'needsMatch') skippedNeedsMatch += 1;
    else skippedInvalid += 1;
  }
  return { imported, skippedDuplicate, skippedNeedsMatch, skippedInvalid };
}

export function importRowsToExportItems(rows: readonly ImportRow[]) {
  return rows
    .filter((row) => row.status === 'ready' || row.status === 'needsMatch' || row.status === 'duplicate')
    .map((row) => ({
      title: row.title,
      year: row.year,
      quantity: row.quantity,
      notes: row.notes,
      url: row.url,
      price: row.price,
      sets: row.sets,
      reps: row.reps,
      weight: row.weight,
      tmdbId: row.tmdbId,
      mediaType: row.mediaType,
      imdbId: row.imdbId,
      itemStatus: row.itemStatus,
      rating: row.rating,
      watchedDate: row.watchedDate,
    }));
}

/** Apply ready rows only; caller performs writes. */
export async function applyImportRows(
  rows: readonly ImportRow[],
  writeOne: (row: ImportRow) => Promise<void>,
  opts?: { signal?: { cancelled: boolean }; onProgress?: (done: number, total: number) => void },
): Promise<ImportApplySummary> {
  const ready = rows.filter((row) => row.status === 'ready');
  const base = summarizeImportRows(rows);
  let imported = 0;
  for (let i = 0; i < ready.length; i++) {
    if (opts?.signal?.cancelled) {
      return {
        imported,
        skippedDuplicate: base.skippedDuplicate,
        skippedNeedsMatch: base.skippedNeedsMatch,
        skippedInvalid: base.skippedInvalid + (ready.length - imported),
        cancelled: true,
      };
    }
    await writeOne(ready[i]!);
    imported += 1;
    opts?.onProgress?.(imported, ready.length);
  }
  return {
    imported,
    skippedDuplicate: base.skippedDuplicate,
    skippedNeedsMatch: base.skippedNeedsMatch,
    skippedInvalid: base.skippedInvalid,
    cancelled: false,
  };
}

export function cellsFromMappingPreview(row: ImportRow, mapping: ColumnMapping, headerCount: number): string[] {
  const fields = Object.entries(mapping)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, field]) => field);
  const width = Math.max(headerCount, fields.length);
  const cells = Array.from({ length: width }, () => '');
  for (const [indexRaw, field] of Object.entries(mapping)) {
    const index = Number(indexRaw);
    switch (field) {
      case 'title':
        cells[index] = row.title;
        break;
      case 'year':
        cells[index] = row.year != null ? String(row.year) : '';
        break;
      case 'quantity':
        cells[index] = row.quantity ?? '';
        break;
      case 'notes':
        cells[index] = row.notes ?? '';
        break;
      case 'url':
        cells[index] = row.url ?? '';
        break;
      case 'price':
        cells[index] = row.price ?? '';
        break;
      case 'sets':
        cells[index] = row.sets != null ? String(row.sets) : '';
        break;
      case 'reps':
        cells[index] = row.reps ?? '';
        break;
      case 'weight':
        cells[index] = row.weight != null ? String(row.weight) : '';
        break;
      case 'tmdbId':
        cells[index] = row.tmdbId != null ? String(row.tmdbId) : '';
        break;
      case 'mediaType':
        cells[index] = row.mediaType ?? '';
        break;
      case 'imdbId':
        cells[index] = row.imdbId ?? '';
        break;
      case 'rating':
        cells[index] = row.rating != null ? String(row.rating) : '';
        break;
      case 'watchedDate':
        cells[index] = row.watchedDate ?? '';
        break;
      case 'itemStatus':
        cells[index] = row.itemStatus ?? '';
        break;
    }
  }
  return cells;
}

export { rowFromCells };
