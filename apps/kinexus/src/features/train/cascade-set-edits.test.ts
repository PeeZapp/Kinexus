import { describe, expect, it } from 'vitest';

import { cascadeSetEdits } from './cascade-set-edits';

describe('cascadeSetEdits', () => {
  const sets = [
    { id: 'a', position: 0, setIndex: 0, done: true, weight: '50', reps: '10' },
    { id: 'b', position: 0, setIndex: 1, done: false, weight: '50', reps: '10' },
    { id: 'c', position: 0, setIndex: 2, done: false, weight: '50', reps: '10' },
    { id: 'd', position: 1, setIndex: 0, done: false, weight: '20', reps: '12' },
  ];

  it('updates the edited row and unfinished rows below in the same exercise', () => {
    expect(cascadeSetEdits(sets, 'b', { weight: '60', reps: '8' })).toEqual([
      { id: 'a', position: 0, setIndex: 0, done: true, weight: '50', reps: '10' },
      { id: 'b', position: 0, setIndex: 1, done: false, weight: '60', reps: '8' },
      { id: 'c', position: 0, setIndex: 2, done: false, weight: '60', reps: '8' },
      { id: 'd', position: 1, setIndex: 0, done: false, weight: '20', reps: '12' },
    ]);
  });

  it('cascades from a completed set into unfinished sets below, not other exercises', () => {
    const next = cascadeSetEdits(sets, 'a', { weight: '70', reps: '5' });
    expect(next[0]).toEqual({ id: 'a', position: 0, setIndex: 0, done: true, weight: '70', reps: '5' });
    expect(next[1]?.weight).toBe('70');
    expect(next[2]?.weight).toBe('70');
    expect(next[3]?.weight).toBe('20');
  });

  it('never changes a completed set below the edit', () => {
    const mixed = [
      { id: 'a', position: 0, setIndex: 0, done: false, weight: '50', reps: '10' },
      { id: 'b', position: 0, setIndex: 1, done: true, weight: '55', reps: '8' },
      { id: 'c', position: 0, setIndex: 2, done: false, weight: '50', reps: '10' },
    ];
    expect(cascadeSetEdits(mixed, 'a', { weight: '60', reps: '8' })).toEqual([
      { id: 'a', position: 0, setIndex: 0, done: false, weight: '60', reps: '8' },
      { id: 'b', position: 0, setIndex: 1, done: true, weight: '55', reps: '8' },
      { id: 'c', position: 0, setIndex: 2, done: false, weight: '60', reps: '8' },
    ]);
  });
});
