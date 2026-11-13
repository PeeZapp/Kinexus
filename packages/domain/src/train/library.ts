export const TRAIN_GLOBAL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type TrainGlobalLevel = (typeof TRAIN_GLOBAL_LEVELS)[number];

export const TRAIN_GLOBAL_GOALS = [
  'strength',
  'hypertrophy',
  'conditioning',
  'mobility',
  'fat_loss',
] as const;
export type TrainGlobalGoal = (typeof TRAIN_GLOBAL_GOALS)[number];

export const TRAIN_GLOBAL_EQUIPMENT = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'kettlebell',
  'bands',
  'machines',
  'cable',
  'other',
] as const;
export type TrainGlobalEquipment = (typeof TRAIN_GLOBAL_EQUIPMENT)[number];

export const TRAIN_GLOBAL_SORTS = ['top_rated', 'newest'] as const;
export type TrainGlobalSort = (typeof TRAIN_GLOBAL_SORTS)[number];

export const TRAIN_GLOBAL_LENGTHS = ['under_15', '15_30', '30_45', '45_plus'] as const;
export type TrainGlobalLength = (typeof TRAIN_GLOBAL_LENGTHS)[number];

export type TrainGlobalTags = {
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: readonly TrainGlobalEquipment[];
};

export type TrainGlobalLibraryFilters = {
  query?: string;
  level?: TrainGlobalLevel | null;
  goal?: TrainGlobalGoal | null;
  equipment?: TrainGlobalEquipment | null;
  length?: TrainGlobalLength | null;
  sort?: TrainGlobalSort;
};

export type TrainGlobalLibraryItem = {
  id: string;
  name: string;
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: readonly TrainGlobalEquipment[];
  durationMin?: number | null;
  updatedAt: string;
  avgScore: number | null;
  ratingCount: number;
  creatorId: string | null;
  isSystem?: boolean;
  /** Creator username/handle (or system label) included in query matching. */
  creatorLabel?: string | null;
};

const LEVEL_SET = new Set<string>(TRAIN_GLOBAL_LEVELS);
const GOAL_SET = new Set<string>(TRAIN_GLOBAL_GOALS);
const EQUIPMENT_SET = new Set<string>(TRAIN_GLOBAL_EQUIPMENT);
const SORT_SET = new Set<string>(TRAIN_GLOBAL_SORTS);
const LENGTH_SET = new Set<string>(TRAIN_GLOBAL_LENGTHS);

export function isTrainGlobalLevel(value: string): value is TrainGlobalLevel {
  return LEVEL_SET.has(value);
}

export function isTrainGlobalGoal(value: string): value is TrainGlobalGoal {
  return GOAL_SET.has(value);
}

export function isTrainGlobalEquipment(value: string): value is TrainGlobalEquipment {
  return EQUIPMENT_SET.has(value);
}

export function isTrainGlobalSort(value: string): value is TrainGlobalSort {
  return SORT_SET.has(value);
}

export function isTrainGlobalLength(value: string): value is TrainGlobalLength {
  return LENGTH_SET.has(value);
}

