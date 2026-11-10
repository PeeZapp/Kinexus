import { describe, expect, it } from 'vitest';

import {
  exercisedbGifUrl,
  exercisedbMediaId,
  isExercisedbMediaUrl,
  nextExerciseMediaUrl,
} from '@/src/features/train/exercise-media';

describe('exercise-media', () => {
  it('parses exercisedb gif ids', () => {
    expect(exercisedbMediaId('https://static.exercisedb.dev/media/9tvVVM9.gif')).toBe('9tvVVM9');
    expect(isExercisedbMediaUrl('https://static.exercisedb.dev/media/9tvVVM9.gif')).toBe(true);
    expect(isExercisedbMediaUrl('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/a.jpg')).toBe(
      false,
    );
    expect(exercisedbGifUrl('gAwDzB3')).toBe('https://static.exercisedb.dev/media/gAwDzB3.gif');
  });

  it('advances through local candidates before looking up', async () => {
    const next = await nextExerciseMediaUrl({
      urls: ['https://static.exercisedb.dev/media/a.gif', 'https://static.exercisedb.dev/media/b.gif'],
      name: 'cable triceps pushdown (v-bar)',
      failed: ['https://static.exercisedb.dev/media/a.gif'],
    });
    expect(next).toBe('https://static.exercisedb.dev/media/b.gif');
  });

  it('returns null when every local candidate failed and lookup is not needed', async () => {
    const next = await nextExerciseMediaUrl({
      urls: ['https://cdn.example/a.jpg'],
      failed: ['https://cdn.example/a.jpg'],
    });
    expect(next).toBeNull();
  });
});
