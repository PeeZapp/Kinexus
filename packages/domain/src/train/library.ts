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
  sort?: TrainGlobalSort;
};

export type TrainGlobalLibraryItem = {
  id: string;
  name: string;
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: readonly TrainGlobalEquipment[];
  updatedAt: string;
  avgScore: number | null;
  ratingCount: number;
  creatorId: string | null;
};

const LEVEL_SET = new Set<string>(TRAIN_GLOBAL_LEVELS);
const GOAL_SET = new Set<string>(TRAIN_GLOBAL_GOALS);
const EQUIPMENT_SET = new Set<string>(TRAIN_GLOBAL_EQUIPMENT);
const SORT_SET = new Set<string>(TRAIN_GLOBAL_SORTS);

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

function matchesQuery(name: string, query: string | undefined): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

/** Filter + sort creator workouts for the global library. */
export function filterTrainGlobalLibrary<T extends TrainGlobalLibraryItem>(
  items: readonly T[],
  filters: TrainGlobalLibraryFilters = {},
): T[] {
  const level = filters.level ?? null;
  const goal = filters.goal ?? null;
  const equipment = filters.equipment ?? null;
  const sort: TrainGlobalSort = filters.sort && isTrainGlobalSort(filters.sort) ? filters.sort : 'top_rated';

  const filtered = items.filter((item) => {
    if (!matchesQuery(item.name, filters.query)) return false;
    if (level && item.level !== level) return false;
    if (goal && item.goal !== goal) return false;
    if (equipment && !item.equipment.includes(equipment)) return false;
    return true;
  });

  filtered.sort((a, b) => {
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
