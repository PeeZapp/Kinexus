import { describe, expect, it, vi } from 'vitest';

import {
  callAppendWorkoutSet,
  callDeleteWorkoutSet,
  callDeleteWorkoutSetsAtPosition,
  callFinishWorkoutSession,
  callLinkWorkoutSession,
  callMoveSessionExercise,
  callReplaceSessionExercise,
  callRewriteSessionSets,
  callUpdateWorkoutSet,
} from './workout-session-writes.js';

function okRpc(name?: string) {
  return vi.fn(async (rpcName: string, args: Record<string, unknown>) => {
    if (name && rpcName !== name) throw new Error(`unexpected rpc ${rpcName}`);
    return { data: null, error: null, args };
  });
}

describe('workout session rpc wrappers', () => {
  it('append_workout_set happy path', async () => {
    const rpc = okRpc('append_workout_set');
    await callAppendWorkoutSet({ rpc }, 'sess-1', [
      {
        exercise_id: 'ex-1',
        exercise_name: 'Bench',
        position: 0,
        set_index: 0,
        weight: '60',
        reps: '8',
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('append_workout_set', {
      p_session_id: 'sess-1',
      p_sets: [
        {
          exercise_id: 'ex-1',
          exercise_name: 'Bench',
          position: 0,
          set_index: 0,
          weight: '60',
          reps: '8',
        },
      ],
    });
  });

  it('append_workout_set rejects another user', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(
      callAppendWorkoutSet({ rpc }, 'sess-1', [
        { exercise_id: null, exercise_name: 'Walk', position: 0, set_index: 0 },
      ]),
    ).rejects.toThrow('Not allowed to modify this session');
  });

  it('update_workout_set happy path', async () => {
    const rpc = okRpc('update_workout_set');
    await callUpdateWorkoutSet({ rpc }, 'set-1', { weight: '70', reps: '5', done: true });
    expect(rpc).toHaveBeenCalledWith('update_workout_set', {
      p_set_id: 'set-1',
      p_weight: '70',
      p_reps: '5',
      p_done: true,
    });
  });

  it('update_workout_set rejects another user', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to update this set' },
    }));
    await expect(callUpdateWorkoutSet({ rpc }, 'set-1', { done: true })).rejects.toThrow(
      'Not allowed to update this set',
    );
  });

  it('delete_workout_set happy path + another user rejected', async () => {
    const ok = okRpc('delete_workout_set');
    await callDeleteWorkoutSet({ rpc: ok }, 'set-1');
    expect(ok).toHaveBeenCalledWith('delete_workout_set', { p_set_id: 'set-1' });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to delete this set' },
    }));
    await expect(callDeleteWorkoutSet({ rpc: denied }, 'set-2')).rejects.toThrow(
      'Not allowed to delete this set',
    );
  });

  it('delete_workout_sets_at_position happy path + another user rejected', async () => {
    const ok = okRpc('delete_workout_sets_at_position');
    await callDeleteWorkoutSetsAtPosition({ rpc: ok }, 'sess-1', 2);
    expect(ok).toHaveBeenCalledWith('delete_workout_sets_at_position', {
      p_session_id: 'sess-1',
      p_position: 2,
    });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(callDeleteWorkoutSetsAtPosition({ rpc: denied }, 'sess-1', 0)).rejects.toThrow(
      'Not allowed to modify this session',
    );
  });

  it('move_session_exercise happy path + another user rejected', async () => {
    const ok = okRpc('move_session_exercise');
    await callMoveSessionExercise({ rpc: ok }, 'sess-1', 1, -1);
    expect(ok).toHaveBeenCalledWith('move_session_exercise', {
      p_session_id: 'sess-1',
      p_position: 1,
      p_direction: -1,
    });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(callMoveSessionExercise({ rpc: denied }, 'sess-1', 0, 1)).rejects.toThrow(
      'Not allowed to modify this session',
    );
  });

  it('replace_session_exercise happy path + another user rejected', async () => {
    const ok = okRpc('replace_session_exercise');
    await callReplaceSessionExercise(
      { rpc: ok },
      { sessionId: 'sess-1', position: 0, exerciseId: 'ex-9', name: 'Row', weight: '40' },
    );
    expect(ok).toHaveBeenCalledWith('replace_session_exercise', {
      p_session_id: 'sess-1',
      p_position: 0,
      p_exercise_id: 'ex-9',
      p_name: 'Row',
      p_weight: '40',
    });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(
      callReplaceSessionExercise(
        { rpc: denied },
        { sessionId: 'sess-1', position: 0, exerciseId: 'ex-9', name: 'Row' },
      ),
    ).rejects.toThrow('Not allowed to modify this session');
  });

  it('rewrite_session_sets happy path + another user rejected', async () => {
    const ok = okRpc('rewrite_session_sets');
    await callRewriteSessionSets({ rpc: ok }, 'sess-1', [
      { exercise_id: 'ex-1', exercise_name: 'Squat', position: 0, set_index: 0 },
    ]);
    expect(ok).toHaveBeenCalledWith('rewrite_session_sets', {
      p_session_id: 'sess-1',
      p_sets: [{ exercise_id: 'ex-1', exercise_name: 'Squat', position: 0, set_index: 0 }],
    });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(callRewriteSessionSets({ rpc: denied }, 'sess-1', [])).rejects.toThrow(
      'Not allowed to modify this session',
    );
  });

  it('link_workout_session happy path + another user rejected', async () => {
    const ok = okRpc('link_workout_session');
    await callLinkWorkoutSession({ rpc: ok }, 'sess-1', 'w-1', 'Upper Push');
    expect(ok).toHaveBeenCalledWith('link_workout_session', {
      p_session_id: 'sess-1',
      p_workout_id: 'w-1',
      p_name: 'Upper Push',
    });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(callLinkWorkoutSession({ rpc: denied }, 'sess-1', 'w-1', 'X')).rejects.toThrow(
      'Not allowed to modify this session',
    );
  });

  it('finish_workout_session happy path + another user rejected', async () => {
    const ok = okRpc('finish_workout_session');
    await callFinishWorkoutSession({ rpc: ok }, 'sess-1');
    expect(ok).toHaveBeenCalledWith('finish_workout_session', { p_session_id: 'sess-1' });

    const denied = vi.fn(async () => ({
      data: null,
      error: { message: 'Not allowed to modify this session' },
    }));
    await expect(callFinishWorkoutSession({ rpc: denied }, 'sess-1')).rejects.toThrow(
      'Not allowed to modify this session',
    );
  });
});
