import type { EffortLevel } from '../train/effort';
import type { WeightUnit } from '../train/units';
import type { WatchlistItemStatus } from '../stash/types';

export const KINEXUS_EXPORT_VERSION = 1 as const;

export type KinexusListKind = 'watchlist' | 'workout' | 'wishlist' | 'shopping' | 'checklist' | 'readlist';

export type ListSourceFormat =
  | 'kinexus-json'
  | 'csv'
  | 'tsv'
  | 'xlsx'
  | 'xls'
  | 'docx'
  | 'text'
  | 'imdb-csv'
  | 'letterboxd-csv'
  | 'letterboxd-zip'
  | 'hevy-csv'
  | 'hevy-link'
  | 'strong-csv'
  | 'goodreads-csv'
  | 'unknown';

export type ListExportFormat = 'json' | 'csv' | 'xlsx' | 'text' | 'letterboxd-csv' | 'goodreads-csv';
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
  | 'duration'
  | 'distance'
  | 'tmdbId'
  | 'mediaType'
  | 'imdbId'
  | 'rating'
  | 'watchedDate'
  | 'itemStatus'
  | 'skip';

export type ImportRowStatus = 'ready' | 'duplicate' | 'needsMatch' | 'invalid';

export type ImportMatchCandidate = {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number | null;
  posterPath: string | null;
  imdbId: string | null;
  confidence: number;
};

/** Catalogue exercise candidate for Hevy/Strong imports. */
export type ExerciseMatchCandidate = {
  exerciseId: string;
  name: string;
  confidence: number;
};

export type WorkoutImportSet = {
  reps: string | null;
  /** Stored kg. */
  weightKg: number | null;
  distanceM: number | null;
  durationSec: number | null;
  rpe: number | null;
  setType: string | null;
};

export type WorkoutImportExercise = {
  name: string;
  exerciseId: string | null;
  matchConfidence: number | null;
  candidates: ExerciseMatchCandidate[] | null;
  status: ImportRowStatus;
  note: string | null;
  sets: WorkoutImportSet[];
  tracking?: 'reps' | 'time' | 'intervals' | 'distance';
  targetUnit?: 'reps' | 'sec' | 'min' | 'km' | 'm';
  targetSets: number;
  targetReps: string;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  /** Stored kg. */
  targetWeightKg: number | null;
  targetRpe: number | null;
  /** Load/Effort for Hevy link import (and similar). */
  targetEffort?: EffortLevel | null;
  /** matched / likely / missing for link-import review. */
  matchStatus?: 'matched' | 'likely' | 'missing';
  /** When true, Import creates a personal custom exercise. */
  willCreateCustom?: boolean;
  sourceName?: string;
};

export type WorkoutImportSession = {
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  description: string | null;
  exercises: WorkoutImportExercise[];
  status: ImportRowStatus;
  note: string | null;
};

/** One routine template derived from distinct workout names in an export. */
export type WorkoutImportRoutine = {
  name: string;
  durationMin: number | null;
  exercises: WorkoutImportExercise[];
  status: ImportRowStatus;
  note: string | null;
  /** How many logged sessions share this name in the file. */
  sessionCount: number;
};

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
  /** Duration seconds when mapped from a duration/time column. */
  durationSec: number | null;
  /** Distance in km when mapped from a distance column (miles converted). */
  distanceKm: number | null;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  /** IMDb id (tt…); used for TMDB /find matching. */
  imdbId: string | null;
  /** Want / watching / watched when the source carries it. */
  itemStatus: WatchlistItemStatus | null;
  /** Kinexus 1–10 score when the source carries a rating. */
  rating: number | null;
  /** YYYY-MM-DD when known (Letterboxd diary / watched date). */
  watchedDate: string | null;
  status: ImportRowStatus;
  note: string | null;
  matchConfidence: number | null;
  candidates: ImportMatchCandidate[] | null;
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
  imdbId?: string | null;
  itemStatus?: WatchlistItemStatus | null;
  /** Kinexus 1–10. */
  rating?: number | null;
  watchedDate?: string | null;
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
  /** Hevy/Strong: logged sessions grouped from the file. */
  workoutSessions?: WorkoutImportSession[] | null;
  /** Hevy/Strong: routine templates from distinct workout names. */
  workoutRoutines?: WorkoutImportRoutine[] | null;
  /** File unit detected from headers/values (canonical storage is always kg). */
  sourceWeightUnit?: WeightUnit | null;
  /** Whether workout_sessions history import is available. */
  supportsHistory?: boolean;
  /** User toggle: also write finished sessions. Default false. */
  importHistory?: boolean;
  /**
   * Whether unmatched exercises can be persisted as catalogue customs.
   * False in Kinexus today — free-text workout_exercises.name is used instead.
   */
  customExercisesSupported?: boolean;
};

export type ImportApplySummary = {
  imported: number;
  skippedDuplicate: number;
  skippedNeedsMatch: number;
  skippedInvalid: number;
  cancelled: boolean;
};

export type BuiltExport = {
  fileName: string;
  mimeType: string;
  /** UTF-8 text for json/csv/text; base64 for xlsx when encoding as string. */
  text: string | null;
  bytes: Uint8Array | null;
};

export function emptyImportRow(partial?: Partial<ImportRow>): ImportRow {
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
    durationSec: null,
    distanceKm: null,
    tmdbId: null,
    mediaType: null,
    imdbId: null,
    itemStatus: null,
    rating: null,
    watchedDate: null,
    status: 'invalid',
    note: null,
    matchConfidence: null,
    candidates: null,
    ...partial,
  };
}
