import { describe, expect, it } from 'vitest';

import {
  compoundFirstOrder,
  generateTrainPlan,
  isCompoundExercise,
  prescriptionFor,
  splitTemplateFor,
  weeklyVolumeByGroup,
  WEEKLY_VOLUME_TARGET,
} from './generate-plan';
import type { CatalogExercise } from './types';

function ex(
  id: string,
  name: string,
  bodyPart: string,
  targetMuscle: string,
  equipment = 'barbell',
): CatalogExercise {
  return { id, name, bodyPart, equipment, targetMuscle };
}

const catalogue: CatalogExercise[] = [
  ...Array.from({ length: 10 }, (_, i) => ex(`c${i}`, i === 0 ? 'Bench press' : `Chest fly ${i}`, 'chest', 'pectorals')),
  ...Array.from({ length: 10 }, (_, i) => ex(`b${i}`, i === 0 ? 'Barbell row' : `Lat pulldown ${i}`, 'back', 'lats')),
  ...Array.from({ length: 10 }, (_, i) =>
    ex(`l${i}`, i === 0 ? 'Back squat' : `Leg extension ${i}`, 'legs', 'quads'),
  ),
  ...Array.from({ length: 6 }, (_, i) => ex(`s${i}`, `Lateral raise ${i}`, 'shoulders', 'delts', 'dumbbell')),
  ...Array.from({ length: 6 }, (_, i) => ex(`bi${i}`, `Curl ${i}`, 'biceps', 'biceps', 'dumbbell')),
  ...Array.from({ length: 6 }, (_, i) => ex(`t${i}`, `Pushdown ${i}`, 'triceps', 'triceps', 'cable')),
  ...Array.from({ length: 4 }, (_, i) => ex(`g${i}`, `Hip thrust ${i}`, 'legs', 'glutes')),
  ...Array.from({ length: 4 }, (_, i) => ex(`co${i}`, `Plank ${i}`, 'core', 'abs', 'bodyweight')),
  ex('cardio1', 'Jump rope', 'cardio', '', 'bodyweight'),
  ex('mob1', '90/90 Breathing', 'other', '', 'bodyweight'),
  ex('bw1', 'Push-up', 'chest', 'pectorals', 'bodyweight'),
  ex('avoid-me', 'Avoid this press', 'chest', 'pectorals', 'machine'),
];

function baseInput(overrides: Partial<Parameters<typeof generateTrainPlan>[0]> = {}) {
  return {
    daysPerWeek: 4,
    goal: 'hypertrophy' as const,
    level: 'intermediate' as const,
    durationMin: 45,
    catalogue,
    seed: 42,
    ...overrides,
  };
}

describe('splitTemplateFor', () => {
  it('picks PPL for 3 days and upper/lower for 4', () => {
    expect(splitTemplateFor(3, 'hypertrophy')).toEqual(['Push', 'Pull', 'Legs']);
    expect(splitTemplateFor(4, 'strength')).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
  });

  it('uses mobility-only splits for mobility goal', () => {
    expect(splitTemplateFor(3, 'mobility')).toEqual(['Mobility', 'Mobility', 'Mobility']);
  });
});

