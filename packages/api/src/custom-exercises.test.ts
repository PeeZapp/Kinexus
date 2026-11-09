import { describe, expect, it, vi } from 'vitest';

import {
  callArchiveExercise,
  callPromoteExercise,
  callPublishGlobalExercise,
  resolveSharedWorkoutExercises,
} from './custom-exercises.js';

describe('custom exercise rpc wrappers', () => {
  it('archives via archive_exercise', async () => {
    const rpc = vi.fn(async () => ({ data: 'hidden', error: null }));
    await expect(callArchiveExercise({ rpc }, 'ex1')).resolves.toBe('hidden');
    expect(rpc).toHaveBeenCalledWith('archive_exercise', { p_exercise_id: 'ex1' });
  });

  it('publishes via publish_global_exercise', async () => {
    const rpc = vi.fn(async () => ({ data: 'ex2', error: null }));
    await expect(callPublishGlobalExercise({ rpc }, 'ex2')).resolves.toBe('ex2');
    expect(rpc).toHaveBeenCalledWith('publish_global_exercise', {
      p_source_exercise_id: 'ex2',
    });
  });

  it('promotes with the domain patch', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 'x' }, error: null }),
      }),
    }));
    const from = vi.fn(() => ({ update, insert }));
    await callPromoteExercise({ from }, 'ex3', { scope: 'household', householdId: 'hh1' });
    expect(from).toHaveBeenCalledWith('exercises');
    expect(update).toHaveBeenCalledWith({
      scope: 'household',
      household_id: 'hh1',
      group_id: null,
    });
    expect(eq).toHaveBeenCalledWith('id', 'ex3');
  });
});

describe('resolveSharedWorkoutExercises', () => {
  it('copies private rows and flags invisible ones for replacement', async () => {
    const byId = new Map([
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
    ]);
    const copyRow = vi.fn(async () => ({ id: 'new1', name: 'Secret Curl' }));
    const result = await resolveSharedWorkoutExercises({
      exercises: [
        { exerciseId: 'theirs', name: 'Secret Curl' },
        { exerciseId: 'ghost', name: 'Ghost Press' },
      ],
      byId,
      recipientUserId: 'me',
      recipientHouseholdId: 'hh1',
      copyRow,
    });
    expect(copyRow).toHaveBeenCalledWith('theirs');
    expect(result.exercises).toEqual([
      { exerciseId: 'new1', name: 'Secret Curl', copiedFromId: 'theirs' },
      { exerciseId: null, name: 'Ghost Press', needsReplacement: true },
    ]);
  });
});
