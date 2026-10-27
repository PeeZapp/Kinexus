import { describe, expect, it } from 'vitest';

import { clusterExercises, linkSuperset, normalizeSupersets, unlinkSuperset } from './supersets';

function row(name: string, supersetId: string | null = null) {
  return { name, supersetId };
}

describe('linkSuperset', () => {
  it('moves the partner directly after the source', () => {
    const next = linkSuperset([row('a'), row('b'), row('c')], 0, 2, () => 'ss-1');
    expect(next.map((item) => item.name)).toEqual(['a', 'c', 'b']);
    expect(next[0]?.supersetId).toBe('ss-1');
    expect(next[1]?.supersetId).toBe('ss-1');
    expect(next[2]?.supersetId).toBeNull();
  });

  it('adds another exercise onto an existing superset', () => {
    const next = linkSuperset([row('a', 'ss-1'), row('b', 'ss-1'), row('c')], 0, 2, () => 'unused');
    expect(next.map((item) => item.name)).toEqual(['a', 'b', 'c']);
    expect(next.every((item) => item.supersetId === 'ss-1')).toBe(true);
  });

  it('releases a partner that would be left alone', () => {
    const next = linkSuperset([row('a', 'ss-1'), row('b', 'ss-1'), row('c', 'ss-2'), row('d', 'ss-2')], 0, 2, () => 'unused');
    expect(next.find((item) => item.name === 'c')?.supersetId).toBe('ss-1');
    expect(next.find((item) => item.name === 'd')?.supersetId).toBeNull();
  });
});

describe('unlinkSuperset', () => {
  it('clears the whole group', () => {
    const next = unlinkSuperset([row('a', 'ss-1'), row('b', 'ss-1'), row('c')], 1);
    expect(next.map((item) => item.supersetId)).toEqual([null, null, null]);
  });
});

describe('clusterExercises', () => {
  it('groups only consecutive partners', () => {
    expect(clusterExercises([row('a', 'ss'), row('b', 'ss'), row('c')])).toEqual([
      { type: 'superset', indices: [0, 1] },
      { type: 'single', indices: [2] },
    ]);
  });

  it('treats a leftover id as a single exercise', () => {
    expect(normalizeSupersets([row('a', 'ss')])).toEqual([row('a', null)]);
    expect(clusterExercises([row('a', 'ss')])).toEqual([{ type: 'single', indices: [0] }]);
  });
});
