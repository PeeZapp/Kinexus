import { describe, expect, it } from 'vitest';

import {
  applySlotOpToList,
  inverseSlotOp,
  overlayPendingSlotOps,
  type PlanOverlaySlot,
  type SlotOutboxOp,
} from './slot-outbox-ops';

const baseSlot = (over: Partial<PlanOverlaySlot> = {}): PlanOverlaySlot => ({
  id: 'slot-1',
  day: 'monday',
  slotKey: 'dinner',
  recipeId: 'recipe-1',
  recipeName: 'Pasta',
  emoji: '🍝',
  protein: 30,
  calories: 500,
  carbs: 60,
  fat: 12,
  cookTime: 20,
  audiencePersonIds: [],
  sideRecipeIds: ['side-1'],
  targetServings: 4,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const baseOp = (over: Partial<SlotOutboxOp> = {}): SlotOutboxOp => ({
  id: 'op-1',
  householdId: 'hh-1',
  weekStart: '2026-01-05',
  day: 'monday',
  slotKey: 'dinner',
  slotId: 'slot-1',
  audiencePersonIds: [],
  kind: 'hide',
  hidden: true,
  clientUpdatedAt: '2026-01-02T00:00:00.000Z',
  ...over,
});

describe('overlayPendingSlotOps', () => {
  it('keeps unsynced hide/delete after a server refetch', () => {
    const server = [
      baseSlot(),
      baseSlot({
        id: 'slot-2',
        audiencePersonIds: ['p1'],
        recipeName: 'Salad',
        recipeId: 'recipe-2',
      }),
    ];
    const pending: SlotOutboxOp[] = [
      baseOp({ kind: 'hide', hidden: true }),
      baseOp({
        id: 'op-2',
        kind: 'delete',
        slotId: 'slot-2',
        audiencePersonIds: ['p1'],
      }),
    ];
    const next = overlayPendingSlotOps(server, pending, '2026-01-05');
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('slot-1');
    expect(next[0]?.hidden).toBe(true);
  });

  it('returns empty when a reset-week is pending', () => {
    const next = overlayPendingSlotOps(
      [baseSlot()],
      [baseOp({ kind: 'reset-week', slotId: 'week-reset' })],
      '2026-01-05',
    );
    expect(next).toEqual([]);
  });

  it('ignores pending ops for other weeks', () => {
    const server = [baseSlot()];
    const next = overlayPendingSlotOps(
      server,
      [baseOp({ weekStart: '2026-01-12', kind: 'clear' })],
      '2026-01-05',
    );
    expect(next).toEqual(server);
  });
});

describe('inverseSlotOp', () => {
  it('unhides a hide op', () => {
    const previous = baseSlot({ hidden: false });
    const inverse = inverseSlotOp(baseOp({ kind: 'hide', hidden: true }), previous);
    expect(inverse).toMatchObject({
      kind: 'hide',
      hidden: false,
      slotId: 'slot-1',
    });
  });

  it('restores a deleted audience row', () => {
    const previous = baseSlot({
      id: 'aud-1',
      audiencePersonIds: ['p1'],
      recipeName: 'Omelette',
      recipeId: 'recipe-9',
    });
    const inverse = inverseSlotOp(
      baseOp({ kind: 'delete', slotId: 'aud-1', audiencePersonIds: ['p1'] }),
      previous,
    );
    expect(inverse).toMatchObject({
      kind: 'assign',
      slotId: 'aud-1',
      audiencePersonIds: ['p1'],
      recipeId: 'recipe-9',
      recipeName: 'Omelette',
    });
  });

  it('restores meal content after hide+clear', () => {
    const previous = baseSlot();
    const inverse = inverseSlotOp(baseOp({ kind: 'hide', hidden: true, clearMeal: true }), previous);
    expect(inverse).toMatchObject({
      kind: 'assign',
      recipeId: 'recipe-1',
      recipeName: 'Pasta',
      sideRecipeIds: ['side-1'],
      hidden: false,
    });
  });
});

describe('applySlotOpToList', () => {
  it('removes a deleted slot', () => {
    const next = applySlotOpToList([baseSlot()], baseOp({ kind: 'delete' }));
    expect(next).toEqual([]);
  });
});
