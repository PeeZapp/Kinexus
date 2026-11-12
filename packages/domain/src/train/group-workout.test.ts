import { describe, expect, it } from 'vitest';

import {
  GROUP_WORKOUT_JOIN_ALPHABET,
  generateJoinCode,
  isGroupPickingDue,
  orderGroupPicks,
  type GroupWorkoutOrderPick,
} from './group-workout';

function pick(
  partial: Partial<GroupWorkoutOrderPick> & Pick<GroupWorkoutOrderPick, 'id' | 'userId' | 'category'>,
): GroupWorkoutOrderPick {
  return {
    exerciseId: partial.exerciseId ?? partial.id,
    name: partial.name ?? partial.category,
    ...partial,
  };
}

describe('orderGroupPicks', () => {
  it('puts compounds before arms and cardio last', () => {
    const ordered = orderGroupPicks([
      pick({ id: 'c1', userId: 'u1', category: 'Cardio', name: 'Treadmill', targetUnit: 'min' }),
      pick({ id: 'b1', userId: 'u2', category: 'Biceps', name: 'Curl' }),
      pick({ id: 'l1', userId: 'u1', category: 'Legs', name: 'Squat' }),
      pick({ id: 's1', userId: 'u2', category: 'Shoulders', name: 'Press' }),
      pick({ id: 'k1', userId: 'u1', category: 'Core', name: 'Plank', targetUnit: 'sec' }),
      pick({ id: 't1', userId: 'u2', category: 'Back', name: 'Row' }),
    ]);

    expect(ordered.map((row) => row.id)).toEqual(['l1', 't1', 's1', 'b1', 'k1', 'c1']);
  });

  it('keeps a member together within a tier and is stable for ties', () => {
    const ordered = orderGroupPicks([
      pick({ id: 'a2', userId: 'u2', category: 'Chest', name: 'Fly', createdAt: '2026-11-12T10:00:02Z' }),
      pick({ id: 'a1', userId: 'u1', category: 'Chest', name: 'Bench', createdAt: '2026-11-12T10:00:01Z' }),
      pick({ id: 'a3', userId: 'u1', category: 'Chest', name: 'Dip', createdAt: '2026-11-12T10:00:03Z' }),
      pick({ id: 'z1', userId: 'u2', category: 'Cardio', name: 'Bike', targetUnit: 'min', createdAt: '2026-11-12T10:00:00Z' }),
    ]);

    expect(ordered.map((row) => row.id)).toEqual(['a1', 'a3', 'a2', 'z1']);
  });

  it('treats distance tracking as last tier even when category is Legs', () => {
    const ordered = orderGroupPicks([
      pick({ id: 'd1', userId: 'u1', category: 'Legs', name: 'Farmers walk 200 m', targetUnit: 'm' }),
      pick({ id: 's1', userId: 'u1', category: 'Legs', name: 'Squat' }),
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['s1', 'd1']);
  });
});

describe('isGroupPickingDue', () => {
  const group = {
    closesAt: '2026-11-12T12:00:00.000Z',
    picksPerPerson: 2,
    status: 'picking' as const,
  };
  const members = [{ userId: 'a' }, { userId: 'b' }];

  it('is due when close time has passed', () => {
    expect(
      isGroupPickingDue(group, members, [{ userId: 'a' }], '2026-11-12T12:00:00.000Z'),
    ).toBe(true);
  });

  it('is due when every member used all picks', () => {
    expect(
      isGroupPickingDue(
        group,
        members,
        [
          { userId: 'a' },
          { userId: 'a' },
          { userId: 'b' },
          { userId: 'b' },
        ],
        '2026-11-12T11:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('is not due before close when someone still has picks', () => {
    expect(
      isGroupPickingDue(
        group,
        members,
        [{ userId: 'a' }, { userId: 'a' }, { userId: 'b' }],
        '2026-11-12T11:00:00.000Z',
      ),
    ).toBe(false);
  });
});

describe('generateJoinCode', () => {
  it('uses the safe alphabet only', () => {
    let i = 0;
    const code = generateJoinCode(() => {
      const values = [0, 0.1, 0.5, 0.9, 0.25, 0.75];
      const value = values[i % values.length] ?? 0;
      i += 1;
      return value;
    });
    expect(code).toHaveLength(6);
    expect(code).toBe(code.toUpperCase());
    for (const ch of code) {
      expect(GROUP_WORKOUT_JOIN_ALPHABET).toContain(ch);
    }
    expect(code).not.toMatch(/[01OI]/);
  });

  it('alphabet excludes ambiguous characters', () => {
    expect(GROUP_WORKOUT_JOIN_ALPHABET).not.toMatch(/[01OI]/);
    expect(GROUP_WORKOUT_JOIN_ALPHABET).toHaveLength(32);
  });
});
