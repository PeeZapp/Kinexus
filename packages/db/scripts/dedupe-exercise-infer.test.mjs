import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareCanonical,
  fieldsCompatible,
  nearKey,
  pickCanonical,
  shouldMerge,
} from './dedupe-exercise-infer.mjs';

function row(partial) {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    bodyPart: partial.bodyPart ?? '',
    equipment: partial.equipment ?? '',
    targetMuscle: partial.targetMuscle ?? '',
    instructions: partial.instructions ?? [],
    secondaryMuscles: partial.secondaryMuscles ?? [],
    mediaUrl: partial.mediaUrl ?? null,
    mediaUrls: partial.mediaUrls ?? [],
    source: partial.source ?? 'wger',
    category: partial.category ?? null,
    isCompound: partial.isCompound ?? null,
  };
}

describe('should-merge near-duplicates', () => {
  it('merges Lateral Raises / Side Lateral Raise / dumbbell lateral raise when equipment+target allow', () => {
    const a = row({
      name: 'Lateral Raises',
      equipment: '',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
    });
    const b = row({
      name: 'Side Lateral Raise',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
    });
    const c = row({
      name: 'dumbbell lateral raise',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
    });
    assert.equal(nearKey(a), nearKey(b));
    assert.equal(nearKey(a), nearKey(c));
    assert.equal(shouldMerge(a, b), true);
    assert.equal(shouldMerge(a, c), true);
    assert.equal(shouldMerge(b, c), true);
  });

  it('merges Dips / chest dip when context body word matches target', () => {
    const a = row({
      name: 'Dips',
      equipment: 'bodyweight',
      targetMuscle: 'triceps',
      bodyPart: 'chest',
    });
    const b = row({
      name: 'chest dip',
      equipment: 'bodyweight',
      targetMuscle: 'triceps',
      bodyPart: 'chest',
    });
    assert.equal(nearKey(a), nearKey(b));
    assert.equal(shouldMerge(a, b), true);
  });

  it('merges plural/singular and hyphen variants', () => {
    const a = row({ name: 'Pull-Ups', equipment: 'bodyweight', targetMuscle: 'lats' });
    const b = row({ name: 'Pull Up', equipment: 'bodyweight', targetMuscle: 'lats' });
    assert.equal(shouldMerge(a, b), true);
  });
});

describe('must-not-merge variants', () => {
  it('keeps barbell vs dumbbell bench press separate', () => {
    const a = row({
      name: 'Barbell Bench Press',
      equipment: 'barbell',
      targetMuscle: 'pectorals',
      bodyPart: 'chest',
    });
    const b = row({
      name: 'Dumbbell Bench Press',
      equipment: 'dumbbell',
      targetMuscle: 'pectorals',
      bodyPart: 'chest',
    });
    assert.equal(nearKey(a), nearKey(b));
    assert.equal(fieldsCompatible(a, b), false);
    assert.equal(shouldMerge(a, b), false);
  });

  it('infers equipment from the title when the field is empty', () => {
    const a = row({ name: 'Barbell Curl', equipment: '', targetMuscle: 'biceps' });
    const b = row({ name: 'Dumbbell Curl', equipment: '', targetMuscle: 'biceps' });
    assert.equal(shouldMerge(a, b), false);
  });

  it('lets a dumbbell title beat a body-only equipment field', () => {
    const a = row({ name: 'Crunches', equipment: 'bodyweight', targetMuscle: 'abdominals' });
    const b = row({ name: 'Dumbbell Crunches', equipment: 'body only', targetMuscle: 'abdominals' });
    assert.equal(shouldMerge(a, b), false);
  });

  it('keeps hammer curl distinct from biceps curl', () => {
    const a = row({
      name: 'dumbbell incline biceps curl',
      equipment: 'dumbbell',
      targetMuscle: 'biceps',
    });
    const b = row({
      name: 'dumbbell incline hammer curl',
      equipment: 'dumbbell',
      targetMuscle: 'biceps',
    });
    assert.notEqual(nearKey(a), nearKey(b));
    assert.equal(shouldMerge(a, b), false);
  });

  it('keeps seated vs lying leg curl separate', () => {
    const a = row({
      name: 'Seated Leg Curl',
      equipment: 'machine',
      targetMuscle: 'hamstrings',
    });
    const b = row({
      name: 'Lying Leg Curls',
      equipment: 'machine',
      targetMuscle: 'hamstrings',
    });
    assert.notEqual(nearKey(a), nearKey(b));
    assert.equal(shouldMerge(a, b), false);
  });

  it('keeps incline vs flat bench separate', () => {
    const a = row({
      name: 'Incline Bench Press',
      equipment: 'barbell',
      targetMuscle: 'pectorals',
    });
    const b = row({
      name: 'Flat Bench Press',
      equipment: 'barbell',
      targetMuscle: 'pectorals',
    });
    assert.notEqual(nearKey(a), nearKey(b));
    assert.equal(shouldMerge(a, b), false);
  });

  it('keeps cable vs machine fly separate', () => {
    const a = row({
      name: 'Cable Fly',
      equipment: 'cable',
      targetMuscle: 'pectorals',
    });
    const b = row({
      name: 'Machine Fly',
      equipment: 'machine',
      targetMuscle: 'pectorals',
    });
    assert.equal(nearKey(a), nearKey(b));
    assert.equal(shouldMerge(a, b), false);
  });

  it('keeps smith calf raise distinct from machine calf raise', () => {
    const a = row({
      name: 'Smith Machine Calf Raise',
      equipment: 'machine',
      targetMuscle: 'calves',
    });
    const b = row({
      name: 'Machine Standing Calf Raise',
      equipment: 'machine',
      targetMuscle: 'calves',
    });
    assert.equal(shouldMerge(a, b), false);
  });
});

describe('canonical selection', () => {
  it('prefers completeness, then media, then exercisedb, then title clarity', () => {
    const thin = row({
      id: 'w1',
      name: 'lateral raise',
      source: 'wger',
      equipment: '',
      targetMuscle: '',
    });
    const withMedia = row({
      id: 'pd1',
      name: 'Lateral Raise',
      source: 'public_domain',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
      mediaUrl: 'https://example.com/a.gif',
      instructions: ['Raise arms'],
    });
    const edb = row({
      id: 'e1',
      name: 'Dumbbell Lateral Raise',
      source: 'exercisedb',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
      mediaUrl: 'https://example.com/b.gif',
      instructions: ['Stand tall', 'Raise arms to sides'],
      secondaryMuscles: ['traps'],
      category: 'Shoulders',
      isCompound: false,
    });
    assert.equal(pickCanonical([thin, withMedia, edb]).id, 'e1');
    assert.ok(compareCanonical(edb, withMedia) < 0);
  });

  it('prefers title-case when completeness ties', () => {
    const messy = row({
      id: 'a',
      name: 'dumbbell lateral raise',
      source: 'exercisedb',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
      mediaUrl: 'https://x/a.gif',
      instructions: ['one'],
    });
    const clean = row({
      id: 'b',
      name: 'Dumbbell Lateral Raise',
      source: 'exercisedb',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      bodyPart: 'shoulders',
      mediaUrl: 'https://x/b.gif',
      instructions: ['one'],
    });
    assert.equal(pickCanonical([messy, clean]).id, 'b');
  });
});