describe('generateTrainPlan', () => {
  it('does not schedule the same recovery group on back-to-back days', () => {
    const plan = generateTrainPlan(
      baseInput({
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        daysPerWeek: 5,
        seed: 7,
      }),
    );
    const sessions = plan.filter((d) => !d.restDay);
    for (let i = 1; i < sessions.length; i += 1) {
      const prev = sessions[i - 1]!;
      const cur = sessions[i]!;
      const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const gap = Math.abs(dayOrder.indexOf(cur.day) - dayOrder.indexOf(prev.day));
      if (gap < 2) {
        expect(prev.focus[0]).not.toBe(cur.focus[0]);
        const pushish = new Set(['Push', 'Upper']);
        const pullish = new Set(['Pull']);
        const legsish = new Set(['Legs', 'Lower']);
        if (pushish.has(prev.focus[0]!) && pushish.has(cur.focus[0]!)) {
          expect.fail('push/upper back-to-back');
        }
        if (pullish.has(prev.focus[0]!) && pullish.has(cur.focus[0]!)) {
          expect.fail('pull back-to-back');
        }
        if (legsish.has(prev.focus[0]!) && legsish.has(cur.focus[0]!)) {
          expect.fail('legs back-to-back');
        }
      }
    }
  });

  it('leaves ≥48h between repeated focuses (upper/lower week)', () => {
    const plan = generateTrainPlan(
      baseInput({
        days: ['monday', 'tuesday', 'thursday', 'friday'],
        daysPerWeek: 4,
        seed: 11,
      }),
    );
    const uppers = plan.filter((d) => d.focus[0] === 'Upper');
    expect(uppers.length).toBeGreaterThanOrEqual(1);
    if (uppers.length >= 2) {
      const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const gap = dayOrder.indexOf(uppers[1]!.day) - dayOrder.indexOf(uppers[0]!.day);
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(uppers[1]!.explanation.toLowerCase()).toContain('48h');
    }
  });

  it('filters by equipment and avoid list', () => {
    const plan = generateTrainPlan(
      baseInput({
        daysPerWeek: 3,
        days: ['monday', 'wednesday', 'friday'],
        equipment: ['dumbbell', 'cable', 'bodyweight'],
        avoidExerciseIds: ['avoid-me'],
        seed: 99,
      }),
    );
    const ids = plan.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('avoid-me');
    for (const id of ids) {
      const item = catalogue.find((c) => c.id === id)!;
      expect(['dumbbell', 'cable', 'bodyweight']).toContain(item.equipment);
    }
  });

  it('scales weekly volume with level', () => {
    const beginner = generateTrainPlan(baseInput({ level: 'beginner', seed: 3, daysPerWeek: 4 }));
    const advanced = generateTrainPlan(baseInput({ level: 'advanced', seed: 3, daysPerWeek: 4 }));
    const bVol = [...weeklyVolumeByGroup(beginner).values()].reduce((a, b) => a + b, 0);
    const aVol = [...weeklyVolumeByGroup(advanced).values()].reduce((a, b) => a + b, 0);
    expect(prescriptionFor('hypertrophy', 'beginner', 'Chest').sets).toBeLessThan(
      prescriptionFor('hypertrophy', 'advanced', 'Chest').sets,
    );
    expect(WEEKLY_VOLUME_TARGET.advanced).toBeGreaterThan(WEEKLY_VOLUME_TARGET.beginner);
    // Advanced prescriptions use more sets per exercise → higher weekly total
    expect(aVol).toBeGreaterThanOrEqual(bVol);
  });

  it('orders compounds before isolation work', () => {
    const plan = generateTrainPlan(
      baseInput({
        days: ['monday'],
        daysPerWeek: 1,
        goal: 'strength',
        seed: 21,
      }),
    );
    const day = plan.find((d) => d.day === 'monday' && !d.restDay);
    expect(day).toBeTruthy();
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    const ordered = compoundFirstOrder(
      (day?.exercises ?? []).map((e) => ({ exerciseId: e.exerciseId, name: e.name })),
      byId,
    );
    expect(ordered.map((e) => e.exerciseId)).toEqual(day!.exercises.map((e) => e.exerciseId));
    if (day && day.exercises.length >= 2) {
      const first = catalogue.find((c) => c.id === day.exercises[0]!.exerciseId)!;
      // First slot should prefer a compound when any exist in the day
      const anyCompound = day.exercises.some((e) => {
        const item = catalogue.find((c) => c.id === e.exerciseId);
        return item ? isCompoundExercise(item) : false;
      });
      if (anyCompound) expect(isCompoundExercise(first)).toBe(true);
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = generateTrainPlan(baseInput({ seed: 100 }));
    const b = generateTrainPlan(baseInput({ seed: 100 }));
    const c = generateTrainPlan(baseInput({ seed: 101 }));
    expect(a).toEqual(b);
    const aIds = a.flatMap((d) => d.exercises.map((e) => e.exerciseId)).join(',');
    const cIds = c.flatMap((d) => d.exercises.map((e) => e.exerciseId)).join(',');
    const aFocus = a.map((d) => d.focus.join('|')).join(',');
    const cFocus = c.map((d) => d.focus.join('|')).join(',');
    expect(aIds !== cIds || aFocus !== cFocus).toBe(true);
  });

  it('prefers saved workouts that match the day focus', () => {
    const plan = generateTrainPlan(
      baseInput({
        days: ['monday', 'thursday'],
        daysPerWeek: 2,
        preferSavedWorkouts: true,
        savedWorkouts: [
          {
            id: 'w-upper',
            name: 'Upper saver',
            focus: ['Upper', 'Full Body'],
            durationMin: 45,
            exerciseIds: ['c0', 'b0'],
          },
        ],
        seed: 5,
        goal: 'hypertrophy',
      }),
    );
    const withSaved = plan.filter((d) => d.workoutId === 'w-upper');
    expect(withSaved.length).toBeGreaterThanOrEqual(1);
    expect(withSaved[0]!.explanation).toMatch(/saved workout/i);
  });
});
