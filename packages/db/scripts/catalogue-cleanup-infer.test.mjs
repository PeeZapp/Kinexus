import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EQUIPMENT_SYNONYMS } from './enrich-exercise-infer.mjs';
import {
  EQUIPMENT_SYNONYM_OLD_SPELLINGS,
  canonicalizeEquipment,
  equipmentFromName,
  inferCatalogueCleanup,
  nameEquipmentMismatch,
  buildCleanupIndexes,
} from './catalogue-cleanup-infer.mjs';

function row(partial) {
  return {
    id: partial.id ?? 'x',
    name: partial.name,
    bodyPart: partial.bodyPart ?? 'other',
    equipment: partial.equipment ?? '',
    targetMuscle: partial.targetMuscle ?? '',
    canonicalKey: partial.canonicalKey ?? null,
    category: partial.category === undefined ? null : partial.category,
  };
}

describe('equipment synonym map', () => {
  it('covers every declared old spelling', () => {
    const expected = [
      'body only',
      'kettlebells',
      'bands',
      'e-z curl bar',
      'olympic barbell',
      'exercise ball',
      'roller',
    ];
    for (const old of expected) {
      assert.ok(EQUIPMENT_SYNONYMS[old], `missing synonym for ${old}`);
      assert.equal(canonicalizeEquipment(old), EQUIPMENT_SYNONYMS[old]);
    }
    assert.deepEqual(
      [...EQUIPMENT_SYNONYM_OLD_SPELLINGS].sort(),
      [...Object.keys(EQUIPMENT_SYNONYMS)].sort(),
    );
  });

  it('maps pairs to the first (canonical) value', () => {
    assert.equal(canonicalizeEquipment('body only'), 'bodyweight');
    assert.equal(canonicalizeEquipment('kettlebells'), 'kettlebell');
    assert.equal(canonicalizeEquipment('bands'), 'resistance band');
    assert.equal(canonicalizeEquipment('e-z curl bar'), 'EZ bar');
    assert.equal(canonicalizeEquipment('olympic barbell'), 'barbell');
    assert.equal(canonicalizeEquipment('exercise ball'), 'stability ball');
    assert.equal(canonicalizeEquipment('roller'), 'foam roll');
  });
});

describe('Part 2 specific fixes', () => {
  const cases = [
    {
      id: 'ccb11f8f-cffd-5aad-92f3-ef32627970ad',
      name: 'Dumbbell Thruster',
      equipment: 'barbell',
      category: 'Full Body',
      expect: { equipment: 'dumbbell' },
    },
    {
      id: '38682338-636e-5bc1-93c9-db3308f13501',
      name: 'Dumbbell Hip Thrust',
      equipment: 'barbell',
      category: 'Glutes',
      expect: { equipment: 'dumbbell' },
    },
    {
      id: 'a3cb0465-037f-57a8-bfad-f5d344954508',
      name: 'dumbbell snatch',
      equipment: 'barbell',
      category: 'Legs',
      expect: { equipment: 'dumbbell', category: 'Full Body' },
    },
    {
      id: '05c6c65b-45a9-5a20-9191-c3f87ce8326f',
      name: 'Foam Roll IT Band',
      equipment: 'resistance band',
      category: 'Mobility',
      expect: { equipment: 'foam roll' },
    },
    {
      id: '442f4562-4b86-5358-b3ec-18c3a8a17aaf',
      name: 'Chair Squat',
      equipment: 'machine',
      category: 'Legs',
      expect: { equipment: 'bodyweight' },
    },
    {
      name: 'Dumbbell close grip bench press',
      equipment: 'barbell',
      expect: { equipment: 'dumbbell' },
    },
    {
      name: 'Dumbbell Front Squat',
      equipment: 'barbell',
      expect: { equipment: 'dumbbell' },
    },
    {
      name: 'kettlebell sumo deadlift',
      equipment: 'barbell',
      expect: { equipment: 'kettlebell' },
    },
    {
      name: 'Dumbbell Crunches',
      equipment: 'body only',
      expect: { equipment: 'dumbbell' },
    },
    {
      name: 'Dumbbell Push-Up',
      equipment: 'bodyweight',
      expect: { equipment: 'dumbbell' },
    },
    {
      name: 'Cable Triceps Press',
      equipment: 'bodyweight',
      expect: { equipment: 'cable' },
    },
    {
      id: '5535eaf4-5d4b-59cd-9dee-d934a4b966ab',
      name: 'Chin tuck',
      equipment: '',
      category: null,
      expect: { equipment: 'bodyweight', category: 'Mobility' },
    },
    {
      id: 'cf378d80-02f3-5b09-8fe3-fa0d3fa4efcf',
      name: 'Deadhang',
      equipment: '',
      category: null,
      expect: { equipment: 'bodyweight', category: 'Back' },
    },
    {
      id: '2f0e2d20-b04e-5059-876b-22539b364a6b',
      name: 'Wall-sit',
      equipment: '',
      category: null,
      expect: { equipment: 'bodyweight', category: 'Legs' },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const { patch, changed } = inferCatalogueCleanup(row(c));
      assert.equal(changed, true);
      for (const [field, value] of Object.entries(c.expect)) {
        assert.equal(patch[field], value, `${c.name}.${field}`);
      }
    });
  }
});