export function normalizeTrainGlobalEquipment(
  values: readonly string[] | null | undefined,
): TrainGlobalEquipment[] {
  const out: TrainGlobalEquipment[] = [];
  for (const value of values ?? []) {
    if (isTrainGlobalEquipment(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

export function canPublishTrainGlobal(tags: TrainGlobalTags): boolean {
  return Boolean(tags.level && tags.goal && tags.equipment.length > 0);
}

export function trainGlobalLevelLabel(level: TrainGlobalLevel): string {
  switch (level) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
  }
}

export function trainGlobalGoalLabel(goal: TrainGlobalGoal): string {
  switch (goal) {
    case 'strength':
      return 'Strength';
    case 'hypertrophy':
      return 'Hypertrophy';
    case 'conditioning':
      return 'Conditioning';
    case 'mobility':
      return 'Mobility';
    case 'fat_loss':
      return 'Fat loss';
  }
}

export function trainGlobalEquipmentLabel(equipment: TrainGlobalEquipment): string {
  switch (equipment) {
    case 'bodyweight':
      return 'Bodyweight';
    case 'dumbbells':
      return 'Dumbbells';
    case 'barbell':
      return 'Barbell';
    case 'kettlebell':
      return 'Kettlebell';
    case 'bands':
      return 'Bands';
    case 'machines':
      return 'Machines';
    case 'cable':
      return 'Cable';
    case 'other':
      return 'Other';
  }
}

export function trainGlobalLengthLabel(length: TrainGlobalLength): string {
  switch (length) {
    case 'under_15':
      return 'Under 15 min';
    case '15_30':
      return '15–30';
    case '30_45':
      return '30–45';
    case '45_plus':
      return '45+';
  }
}

/** Official system workouts are shown as built by Kinexus (no profile link). */
export function trainGlobalCreatorLabel(item: { isSystem?: boolean }): 'Kinexus' | null {
  return item.isSystem ? 'Kinexus' : null;
}

function matchesQuery(
  item: { name: string; creatorLabel?: string | null },
  query: string | undefined,
): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  const creator = item.creatorLabel?.trim().toLowerCase();
  return Boolean(creator && creator.includes(q));
}

function matchesLength(durationMin: number | null | undefined, length: TrainGlobalLength | null): boolean {
  if (!length) return true;
  const minutes = durationMin ?? null;
  if (minutes == null) return false;
  switch (length) {
    case 'under_15':
      return minutes < 15;
    case '15_30':
      return minutes >= 15 && minutes <= 30;
    case '30_45':
      return minutes >= 30 && minutes <= 45;
    case '45_plus':
      return minutes >= 45;
  }
}

function queryMatchRank(
  item: { name: string; creatorLabel?: string | null },
  query: string | undefined,
): number {
  const q = query?.trim().toLowerCase();
  if (!q) return 0;
  const hay = item.name.toLowerCase();
  if (hay === q) return 0;
  if (hay.startsWith(q)) return 1;
  if (hay.includes(q)) return 2;
  const creator = item.creatorLabel?.trim().toLowerCase() ?? '';
  if (creator === q) return 3;
  if (creator.startsWith(q)) return 4;
  if (creator.includes(q)) return 5;
  return 6;
}

/** Default-visible catalog: drop per-user hidden ids unless includeHidden. */
export function filterHiddenWorkouts<T extends { id: string }>(
  items: readonly T[],
  hiddenIds: ReadonlySet<string> | readonly string[],
  options: { includeHidden?: boolean } = {},
): T[] {
  if (options.includeHidden) return [...items];
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set(hiddenIds);
  if (hidden.size === 0) return [...items];
  return items.filter((item) => !hidden.has(item.id));
}

/** In-progress workouts float to the top of the catalog. */
export function sortWorkoutsOpenFirst<T extends { id: string }>(
  items: readonly T[],
  openIds: ReadonlySet<string> | readonly string[],
): T[] {
  const open = openIds instanceof Set ? openIds : new Set(openIds);
  if (open.size === 0) return [...items];
  return [...items].sort((a, b) => {
    const aOpen = open.has(a.id) ? 0 : 1;
    const bOpen = open.has(b.id) ? 0 : 1;
    return aOpen - bOpen;
  });
}

/** Filter + sort creator workouts for the global library. */
export function filterTrainGlobalLibrary<T extends TrainGlobalLibraryItem>(
  items: readonly T[],
  filters: TrainGlobalLibraryFilters = {},
): T[] {
  const level = filters.level ?? null;
  const goal = filters.goal ?? null;
  const equipment = filters.equipment ?? null;
  const length = filters.length ?? null;
  const sort: TrainGlobalSort = filters.sort && isTrainGlobalSort(filters.sort) ? filters.sort : 'top_rated';

  const filtered = items.filter((item) => {
    if (!matchesQuery(item, filters.query)) return false;
    if (level && item.level !== level) return false;
    if (goal && item.goal !== goal) return false;
    if (equipment && !item.equipment.includes(equipment)) return false;
    if (!matchesLength(item.durationMin, length)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const matchDelta = queryMatchRank(a, filters.query) - queryMatchRank(b, filters.query);
    if (matchDelta !== 0) return matchDelta;

    const aSystem = Boolean(a.isSystem);
    const bSystem = Boolean(b.isSystem);
    if (aSystem !== bSystem) return aSystem ? -1 : 1;

    if (sort === 'newest') {
      return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name);
    }
    const aScore = a.avgScore ?? -1;
    const bScore = b.avgScore ?? -1;
    if (bScore !== aScore) return bScore - aScore;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return filtered;
}
