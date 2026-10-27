import { describe, expect, it } from 'vitest';

import { exerciseSearchScore } from './search';

describe('exerciseSearchScore', () => {
  it('matches keywords in any order', () => {
    expect(exerciseSearchScore('incline barbell press', 'barbell incline press')).toBe(0);
  });

  it('matches a missing letter', () => {
    const score = exerciseSearchScore('dumbell bench', 'dumbbell bench press');
    expect(score).not.toBeNull();
    expect(exerciseSearchScore('dumbbell bench', 'dumbbell bench press')).toBe(0);
    expect(score!).toBeGreaterThan(0);
  });

  it('matches an extra letter', () => {
    expect(exerciseSearchScore('barbbell incline press', 'barbell incline press')).not.toBeNull();
  });

  it('matches a swapped pair of letters', () => {
    expect(exerciseSearchScore('dumbblel press', 'dumbbell press')).not.toBeNull();
  });

  it('still matches a prefix while typing', () => {
    expect(exerciseSearchScore('incl bar', 'barbell incline press')).not.toBeNull();
  });

  it('rejects a query that is missing a word', () => {
    expect(exerciseSearchScore('incline squat', 'barbell incline press')).toBeNull();
  });

  it('does not fuzzy-match short unrelated words', () => {
    expect(exerciseSearchScore('cat', 'chest fly')).toBeNull();
    expect(exerciseSearchScore('arm', 'barbell curl')).toBeNull();
  });

  it('matches everything when the query is empty', () => {
    expect(exerciseSearchScore('   ', 'dumbbell press')).toBe(0);
  });
});
