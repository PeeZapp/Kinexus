import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCompleteIndexes,
  canon,
  deriveCategory,
  inferExerciseEnrichment,
} from './enrich-exercise-infer.mjs';

function row(partial) {
  return {
    id: partial.id ?? 'x',
    name: partial.name,
    bodyPart: partial.bodyPart ?? 'other',
    equipment: partial.equipment ?? '',
    targetMuscle: partial.targetMuscle ?? '',
    instructions: partial.instructions ?? [],
    source: partial.source ?? 'wger',
    category: partial.category ?? null,
    isCompound: partial.isCompound ?? null,
  };
}

describe('canon phrase rules', () => {
  it('normalises Romanian Deadlift / RDL', () => {
    assert.equal(canon('Romanian Deadlift'), canon('RDL'));
    assert.ok(canon('Romanian Deadlift').includes('romaniandeadlift'));
  });

  it('normalises pull-up variants', () => {
    assert.equal(canon('Pull Up'), canon('Pull-Up'));
  });
});

describe('inferExerciseEnrichment — representative names', () => {
  const cases = [
    {
      name: 'Romanian Deadlift',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'hamstrings',
        category: 'Legs',
        isCompound: true,
      },
      absent: ['equipment'],
    },
    {
      name: 'Barbell Romanian Deadlift',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'hamstrings',
        equipment: 'barbell',
        category: 'Legs',
        isCompound: true,
      },
    },
    {
      name: 'Cable Fly',
      expect: {
        bodyPart: 'chest',
        targetMuscle: 'pectorals',
        equipment: 'cable',
        category: 'Chest',
      },
    },
    {
      name: '1/2 Kneeling Thoracic Rotation',
      expect: {
        category: 'Mobility',
        isCompound: false,
      },
    },
    {
      name: 'Landmine Press',
      expect: {
        bodyPart: 'shoulders',
        targetMuscle: 'deltoids',
        category: 'Shoulders',
        isCompound: true,
      },
    },
    {
      name: 'Barbell Back Squat',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'quadriceps',
        equipment: 'barbell',
        category: 'Legs',
        isCompound: true,
      },
    },
    {
      name: 'Dumbbell Curl',
      expect: {
        bodyPart: 'biceps',
        targetMuscle: 'biceps',
        equipment: 'dumbbell',
        category: 'Biceps',
        isCompound: false,
      },
    },
    {
      name: 'Cable Pushdown',
      expect: {
        bodyPart: 'triceps',
        targetMuscle: 'triceps',
        equipment: 'cable',
        category: 'Triceps',
        isCompound: false,
      },
    },
    {
      name: 'Lat Pulldown',
      expect: {
        bodyPart: 'back',
        targetMuscle: 'latissimus dorsi',
        category: 'Back',
        isCompound: true,
      },
    },
    {
      name: 'Pull-Up',
      expect: {
        bodyPart: 'back',
        targetMuscle: 'latissimus dorsi',
        equipment: 'bodyweight',
        category: 'Back',
        isCompound: true,
      },
    },
    {
      name: 'Dumbbell Lateral Raise',
      expect: {
        bodyPart: 'shoulders',
        targetMuscle: 'deltoids',
        equipment: 'dumbbell',
        category: 'Shoulders',
      },
    },
    {
      name: 'Hanging Leg Raise',
      expect: {
        bodyPart: 'core',
        targetMuscle: 'abdominals',
        category: 'Core',
      },
    },
    {
      name: 'Standing Calf Raise',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'calves',
        category: 'Legs',
        isCompound: false,
      },
    },
    {
      name: 'Hip Thrust',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'glutes',
        category: 'Glutes',
        isCompound: true,
      },
    },
    {
      name: 'Smith Machine Bench Press',
      expect: {
        bodyPart: 'chest',
        targetMuscle: 'pectorals',
        equipment: 'smith machine',
        category: 'Chest',
        isCompound: true,
      },
    },
    {
      name: 'Kettlebell Swing',
      expect: {
        equipment: 'kettlebell',
      },
    },
    {
      name: 'EZ Bar Curl',
      expect: {
        bodyPart: 'biceps',
        equipment: 'EZ bar',
        category: 'Biceps',
      },
    },
    {
      name: 'Band Pull Apart',
      expect: {
        equipment: 'resistance band',
        bodyPart: 'back',
      },
    },
    {
      name: 'Assault Bike',
      expect: {
        bodyPart: 'cardio',
        targetMuscle: 'cardiovascular system',
        category: 'Cardio',
      },
    },
    {
      name: 'Walking Lunge',
      expect: {
        bodyPart: 'legs',
        targetMuscle: 'quadriceps',
        category: 'Legs',
        isCompound: true,
      },
      absent: ['equipment'],
    },
  ];

  for (const { name, expect: expected, absent = [] } of cases) {
    it(name, () => {
      const { patch } = inferExerciseEnrichment(row({ name }));
      for (const [field, value] of Object.entries(expected)) {
        assert.equal(patch[field], value, `${name}.${field}`);
      }
      for (const field of absent) {
        assert.equal(patch[field], undefined, `${name}.${field} should be unset`);
      }
    });
  }
});

describe('same-exercise match', () => {
  it('copies fields from a complete peer with matching canon name', () => {
    const complete = row({
      id: 'complete',
      name: 'Barbell Bench Press',
      bodyPart: 'chest',
      equipment: 'barbell',
      targetMuscle: 'pectorals',
      source: 'exercisedb',
    });
    const incomplete = row({
      id: 'incomplete',
      name: 'Bench Press Barbell',
      source: 'wger',
    });
    // Force same canon by using identical normalised tokens via a known peer map
    const indexes = buildCompleteIndexes([
      complete,
      row({
        id: 'other',
        name: 'Bench Press',
        bodyPart: 'chest',
        equipment: 'barbell',
        targetMuscle: 'pectorals',
        source: 'exercisedb',
      }),
    ]);
    // Direct peer injection: same canon key
    indexes.completeByCanon.set(canon(incomplete.name), complete);
    const { patch, sources } = inferExerciseEnrichment(incomplete, indexes);
    assert.equal(patch.bodyPart, 'chest');
    assert.equal(patch.equipment, 'barbell');
    assert.equal(patch.targetMuscle, 'pectorals');
    assert.equal(sources.bodyPart, 'same_exercise');
  });
});

describe('instructions fallback', () => {
  it('uses instruction keywords when the name is opaque', () => {
    const { patch, sources } = inferExerciseEnrichment(
      row({
        name: 'Mystery Move 12',
        instructions: ['Lie on the bench and press the dumbbells together over your chest.'],
      }),
    );
    assert.equal(patch.bodyPart, 'chest');
    assert.equal(patch.equipment, 'dumbbell');
    assert.equal(sources.bodyPart, 'keyword_instructions');
  });
});

describe('deriveCategory', () => {
  it('maps glutes target and legs body part', () => {
    assert.equal(deriveCategory({ name: 'X', bodyPart: 'legs', targetMuscle: 'glutes' }), 'Glutes');
    assert.equal(deriveCategory({ name: 'X', bodyPart: 'chest', targetMuscle: '' }), 'Chest');
  });
});

describe('never invents vocabulary', () => {
  it('leaves low-confidence nonsense empty', () => {
    const { patch } = inferExerciseEnrichment(row({ name: 'XYZ Protocol Alpha' }));
    assert.equal(patch.bodyPart, undefined);
    assert.equal(patch.equipment, undefined);
    assert.equal(patch.targetMuscle, undefined);
  });
});
