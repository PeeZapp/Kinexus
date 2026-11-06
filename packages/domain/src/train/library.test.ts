import { describe, expect, it } from 'vitest';

import {
  canPublishTrainGlobal,
  filterTrainGlobalLibrary,
  isTrainGlobalEquipment,
  isTrainGlobalGoal,
  isTrainGlobalLevel,
  normalizeTrainGlobalEquipment,
  type TrainGlobalLibraryItem,
} from './library';

const base: TrainGlobalLibraryItem = {
  id: '1',
  name: 'Push day',
  level: 'beginner',
  goal: 'strength',
  equipment: ['dumbbells'],
  updatedAt: '2026-11-01T00:00:00Z',
  avgScore: 8,
  ratingCount: 2,
  creatorId: 'c1',
};

describe('train global tags', () => {
  it('validates level/goal/equipment enums', () => {
    expect(isTrainGlobalLevel('beginner')).toBe(true);
    expect(isTrainGlobalLevel('elite')).toBe(false);
    expect(isTrainGlobalGoal('fat_loss')).toBe(true);
    expect(isTrainGlobalGoal('cardio')).toBe(false);
    expect(isTrainGlobalEquipment('barbell')).toBe(true);
    expect(isTrainGlobalEquipment('smith')).toBe(false);
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
      updatedAt: '2026-11-06T00:00:00Z',
      avgScore: null,
      ratingCount: 0,
    },
  ];

  it('filters by query, level, goal, equipment', () => {
    expect(filterTrainGlobalLibrary(rows, { query: 'pull' }).map((r) => r.id)).toEqual(['2']);
    expect(filterTrainGlobalLibrary(rows, { level: 'beginner' }).map((r) => r.id)).toEqual(['1', '3']);
    expect(filterTrainGlobalLibrary(rows, { goal: 'mobility' }).map((r) => r.id)).toEqual(['3']);
    expect(filterTrainGlobalLibrary(rows, { equipment: 'barbell' }).map((r) => r.id)).toEqual(['2']);
  });

  it('sorts top rated then newest', () => {
    expect(filterTrainGlobalLibrary(rows, { sort: 'top_rated' }).map((r) => r.id)).toEqual([
      '2',
      '1',
      '3',
    ]);
    expect(filterTrainGlobalLibrary(rows, { sort: 'newest' }).map((r) => r.id)).toEqual([
      '3',
      '2',
      '1',
    ]);
  });
});
