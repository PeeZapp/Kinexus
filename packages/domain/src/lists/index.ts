import './parse-imdb';
import './parse-letterboxd';
import './parse-hevy';
import './parse-strong';

export {
  clearListSourceDetectors,
  detectListSource,
  isListImportFileName,
  listFileExtensions,
  listSourceDetectors,
  registerListSourceDetector,
  STUB_LIST_SOURCE_DETECTORS,
} from './detect';
export type { ListSourceDetector, ListSourceInput } from './detect';

export { buildKinexusExport, buildLetterboxdImportCsv, buildListExport } from './export-build';
export type { ExportListInput } from './export-build';

export {
  acceptImportMatch,
  applyDedupeStatus,
  applyImportRows,
  applyMatchResults,
  buildImportPlan,
  dedupeKey,
  importRowsToExportItems,
  parseKinexusJson,
  refreshImportPlanRows,
  remapImportPlan,
  summarizeImportRows,
} from './import-plan';
export type { ExistingDedupeItem, MatchResultInput } from './import-plan';

export {
  MATCH_AUTO_ACCEPT,
  MATCH_NEEDS_CONFIRM,
  classifyMatchConfidence,
  letterboxdRatingToScore,
  normalizeImdbId,
  scoreToLetterboxdRating,
  titleYearMatchConfidence,
} from './match-confidence';

export {
  applyExerciseMatch,
  exerciseMatchConfidence,
  matchWorkoutExercises,
  normalizeExerciseName,
  rankExerciseMatches,
} from './match-exercise';
export type { ExerciseCatalogEntry } from './match-exercise';

export {
  defaultHeadersForKind,
  guessColumnMapping,
  rowFromCells,
  rowsFromMatrix,
} from './map-columns';

export { linesFromDocxHtml, parseDocxBytes } from './parse-docx';
export { looksLikeHevyCsv, parseHevyCsv } from './parse-hevy';
export {
  HEVY_LINK_PUBLIC_ERROR,
  acceptHevyLinkExerciseMatch,
  buildImportPlanFromHevyLink,
  classifyHevyWorkoutImportUrl,
  exerciseSetFingerprint,
  findMatchingLibraryWorkout,
  isHevyHost,
  isHevyWorkoutImportUrl,
  keepHevyLinkAsCustom,
  mapHevyLinkIntensities,
  matchHevyLinkExercises,
  parseHevyShareHtml,
} from './parse-hevy-link';
export type {
  ClassifiedHevyLink,
  HevyLinkImportPreview,
  HevyLinkKind,
  HevyLinkMatchStatus,
  HevyLinkMatchedExercise,
  LibraryWorkoutFingerprint,
  ParsedHevyLinkExercise,
  ParsedHevyLinkSet,
  ParsedHevyLinkWorkout,
} from './parse-hevy-link';
export { looksLikeImdbCsv, parseImdbCsv } from './parse-imdb';
export { looksLikeLetterboxdCsv, parseLetterboxdCsv, parseLetterboxdZip } from './parse-letterboxd';
export {
  LIST_LINK_MAX_PAGES,
  LIST_LINK_PUBLIC_ERROR,
  buildImportPlanFromListLink,
  classifyWatchlistListImportUrl,
  isLetterboxdShortListHost,
  isWatchlistListImportUrl,
  listLinkItemsToImportRows,
  mergeListLinkItems,
  parseImdbListHtml,
  parseLetterboxdListHtml,
  parseListLinkHtml,
} from './parse-list-link';
export type { ListLinkItem, ListLinkSource, ParsedListLinkPage } from './parse-list-link';
export { looksLikeStrongCsv, parseStrongCsv } from './parse-strong';
export { parsePlainTextList, parseQuantityLine } from './parse-text';
export { buildXlsxBytes, parseXlsxMatrix } from './parse-xlsx';

export {
  acceptExerciseMatch,
  applyHistoryDedupe,
  applyRoutineDedupe,
  historyDedupeKey,
  keepExerciseFreeText,
  matchPlanExercises,
  parseStrongDurationToMinutes,
  refreshWorkoutImportPlan,
  routineDedupeKey,
  routinesFromSessions,
  routinesToRows,
  summarizeWorkoutImport,
} from './workout-import';
export type { HistoryDedupeItem, ParsedWorkoutFile } from './workout-import';

export { emptyImportRow, KINEXUS_EXPORT_VERSION } from './types';
export type {
  BuiltExport,
  ColumnMapping,
  ExerciseMatchCandidate,
  ImportApplySummary,
  ImportField,
  ImportMatchCandidate,
  ImportPlan,
  ImportRow,
  ImportRowStatus,
  KinexusExport,
  KinexusExportItem,
  KinexusExportList,
  KinexusListKind,
  ListExportFormat,
  ListSourceFormat,
  WorkoutImportExercise,
  WorkoutImportRoutine,
  WorkoutImportSession,
  WorkoutImportSet,
} from './types';
