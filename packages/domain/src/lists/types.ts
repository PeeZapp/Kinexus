import type { WeightUnit } from '../train/units';

export const KINEXUS_EXPORT_VERSION = 1 as const;

export type KinexusListKind = 'watchlist' | 'workout' | 'wishlist' | 'shopping' | 'checklist';

export type ListSourceFormat =
  | 'kinexus-json'
  | 'csv'
  | 'tsv'
  | 'xlsx'
  | 'xls'
  | 'docx'
  | 'text'
  | 'unknown';

/** Fields that can be mapped from tabular columns. */
export type ImportField =
  | 'title'
  | 'year'
  | 'quantity'
  | 'notes'
  | 'url'
  | 'price'
  | 'sets'
  | 'reps'
  | 'weight'
  | 'tmdbId'
  | 'mediaType'
  | 'skip';

export type ImportRowStatus = 'ready' | 'duplicate' | 'needsMatch' | 'invalid';

export type ImportRow = {
  title: string;
  year: number | null;
  quantity: string | null;
  notes: string | null;
  url: string | null;
  price: string | null;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  status: ImportRowStatus;
  note: string | null;
};

export type KinexusExportList = {
  name: string;
  id?: string | null;
};

export type KinexusExportItem = {
  title: string;
  year?: number | null;
  quantity?: string | null;
  notes?: string | null;
  url?: string | null;
  price?: string | null;
  sets?: number | null;
  reps?: string | null;
  weight?: number | null;
  tmdbId?: number | null;
  mediaType?: 'movie' | 'tv' | null;
};

export type KinexusExport = {
  kinexusExport: typeof KINEXUS_EXPORT_VERSION;
  kind: KinexusListKind;
  exportedAt: string;
  list: KinexusExportList;
  items: KinexusExportItem[];
  weightUnit?: WeightUnit;
};

export type ColumnMapping = Record<number, ImportField>;

export type ImportPlan = {
  format: ListSourceFormat;
  kind: KinexusListKind | null;
  suggestedName: string;
  headers: string[] | null;
  mapping: ColumnMapping;
  rows: ImportRow[];
  weightUnit: WeightUnit | null;
  /** Raw tabular matrix when format is csv/tsv/xlsx (includes header row). */
  matrix?: string[][] | null;
};

export type ImportApplySummary = {
  imported: number;
  skippedDuplicate: number;
  skippedNeedsMatch: number;
  skippedInvalid: number;
  cancelled: boolean;
};

export type ListExportFormat = 'json' | 'csv' | 'xlsx' | 'text';

export type BuiltExport = {
  fileName: string;
  mimeType: string;
  /** UTF-8 text for json/csv/text; base64 for xlsx when encoding as string. */
  text: string | null;
  bytes: Uint8Array | null;
};
