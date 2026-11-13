import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildExerciseNote,
  buildSeedSql,
  loadCatalogue,
  uuidFromSlug,
  validateWorkout,
} from './build-workout-seed.mjs';

describe('build-workout-seed', () => {
  const workouts = loadCatalogue();

  it('loads exactly 74 workouts', () => {
    assert.equal(workouts.length, 74);
  });

  it('uses deterministic uuids from slug', () => {
    const a = uuidFromSlug('full-body-beginner-a');
    const b = uuidFromSlug('full-body-beginner-a');
    const c = uuidFromSlug('other-slug');
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('keeps folded rest notes within 160 chars', () => {
    for (const workout of workouts) {
      validateWorkout(workout);
      for (const exercise of workout.exercises) {
        const note = buildExerciseNote(exercise);
        assert.ok(note.length <= 160, `${workout.slug}/${exercise.name} note ${note.length}`);
      }
    }
  });

  it('builds idempotent seed sql for all rows', () => {
    const sql = buildSeedSql(workouts);
    assert.match(sql, /on conflict \(id\) do nothing/i);
    assert.equal([...sql.matchAll(/^-- [a-z0-9-]+$/gm)].length, 74);
    for (const workout of workouts) {
      assert.ok(sql.includes(uuidFromSlug(workout.slug)));
    }
  });
});
