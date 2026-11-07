import { describe, expect, it, vi } from 'vitest';

import type { PlanWeekDbClient } from './training-plan-week.js';
import {
  handleRemoveTrainingPlanDayEvent,
  handleSetTrainingPlanCalendarAutoSync,
  handleSyncTrainingPlanToCalendar,
  handleUpdateTrainingPlanDaySchedule,
  handleUpsertTrainingPlanDayEvent,
} from './training-plan-calendar.js';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

const ops: { table: string; op: string; payload?: unknown }[] = [];

function makeClient(state: {
  mapping?: { training_plan_day_id: string; household_event_id: string } | null;
  autoSync?: boolean;
  restDay?: boolean;
}): PlanWeekDbClient {
  ops.length = 0;
  let mapping = state.mapping ?? null;
  let autoSync = state.autoSync ?? true;
  let restDay = state.restDay ?? false;
  let scheduledTime: string | null = '07:00';
  let durationMin: number | null = 40;
  let eventSeq = 1;

  function dayData() {
    return {
      id: 'day-wed',
      plan_id: 'plan-1',
      day: 'wednesday',
      position: 2,
      workout_id: restDay ? null : 'w-wed',
      generated_spec: restDay ? null : { focus: ['Pull'] },
      rest_day: restDay,
      scheduled_time: restDay ? null : scheduledTime,
      duration_min: restDay ? null : durationMin,
      focus: restDay ? [] : ['Pull'],
      status: 'planned',
      session_id: null,
    };
  }

  function planData() {
    return {
      id: 'plan-1',
      household_id: 'hh1',
      owner_id: 'user-a',
      name: 'Week',
      week_start: '2026-11-02',
      visibility: 'people',
      audience_person_ids: ['person-1'],
      prefs: {},
      calendar_auto_sync: autoSync,
      training_plan_days: [dayData()],
      training_plan_buddy_shares: [],
    };
  }

  return {
    from(table: string) {
      let lastWrite: unknown;
      const api: Record<string, unknown> = {};
      const self = new Proxy(api, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (value: QueryResult) => unknown) =>
              Promise.resolve(resolveResult()).then(resolve);
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => resolveResult();
          }
          if (prop === 'select' || prop === 'eq' || prop === 'in' || prop === 'order') {
            return () => self;
          }
          if (prop === 'insert' || prop === 'upsert' || prop === 'update' || prop === 'delete') {
            return (payload?: unknown) => {
              lastWrite = payload;
              ops.push({ table, op: String(prop), payload });
              if (table === 'training_plan_day_events') {
                if (prop === 'insert' && payload && typeof payload === 'object') {
                  mapping = payload as { training_plan_day_id: string; household_event_id: string };
                }
                if (prop === 'delete') mapping = null;
              }
              if (table === 'training_plans' && prop === 'update' && payload && typeof payload === 'object') {
                if ('calendar_auto_sync' in payload) {
                  autoSync = Boolean((payload as { calendar_auto_sync: boolean }).calendar_auto_sync);
                }
              }
              if (table === 'training_plan_days' && prop === 'update' && payload && typeof payload === 'object') {
                const patch = payload as Record<string, unknown>;
                if ('rest_day' in patch) restDay = Boolean(patch.rest_day);
                if ('scheduled_time' in patch) scheduledTime = (patch.scheduled_time as string | null) ?? null;
                if ('duration_min' in patch) durationMin = (patch.duration_min as number | null) ?? null;
              }
              if (table === 'household_events' && prop === 'insert') {
                lastWrite = { id: `evt-${eventSeq++}` };
              }
              return self;
            };
          }
          return () => self;
        },
      });

      function resolveResult(): QueryResult {
        if (table === 'training_plan_days') return { data: dayData(), error: null };
        if (table === 'training_plans') {
          return {
            data:
              lastWrite && typeof lastWrite === 'object' && 'calendar_auto_sync' in (lastWrite as object)
                ? { id: 'plan-1', calendar_auto_sync: autoSync }
                : planData(),
            error: null,
          };
        }
        if (table === 'training_plan_day_events') return { data: mapping, error: null };
        if (table === 'household_events') {
          if (lastWrite && typeof lastWrite === 'object' && 'id' in (lastWrite as object)) {
            return { data: lastWrite, error: null };
          }
          return { data: { id: mapping?.household_event_id ?? `evt-${eventSeq}` }, error: null };
        }
        return { data: null, error: null };
      }

      return self;
    },
  };
}

