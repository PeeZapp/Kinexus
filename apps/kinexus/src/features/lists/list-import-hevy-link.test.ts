import { describe, expect, it, vi } from 'vitest';

import { buildImportPlanFromHevyLink, matchHevyLinkExercises, parseHevyShareHtml } from '@kinexus/domain';

import { runWorkoutExportImport } from '@/src/features/lists/list-import-apply';

const HTML = `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      workout: {
        title: 'Link Import',
        exercises: [
          { title: 'Bench Press', sets: [{ type: 'normal', weight_kg: 60, reps: 8 }] },
          { title: 'Made Up Band Pull', sets: [{ type: 'normal', weight_kg: 20, reps: 12 }] },
        ],
      },
    },
  },
  page: '/workout/[id]',
  buildId: 't',
})}</script></body></html>`;

describe('hevy link import commit', () => {
  it('creates missing personal customs then the workout in one commit; nothing beforehand', async () => {
    const parsed = parseHevyShareHtml(HTML);
    const matched = matchHevyLinkExercises(parsed, [{ id: 'ex-bench', name: 'Bench Press', category: 'Chest' }]);
    const plan = buildImportPlanFromHevyLink({
      title: parsed.title,
      url: 'https://hevy.com/workout/x',
      exercises: matched,
    });
    expect(plan.customExercisesSupported).toBe(true);
    expect(matched.some((ex) => ex.willCreateCustom)).toBe(true);

    const createCustomExercise = vi.fn(async (name: string) => `custom-${name}`);
    const createRoutine = vi.fn(async (routine) => {
      expect(routine.exercises.find((ex: { name: string }) => ex.name === 'Made Up Band Pull')?.exerciseId).toBe(
        'custom-Made Up Band Pull',
      );
      return 'workout-1';
    });

    expect(createCustomExercise).not.toHaveBeenCalled();
    expect(createRoutine).not.toHaveBeenCalled();

    const result = await runWorkoutExportImport({
      plan,
      writers: { createRoutine, createCustomExercise },
      signal: { cancelled: false },
    });

    expect(createCustomExercise).toHaveBeenCalledTimes(1);
    expect(createCustomExercise).toHaveBeenCalledWith('Made Up Band Pull');
    expect(createRoutine).toHaveBeenCalledTimes(1);
    expect(result.imported).toBe(1);
  });
});
