import { describe, expect, it } from 'vitest';

import { applyLoggedSets } from './records';
import { memoryPairs, quizForRest } from './quiz';
import { restExtraFrom } from './rest';

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
