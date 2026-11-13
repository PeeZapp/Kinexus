import { describe, expect, it } from 'vitest';

import {
  canPublishTrainGlobal,
  filterHiddenWorkouts,
  filterTrainGlobalLibrary,
  isTrainGlobalEquipment,
  isTrainGlobalGoal,
  isTrainGlobalLength,
  isTrainGlobalLevel,
  normalizeTrainGlobalEquipment,
  sortWorkoutsOpenFirst,
  trainGlobalCreatorLabel,
  trainGlobalLengthLabel,
  type TrainGlobalLibraryItem,
} from './library';

const base: TrainGlobalLibraryItem = {
  id: '1',
  name: 'Push day',
  level: 'beginner',
  goal: 'strength',
  equipment: ['dumbbells'],
  durationMin: 40,
  updatedAt: '2026-11-01T00:00:00Z',
  avgScore: 8,
  ratingCount: 2,
  creatorId: 'c1',
  isSystem: false,
};

describe('train global tags', () => {
  it('validates level/goal/equipment enums', () => {
    expect(isTrainGlobalLevel('beginner')).toBe(true);
    expect(isTrainGlobalLevel('elite')).toBe(false);
    expect(isTrainGlobalGoal('fat_loss')).toBe(true);
    expect(isTrainGlobalGoal('cardio')).toBe(false);
    expect(isTrainGlobalEquipment('barbell')).toBe(true);
    expect(isTrainGlobalEquipment('smith')).toBe(false);
    expect(isTrainGlobalLength('15_30')).toBe(true);
    expect(isTrainGlobalLength('hour')).toBe(false);
  });

  it('requires all three tags to publish', () => {
    expect(canPublishTrainGlobal({ level: null, goal: 'strength', equipment: ['dumbbells'] })).toBe(false);
    expect(canPublishTrainGlobal({ level: 'beginner', goal: null, equipment: ['dumbbells'] })).toBe(false);
    expect(canPublishTrainGlobal({ level: 'beginner', goal: 'strength', equipment: [] })).toBe(false);
    expect(
      canPublishTrainGlobal({ level: 'beginner', goal: 'strength', equipment: ['dumbbells'] }),
    ).toBe(true);
  });

  it('normalizes equipment and drops unknowns', () => {
    expect(normalizeTrainGlobalEquipment(['dumbbells', 'dumbbells', 'smith', 'barbell'])).toEqual([
      'dumbbells',
      'barbell',
    ]);
  });

  it('labels system creators as Kinexus', () => {
    expect(trainGlobalCreatorLabel({ isSystem: true })).toBe('Kinexus');
    expect(trainGlobalCreatorLabel({ isSystem: false })).toBe(null);
    expect(trainGlobalLengthLabel('under_15')).toBe('Under 15 min');
    expect(trainGlobalLengthLabel('45_plus')).toBe('45+');
  });
});

describe('filterTrainGlobalLibrary', () => {
  const rows: TrainGlobalLibraryItem[] = [
    base,
    {
      ...base,
      id: '2',
      name: 'Pull hypertrophy',
      level: 'intermediate',
      goal: 'hypertrophy',
      equipment: ['barbell', 'dumbbells'],
      durationMin: 50,
      updatedAt: '2026-11-05T00:00:00Z',
      avgScore: 9.2,
      ratingCount: 10,
    },
    {
      ...base,
      id: '3',
      name: 'Mobility flow',
      level: 'beginner',
      goal: 'mobility',
      equipment: ['bodyweight'],
      durationMin: 12,
      updatedAt: '2026-11-06T00:00:00Z',
      avgScore: null,
      ratingCount: 0,
    },
    {
      ...base,
      id: '4',
      name: 'Official starter',
      durationMin: 20,
      avgScore: 7,
      ratingCount: 1,
      creatorId: null,
      isSystem: true,
      updatedAt: '2026-11-04T00:00:00Z',
    },
  ];

  it('filters by query, level, goal, equipment', () => {
    expect(filterTrainGlobalLibrary(rows, { query: 'pull' }).map((r) => r.id)).toEqual(['2']);
    expect(filterTrainGlobalLibrary(rows, { level: 'beginner' }).map((r) => r.id)).toEqual([
      '4',
      '1',
      '3',
    ]);
    expect(filterTrainGlobalLibrary(rows, { goal: 'mobility' }).map((r) => r.id)).toEqual(['3']);
    expect(filterTrainGlobalLibrary(rows, { equipment: 'barbell' }).map((r) => r.id)).toEqual(['2']);
  });

  it('matches creator labels as well as workout names', () => {
    const withCreators: TrainGlobalLibraryItem[] = [
      { ...rows[0]!, creatorLabel: 'alexlifts' },
      { ...rows[1]!, creatorLabel: 'strongsam' },
      { ...rows[2]!, creatorLabel: null },
    ];
    expect(filterTrainGlobalLibrary(withCreators, { query: 'alex' }).map((r) => r.id)).toEqual(['1']);
    expect(filterTrainGlobalLibrary(withCreators, { query: 'strong' }).map((r) => r.id)).toEqual(['2']);
    expect(filterTrainGlobalLibrary(withCreators, { query: 'push' }).map((r) => r.id)).toEqual(['1']);
  });

  it('filters by length buckets from duration_min', () => {
    expect(filterTrainGlobalLibrary(rows, { length: 'under_15' }).map((r) => r.id)).toEqual(['3']);
    expect(filterTrainGlobalLibrary(rows, { length: '15_30' }).map((r) => r.id)).toEqual(['4']);
    expect(filterTrainGlobalLibrary(rows, { length: '30_45' }).map((r) => r.id)).toEqual(['1']);
    expect(filterTrainGlobalLibrary(rows, { length: '45_plus' }).map((r) => r.id)).toEqual(['2']);
  });

  it('sorts best match then official system then top rated / newest', () => {
    expect(filterTrainGlobalLibrary(rows, { sort: 'top_rated' }).map((r) => r.id)).toEqual([
      '4',
      '2',
      '1',
      '3',
    ]);
    expect(filterTrainGlobalLibrary(rows, { sort: 'newest' }).map((r) => r.id)).toEqual([
      '4',
      '3',
      '2',
      '1',
    ]);
    expect(filterTrainGlobalLibrary(rows, { query: 'official' }).map((r) => r.id)).toEqual(['4']);
  });
});

describe('workout hide + open sort', () => {
  it('filters hidden ids by default and can include them', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(filterHiddenWorkouts(items, ['b']).map((row) => row.id)).toEqual(['a', 'c']);
    expect(filterHiddenWorkouts(items, new Set(['b']), { includeHidden: true }).map((row) => row.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('floats open workouts to the top', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(sortWorkoutsOpenFirst(items, ['c', 'a']).map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });
});
