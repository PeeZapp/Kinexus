import { describe, expect, it } from 'vitest';

import { applyLoggedSets, parseWeight } from './records';
import { memoryPairs, quizForRest } from './quiz';
import { restExtraFrom } from './rest';

describe('parseWeight', () => {
  it('parses plain numeric weights', () => {
    expect(parseWeight('55')).toBe(55);
    expect(parseWeight(' 60.5 ')).toBe(60.5);
  });

  it('never returns a bogus 0 from effort or other text', () => {
    expect(parseWeight('light')).toBeNull();
    expect(parseWeight('moderate')).toBeNull();
    expect(parseWeight('heavy')).toBeNull();
    expect(parseWeight('max')).toBeNull();
    expect(parseWeight('bodyweight')).toBeNull();
    expect(parseWeight('RPE 8')).toBeNull();
    expect(parseWeight('')).toBeNull();
  });
});

describe('applyLoggedSets', () => {
  it('marks a heavier done set as a personal record', () => {
    const update = applyLoggedSets(
      { lastWeight: '40', lastReps: '8', bestWeight: '50', bestReps: '5' },
      [
        { weight: '55', reps: '5', done: true },
        { weight: '40', reps: '8', done: false },
      ],
    );
    expect(update?.isPr).toBe(true);
    expect(update?.bestWeight).toBe('55');
    expect(update?.lastWeight).toBe('55');
  });

  it('ignores sets that are not checked off', () => {
    expect(applyLoggedSets(null, [{ weight: '100', reps: '1', done: false }])).toBeNull();
  });

  it('does not treat effort text as a zero-weight PR baseline', () => {
    const update = applyLoggedSets(
      { lastWeight: 'light', lastReps: '', bestWeight: 'light', bestReps: '' },
      [{ weight: '40', reps: '8', done: true }],
    );
    expect(update?.isPr).toBe(true);
    expect(update?.bestWeight).toBe('40');
  });
});

describe('rest extras', () => {
  it('stays off unless the user picks a game', () => {
    expect(restExtraFrom(null)).toBe('off');
    expect(restExtraFrom('quiz')).toBe('quiz');
    expect(restExtraFrom('memory')).toBe('memory');
  });

  it('builds a four-card memory board and a quiz', () => {
    expect(memoryPairs(['Bench press', 'Row'], 3)).toHaveLength(4);
    expect(quizForRest(2).choices).toHaveLength(3);
  });
});