describe('Part 3 inference', () => {
  it('normalises synonym without touching a good category', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Band Pull Apart', equipment: 'bands', category: 'Back' }),
    );
    assert.equal(patch.equipment, 'resistance band');
    assert.equal(patch.category, undefined);
  });

  it('fixes name/equipment mismatch', () => {
    assert.equal(equipmentFromName('Dumbbell Row'), 'dumbbell');
    assert.equal(nameEquipmentMismatch('Dumbbell Row', 'barbell'), 'dumbbell');
    const { patch, rules } = inferCatalogueCleanup(
      row({ name: 'Smith Machine Squat', equipment: 'barbell', category: 'Legs' }),
    );
    assert.equal(patch.equipment, 'smith machine');
    assert.ok(rules.includes('name_equipment_mismatch'));
  });

  it('fills empty equipment from peer canon', () => {
    const peer = row({
      id: 'peer',
      name: 'Goblet Squat',
      equipment: 'dumbbell',
      category: 'Legs',
    });
    const indexes = buildCleanupIndexes([peer]);
    const { patch, rules } = inferCatalogueCleanup(
      row({ id: 'gap', name: 'Goblet Squat', equipment: '', category: 'Legs' }),
      indexes,
    );
    assert.equal(patch.equipment, 'dumbbell');
    assert.ok(rules.includes('empty_equipment_peer'));
  });

  it('fills empty equipment bodyweight for mobility holds', () => {
    const { patch, rules } = inferCatalogueCleanup(
      row({ name: 'Standing Quad Stretch', equipment: '', category: null }),
    );
    assert.equal(patch.equipment, 'bodyweight');
    assert.equal(patch.category, 'Mobility');
    assert.ok(rules.includes('empty_equipment_bodyweight') || rules.includes('empty_equipment_name'));
  });

  it('fills null category from keywords', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Dead Bug', equipment: 'bodyweight', category: null }),
    );
    assert.equal(patch.category, 'Core');
  });

  it('does not overwrite a sensible existing equipment', () => {
    const { changed, patch } = inferCatalogueCleanup(
      row({ name: 'Walking Lunge', equipment: 'dumbbell', category: 'Legs' }),
    );
    assert.equal(changed, false);
    assert.equal(patch.equipment, undefined);
  });

  it('leaves empty when no confident equipment cue', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Mystery Protocol', equipment: '', category: 'Legs' }),
    );
    assert.equal(patch.equipment, undefined);
  });

  it('guard: specific fix only when old value still present', () => {
    const { changed } = inferCatalogueCleanup(
      row({
        id: 'ccb11f8f-cffd-5aad-92f3-ef32627970ad',
        name: 'Dumbbell Thruster',
        equipment: 'dumbbell',
        category: 'Full Body',
      }),
    );
    assert.equal(changed, false);
  });
});

describe('round 2 — no-kit bodyweight + kit words', () => {
  it('fills empty equipment for circles / rotations / bird dog without kit', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Arm Circles', equipment: '', category: 'Shoulders' }),
    );
    assert.equal(patch.equipment, 'bodyweight');
    const bird = inferCatalogueCleanup(row({ name: 'Bird Dog', equipment: '', category: null }));
    assert.equal(bird.patch.equipment, 'bodyweight');
    assert.equal(bird.patch.category, 'Core');
  });

  it('fills empty lunges/squats without kit, leaves dumbbell lunge alone', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Walking Lunge', equipment: '', category: 'Legs' }),
    );
    assert.equal(patch.equipment, 'bodyweight');
    const loaded = inferCatalogueCleanup(
      row({ name: 'Dumbbell Walking Lunge', equipment: '', category: 'Legs' }),
    );
    assert.equal(loaded.patch.equipment, 'dumbbell');
  });

  it('maps SZ-bar / TRX / battle ropes / Blackroll / bag kit words', () => {
    assert.equal(
      inferCatalogueCleanup(row({ name: 'SZ-Bar Curl', equipment: '', category: 'Biceps' })).patch
        .equipment,
      'EZ bar',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Biceps with TRX', equipment: '', category: 'Biceps' })).patch
        .equipment,
      'other',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Battle Ropes', equipment: '', category: 'Shoulders' })).patch
        .equipment,
      'rope',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Blackroll IT Band', equipment: '', category: 'Mobility' }))
        .patch.equipment,
      'foam roll',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Bag training', equipment: '', category: 'Cardio' })).patch
        .equipment,
      'other',
    );
  });

  it('maps non-medicine ball to stability ball; bench press without kit to barbell', () => {
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Ball Crunches', equipment: '', category: 'Core' })).patch
        .equipment,
      'stability ball',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Bench Press Narrow Grip', equipment: '', category: 'Chest' }))
        .patch.equipment,
      'barbell',
    );
  });
});

