import { describe, expect, it } from 'vitest';

import {
  archiveExerciseCall,
  findDuplicateExerciseSuggestions,
  isLikelyDuplicateName,
  planSharedWorkoutExerciseCopy,
  promoteExercisePatch,
  publishGlobalExerciseCall,
  canPromoteExercise,
  exerciseSourceBadge,
} from './custom-exercises';

const catalog = [
  { id: '1', name: 'Barbell Bench Press' },
  { id: '2', name: 'Dumbbell Curl' },
  { id: '3', name: 'Incline Dumbbell Press' },
];

describe('findDuplicateExerciseSuggestions', () => {
  it('suggests close name matches', () => {
    const hits = findDuplicateExerciseSuggestions('barbell bench', catalog);
    expect(hits[0]?.id).toBe('1');
    expect(hits[0]?.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('returns empty for unrelated names', () => {
    expect(findDuplicateExerciseSuggestions('yoga nidra flow', catalog)).toEqual([]);
  });

  it('detects near-exact duplicates', () => {
    expect(isLikelyDuplicateName('Barbell Bench Press', catalog)).toBe(true);
    expect(isLikelyDuplicateName('Kettlebell Halo', catalog)).toBe(false);
  });
});

describe('promote + archive/publish calls', () => {
  it('builds promote patches', () => {
    expect(promoteExercisePatch({ scope: 'private' })).toEqual({
      scope: 'private',
      household_id: null,
      group_id: null,
    });
    expect(promoteExercisePatch({ scope: 'household', householdId: 'hh1' })).toEqual({
      scope: 'household',
      household_id: 'hh1',
      group_id: null,
    });
    expect(promoteExercisePatch({ scope: 'group', groupId: 'g1' })).toEqual({
      scope: 'group',
      household_id: null,
      group_id: 'g1',
    });
  });

  it('gates promote permission', () => {
    expect(
      canPromoteExercise({
        source: 'user',
        scope: 'private',
        ownerId: 'u1',
        userId: 'u1',
        householdRole: 'adult',
        canEditGroup: false,
      }),
    ).toBe(true);
    expect(
      canPromoteExercise({
        source: 'user',
        scope: 'household',
        ownerId: 'u2',
        userId: 'u1',
        householdRole: 'admin',
        canEditGroup: false,
      }),
    ).toBe(true);
    expect(
      canPromoteExercise({
        source: 'exercisedb',
        scope: 'global',
        ownerId: null,
        userId: 'u1',
        householdRole: 'owner',
        canEditGroup: false,
      }),
    ).toBe(false);
  });

  it('shapes archive and publish rpc calls', () => {
    expect(archiveExerciseCall('ex1')).toEqual({
      rpc: 'archive_exercise',
      args: { p_exercise_id: 'ex1' },
    });
    expect(publishGlobalExerciseCall('ex2')).toEqual({
      rpc: 'publish_global_exercise',
      args: { p_source_exercise_id: 'ex2' },
    });
  });

  it('maps source badges', () => {
    expect(exerciseSourceBadge({ scope: 'household', source: 'user' })).toBe('family');
    expect(exerciseSourceBadge({ scope: 'global', source: 'creator' })).toBe('creator');
    expect(exerciseSourceBadge({ scope: 'global', source: 'exercisedb' })).toBe('kinexus');
  });
});

describe('planSharedWorkoutExerciseCopy', () => {
  const byId = new Map([
    [
      'g1',
      {
        id: 'g1',
        name: 'Global Press',
        scope: 'global' as const,
        ownerId: null,
        householdId: null,
        source: 'exercisedb',
      },
    ],
    [
      'mine',
      {
        id: 'mine',
        name: 'My Raise',
        scope: 'private' as const,
        ownerId: 'me',
        householdId: null,
        source: 'user',
      },
    ],
    [
      'theirs',
      {
        id: 'theirs',
        name: 'Secret Curl',
        scope: 'private' as const,
        ownerId: 'other',
        householdId: null,
        source: 'user',
      },
    ],
    [
      'grp',
      {
        id: 'grp',
        name: 'Buddy Row',
        scope: 'group' as const,
        ownerId: 'other',
        householdId: null,
        source: 'user',
      },
    ],
    [
      'fam',
      {
        id: 'fam',
        name: 'Family Squat',
        scope: 'household' as const,
        ownerId: 'other',
        householdId: 'hh1',
        source: 'user',
      },
    ],
  ]);

  it('keeps global, own, and same-household; copies private/group of others', () => {
    const plan = planSharedWorkoutExerciseCopy({
      exercises: [
        { exerciseId: 'g1', name: 'Global Press' },
        { exerciseId: 'mine', name: 'My Raise' },
        { exerciseId: 'theirs', name: 'Secret Curl' },
        { exerciseId: 'grp', name: 'Buddy Row' },
        { exerciseId: 'fam', name: 'Family Squat' },
        { exerciseId: null, name: 'Free text' },
      ],
      byId,
      recipientUserId: 'me',
      recipientHouseholdId: 'hh1',
    });
    expect(plan).toEqual([
      { kind: 'keep', exerciseId: 'g1', name: 'Global Press' },
      { kind: 'keep', exerciseId: 'mine', name: 'My Raise' },
      { kind: 'copy', sourceExerciseId: 'theirs', name: 'Secret Curl' },
      { kind: 'copy', sourceExerciseId: 'grp', name: 'Buddy Row' },
      { kind: 'keep', exerciseId: 'fam', name: 'Family Squat' },
      { kind: 'keep', exerciseId: null, name: 'Free text' },
    ]);
  });

  it('asks for replacement when the exercise row is not visible', () => {
    const plan = planSharedWorkoutExerciseCopy({
      exercises: [{ exerciseId: 'missing', name: 'Ghost Press' }],
      byId,
      recipientUserId: 'me',
      recipientHouseholdId: 'hh1',
    });
    expect(plan).toEqual([{ kind: 'replace', sourceExerciseId: 'missing', name: 'Ghost Press' }]);
  });
});