describe('training plan calendar mapping', () => {
  it('creates mapping then updates idempotently', async () => {
    const push = vi.fn(async () => undefined);
    const client = makeClient({ mapping: null, autoSync: true });

    const created = await handleUpsertTrainingPlanDayEvent(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      force: true,
      pushToGoogle: push,
    });
    expect(created.status).toBe(200);
    if (created.status !== 200) return;
    expect(created.body.created).toBe(true);
    expect(created.body.eventId).toBeTruthy();
    expect(push).toHaveBeenCalledWith('hh1', created.body.eventId);
    expect(ops.some((op) => op.table === 'household_events' && op.op === 'insert')).toBe(true);
    expect(ops.some((op) => op.table === 'training_plan_day_events' && op.op === 'insert')).toBe(true);

    const updated = await handleUpsertTrainingPlanDayEvent(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      force: true,
      pushToGoogle: push,
    });
    expect(updated.status).toBe(200);
    if (updated.status !== 200) return;
    expect(updated.body.created).toBe(false);
    expect(updated.body.eventId).toBe(created.body.eventId);
    expect(ops.some((op) => op.table === 'household_events' && op.op === 'update')).toBe(true);
  });

  it('deletes mapping + event', async () => {
    const del = vi.fn(async () => undefined);
    const client = makeClient({
      mapping: { training_plan_day_id: 'day-wed', household_event_id: 'evt-9' },
    });
    const removed = await handleRemoveTrainingPlanDayEvent(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      deleteFromGoogle: del,
    });
    expect(removed.status).toBe(200);
    if (removed.status !== 200) return;
    expect(removed.body.removed).toBe(true);
    expect(del).toHaveBeenCalledWith('hh1', 'evt-9');
    expect(ops.some((op) => op.table === 'training_plan_day_events' && op.op === 'delete')).toBe(true);
    expect(ops.some((op) => op.table === 'household_events' && op.op === 'delete')).toBe(true);
  });

  it('auto-sync off skips event writes unless force', async () => {
    const push = vi.fn(async () => undefined);
    const client = makeClient({ mapping: null, autoSync: false });

    const skipped = await handleUpsertTrainingPlanDayEvent(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      pushToGoogle: push,
    });
    expect(skipped.status).toBe(200);
    if (skipped.status !== 200) return;
    expect(skipped.body.skipped).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(ops.some((op) => op.table === 'household_events' && op.op === 'insert')).toBe(false);

    const forced = await handleUpsertTrainingPlanDayEvent(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      force: true,
      pushToGoogle: push,
    });
    expect(forced.status).toBe(200);
    if (forced.status !== 200) return;
    expect(forced.body.skipped).toBe(false);
    expect(push).toHaveBeenCalled();
  });

  it('plan sync with auto-sync off writes nothing', async () => {
    const push = vi.fn(async () => undefined);
    const client = makeClient({ mapping: null, autoSync: false });
    const sync = await handleSyncTrainingPlanToCalendar(client, {
      authUserId: 'user-a',
      planId: 'plan-1',
      pushToGoogle: push,
    });
    expect(sync.status).toBe(200);
    if (sync.status !== 200) return;
    expect(sync.body.results).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(ops.some((op) => op.table === 'household_events')).toBe(false);
  });

  it('schedule update with auto-sync off does not write events', async () => {
    const push = vi.fn(async () => undefined);
    const client = makeClient({ mapping: null, autoSync: false });
    const result = await handleUpdateTrainingPlanDaySchedule(client, {
      authUserId: 'user-a',
      dayId: 'day-wed',
      scheduledTime: '08:30',
      durationMin: 50,
      pushToGoogle: push,
    });
    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.synced).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(ops.some((op) => op.table === 'household_events')).toBe(false);
  });

  it('enabling auto-sync syncs days and pushes', async () => {
    const push = vi.fn(async () => undefined);
    const client = makeClient({ mapping: null, autoSync: false });
    const result = await handleSetTrainingPlanCalendarAutoSync(client, {
      authUserId: 'user-a',
      planId: 'plan-1',
      calendarAutoSync: true,
      pushToGoogle: push,
    });
    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.calendarAutoSync).toBe(true);
    expect(push).toHaveBeenCalled();
  });
});