describe('round 2 — category keywords + contradictions', () => {
  it('fills null category for ankle / arm circles / crunch / triceps', () => {
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Ankle Roll', equipment: 'bodyweight', category: null })).patch
        .category,
      'Legs',
    );
    assert.equal(
      inferCatalogueCleanup(
        row({ name: 'Backward arm circles', equipment: 'bodyweight', category: null }),
      ).patch.category,
      'Shoulders',
    );
    assert.equal(
      inferCatalogueCleanup(row({ name: 'Ball crunches', equipment: 'bodyweight', category: null }))
        .patch.category,
      'Core',
    );
    assert.equal(
      inferCatalogueCleanup(
        row({ name: 'Cable Triceps Extension', equipment: 'cable', category: null }),
      ).patch.category,
      'Triceps',
    );
  });

  it('falls back to body_part / target_muscle for null category', () => {
    const { patch } = inferCatalogueCleanup(
      row({
        name: 'Opaque Move',
        equipment: 'dumbbell',
        category: null,
        bodyPart: 'back',
        targetMuscle: 'latissimus dorsi',
      }),
    );
    assert.equal(patch.category, 'Back');
  });

  it('fixes Ankle On The Knee Chest → Legs', () => {
    const { patch, rules } = inferCatalogueCleanup(
      row({ name: 'Ankle On The Knee', equipment: 'bodyweight', category: 'Chest' }),
    );
    assert.equal(patch.category, 'Legs');
    assert.ok(rules.includes('category_contradiction'));
  });

  it('fixes Bent-over Lateral Raises Chest → Shoulders', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Bent-over Lateral Raises', equipment: 'dumbbell', category: 'Chest' }),
    );
    assert.equal(patch.category, 'Shoulders');
  });

  it('fixes Biceps with TRX Core → Biceps', () => {
    const { patch } = inferCatalogueCleanup(
      row({ name: 'Biceps with TRX', equipment: 'other', category: 'Core' }),
    );
    assert.equal(patch.category, 'Biceps');
  });

  it('does not contradict a matching category', () => {
    const { changed } = inferCatalogueCleanup(
      row({ name: 'Lateral Raises', equipment: 'dumbbell', category: 'Shoulders' }),
    );
    assert.equal(changed, false);
  });

  it('does not yank stretches or pull-ups out of Mobility/Back', () => {
    assert.equal(
      inferCatalogueCleanup(
        row({ name: 'Standing Biceps Stretch', equipment: 'bodyweight', category: 'Mobility' }),
      ).changed,
      false,
    );
    assert.equal(
      inferCatalogueCleanup(
        row({ name: 'biceps pull-up', equipment: 'bodyweight', category: 'Back' }),
      ).changed,
      false,
    );
  });
});

describe('round 3 — name-keyed rescues', () => {
  it('rescues L-sit / Pike Push Ups / Cat-Cow / Cycling', () => {
    const lsit = inferCatalogueCleanup(row({ name: 'L-sit', equipment: '', category: null }));
    assert.equal(lsit.patch.equipment, 'bodyweight');
    assert.equal(lsit.patch.category, 'Core');

    const pike = inferCatalogueCleanup(row({ name: 'Pike Push Ups', equipment: '', category: null }));
    assert.equal(pike.patch.equipment, 'bodyweight');
    assert.equal(pike.patch.category, 'Shoulders');

    const cat = inferCatalogueCleanup(row({ name: 'Cat-Cow', equipment: '', category: null }));
    assert.equal(cat.patch.equipment, 'bodyweight');
    assert.equal(cat.patch.category, 'Mobility');

    const cycle = inferCatalogueCleanup(row({ name: 'Cycling', equipment: '', category: null }));
    assert.equal(cycle.patch.equipment, 'stationary bike');
    assert.equal(cycle.patch.category, 'Cardio');
  });

  it('rescues swim/climb kit as other and leaves Schwimmen name alone', () => {
    const swim = inferCatalogueCleanup(
      row({ name: 'Swimming 50m sprints', equipment: '', category: null }),
    );
    assert.equal(swim.patch.equipment, 'other');
    assert.equal(swim.patch.category, 'Cardio');

    const de = inferCatalogueCleanup(row({ name: 'Schwimmen', equipment: '', category: null }));
    assert.equal(de.patch.equipment, 'other');
    assert.equal(de.patch.category, 'Cardio');

    const board = inferCatalogueCleanup(
      row({ name: 'Fingerboard 20 mm edge', equipment: '', category: null }),
    );
    assert.equal(board.patch.equipment, 'other');
    assert.equal(board.patch.category, 'Back');
  });

  it('does not invent a rename for Rest (for timed workouts)', () => {
    const { patch, changed } = inferCatalogueCleanup(
      row({ name: 'Rest (for timed workouts)', equipment: '', category: null }),
    );
    // No rescue override — stays empty so the hide pass can take it.
    assert.equal(patch.equipment, undefined);
    assert.equal(patch.category, undefined);
    assert.equal(changed, false);
  });
});
