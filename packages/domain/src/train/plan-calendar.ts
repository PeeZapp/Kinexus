import { dayDateIso, type PlanWeekDbClient, type TrainingPlanDayRow, type TrainingPlanWeekRow } from './plan-week';
import type { Day } from '../meals/types';

export type PlanCalendarPush = (householdId: string, eventId: string) => Promise<void> | void;
export type PlanCalendarDeletePush = (householdId: string, eventId: string) => Promise<void> | void;

type QueryError = { message: string; code?: string } | null;

function isRlsOrOwnershipError(error: QueryError): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    error.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('violates row-level security') ||
    msg.includes('new row violates')
  );
}

const DEFAULT_TIME = '07:00';
const DEFAULT_DURATION_MIN = 40;

export function trainingPlanEventTitle(focus: string, durationMin: number): string {
  return `🏋️ ${focus || 'Train'} · ${durationMin} min`;
}

export function normalizePlanClock(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

export function addMinutesToPlanClock(
  dateIso: string,
  timeHhMm: string,
  minutes: number,
): { dateIso: string; timeHhMm: string } {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = timeHhMm.split(':').map(Number);
  const total = (hh ?? 0) * 60 + (mm ?? 0) + minutes;
  const dayDelta = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const outH = Math.floor(rem / 60);
  const outM = rem % 60;
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + dayDelta);
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return {
    dateIso: `${yy}-${mo}-${da}`,
    timeHhMm: `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`,
  };
}

export type PlanDaySchedule = {
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  usedDefaultTime: boolean;
  title: string;
};

export function computePlanDaySchedule(input: {
  weekStart: string;
  day: Day;
  focus: string[];
  scheduledTime: string | null;
  durationMin: number | null;
}): PlanDaySchedule {
  const usedDefaultTime = !normalizePlanClock(input.scheduledTime);
  const startTime = normalizePlanClock(input.scheduledTime) ?? DEFAULT_TIME;
  const durationMin =
    input.durationMin && input.durationMin > 0 ? input.durationMin : DEFAULT_DURATION_MIN;
  const startsOn = dayDateIso(input.weekStart, input.day);
  const end = addMinutesToPlanClock(startsOn, startTime, durationMin);
  return {
    startsOn,
    endsOn: end.dateIso,
    startTime,
    endTime: end.timeHhMm,
    durationMin,
    usedDefaultTime,
    title: trainingPlanEventTitle(input.focus[0] ?? 'Train', durationMin),
  };
}

export type UpsertPlanDayEventResult =
  | {
      status: 200;
      body: {
        dayId: string;
        eventId: string;
        created: boolean;
        usedDefaultTime: boolean;
        skipped: boolean;
      };
    }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

async function loadPlanWithDay(
  client: PlanWeekDbClient,
  dayId: string,
): Promise<
  | { ok: true; plan: TrainingPlanWeekRow; day: TrainingPlanDayRow }
  | { ok: false; status: 403 | 404 | 500; error: string }
> {
  const dayResult = await client
    .from('training_plan_days')
    .select(
      'id, plan_id, day, position, workout_id, generated_spec, rest_day, scheduled_time, duration_min, focus, status, session_id',
    )
    .eq('id', dayId)
    .maybeSingle();

  if (dayResult.error) {
    if (isRlsOrOwnershipError(dayResult.error)) {
      return { ok: false, status: 403, error: 'Not allowed to access this plan day' };
    }
    return { ok: false, status: 500, error: dayResult.error.message };
  }
  if (!dayResult.data || typeof dayResult.data !== 'object' || !('plan_id' in dayResult.data)) {
    return { ok: false, status: 404, error: 'Plan day not found' };
  }

  const dayRow = dayResult.data as Record<string, unknown>;
  const planId = String(dayRow.plan_id);
  const planResult = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
    .eq('id', planId)
    .maybeSingle();

  if (planResult.error) {
    if (isRlsOrOwnershipError(planResult.error)) {
      return { ok: false, status: 403, error: 'Not allowed to access this plan' };
    }
    return { ok: false, status: 500, error: planResult.error.message };
  }
  if (!planResult.data || typeof planResult.data !== 'object') {
    return { ok: false, status: 404, error: 'Plan not found' };
  }

  const plan = mapTrainingPlanRow(planResult.data as Record<string, unknown>);
  if (!plan) return { ok: false, status: 500, error: 'Could not read plan' };
  const day = plan.days.find((item) => item.id === dayId);
  if (!day) return { ok: false, status: 404, error: 'Plan day not found' };
  return { ok: true, plan, day };
}

/** Local mapper so plan-calendar stays usable without exporting mapPlanRow. */
function mapTrainingPlanRow(row: Record<string, unknown>): TrainingPlanWeekRow | null {
  if (typeof row.id !== 'string' || typeof row.household_id !== 'string' || typeof row.owner_id !== 'string') {
    return null;
  }
  const weekStart = typeof row.week_start === 'string' ? row.week_start : '';
  if (!weekStart) return null;
  const dayRows = Array.isArray(row.training_plan_days) ? row.training_plan_days : [];
  const shares = Array.isArray(row.training_plan_buddy_shares) ? row.training_plan_buddy_shares : [];
  const days: TrainingPlanDayRow[] = [];
  for (const raw of dayRows) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Record<string, unknown>;
    const day =
      typeof d.day === 'string' &&
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(d.day)
        ? (d.day as Day)
        : null;
    const status =
      d.status === 'planned' || d.status === 'done' || d.status === 'skipped' ? d.status : null;
    if (!day || !status || typeof d.id !== 'string') continue;
    days.push({
      id: d.id,
      planId: row.id,
      day,
      position: typeof d.position === 'number' ? d.position : 0,
      workoutId: typeof d.workout_id === 'string' ? d.workout_id : null,
      generatedSpec:
        d.generated_spec && typeof d.generated_spec === 'object' && !Array.isArray(d.generated_spec)
          ? (d.generated_spec as Record<string, unknown>)
          : null,
      restDay: Boolean(d.rest_day),
      scheduledTime: typeof d.scheduled_time === 'string' ? d.scheduled_time : null,
      durationMin: typeof d.duration_min === 'number' ? d.duration_min : null,
      focus: Array.isArray(d.focus) ? d.focus.map(String) : [],
      status,
      sessionId: typeof d.session_id === 'string' ? d.session_id : null,
    });
  }
  return {
    id: row.id,
    householdId: row.household_id,
    ownerId: row.owner_id,
    name: typeof row.name === 'string' ? row.name : 'Training plan',
    weekStart,
    visibility: (typeof row.visibility === 'string' ? row.visibility : 'private') as TrainingPlanWeekRow['visibility'],
    audiencePersonIds: Array.isArray(row.audience_person_ids) ? row.audience_person_ids.map(String) : [],
    prefs:
      row.prefs && typeof row.prefs === 'object' && !Array.isArray(row.prefs)
        ? (row.prefs as Record<string, unknown>)
        : {},
    calendarAutoSync: Boolean(row.calendar_auto_sync),
    buddyUserIds: shares
      .map((share) =>
        share && typeof share === 'object' && 'buddy_user_id' in share
          ? String((share as { buddy_user_id: unknown }).buddy_user_id)
          : '',
      )
      .filter(Boolean),
    days: days.sort((a, b) => a.position - b.position),
  };
}

async function replaceEventPeople(
  client: PlanWeekDbClient,
  eventId: string,
  householdId: string,
  personIds: string[],
): Promise<QueryError> {
  const del = await client.from('household_event_people').delete().eq('event_id', eventId);
  if (del.error) return del.error;
  if (personIds.length === 0) return null;
  const ins = await client.from('household_event_people').insert(
    personIds.map((personId) => ({
      event_id: eventId,
      person_id: personId,
      household_id: householdId,
    })),
  );
  return ins.error;
}

/**
 * Create or update the household_event for a training plan day (idempotent via mapping).
 * Rest days remove any existing mapped event.
 */
export async function handleUpsertTrainingPlanDayEvent(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    dayId: string;
    /** Force write even when auto-sync is off (manual "Add to calendar"). */
    force?: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<UpsertPlanDayEventResult> {
  if (!input.authUserId || !input.dayId) {
    return { status: 400, body: { error: 'authUserId and dayId are required' } };
  }

  const loaded = await loadPlanWithDay(client, input.dayId);
  if (!loaded.ok) return { status: loaded.status, body: { error: loaded.error } };
  const { plan, day } = loaded;
  if (plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only calendar-sync plans you own' } };
  }

  if (day.restDay) {
    const removed = await handleRemoveTrainingPlanDayEvent(client, {
      authUserId: input.authUserId,
      dayId: day.id,
      deleteFromGoogle: input.deleteFromGoogle,
    });
    if (removed.status !== 200) return removed;
    return {
      status: 200,
      body: {
        dayId: day.id,
        eventId: removed.body.eventId ?? '',
        created: false,
        usedDefaultTime: false,
        skipped: true,
      },
    };
  }

  if (!input.force && !plan.calendarAutoSync) {
    return {
      status: 200,
      body: {
        dayId: day.id,
        eventId: '',
        created: false,
        usedDefaultTime: false,
        skipped: true,
      },
    };
  }

  const schedule = computePlanDaySchedule({
    weekStart: plan.weekStart,
    day: day.day,
    focus: day.focus,
    scheduledTime: day.scheduledTime,
    durationMin: day.durationMin,
  });

  const mapping = await client
    .from('training_plan_day_events')
    .select('training_plan_day_id, household_event_id')
    .eq('training_plan_day_id', day.id)
    .maybeSingle();

  if (mapping.error) {
    if (isRlsOrOwnershipError(mapping.error)) {
      return { status: 403, body: { error: 'Not allowed to read calendar mapping' } };
    }
    return { status: 500, body: { error: mapping.error.message } };
  }

  const existingEventId =
    mapping.data && typeof mapping.data === 'object' && 'household_event_id' in mapping.data
      ? String((mapping.data as { household_event_id: string }).household_event_id)
      : null;

  const eventPayload = {
    title: schedule.title,
    notes: plan.name,
    location: '',
    all_day: false,
    starts_on: schedule.startsOn,
    ends_on: schedule.endsOn,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    color: 'coral' as const,
    remind_minutes: null,
    recurrence: 'none',
    until_on: null,
  };

  if (existingEventId) {
    const update = await client
      .from('household_events')
      .update(eventPayload)
      .eq('id', existingEventId)
      .eq('household_id', plan.householdId)
      .select('id')
      .maybeSingle();
    if (update.error) {
      if (isRlsOrOwnershipError(update.error)) {
        return { status: 403, body: { error: 'Not allowed to update calendar event' } };
      }
      return { status: 500, body: { error: update.error.message } };
    }
    if (!update.data) {
      return { status: 404, body: { error: 'Mapped calendar event missing' } };
    }
    const peopleError = await replaceEventPeople(
      client,
      existingEventId,
      plan.householdId,
      plan.audiencePersonIds,
    );
    if (peopleError) return { status: 500, body: { error: peopleError.message } };
    await input.pushToGoogle?.(plan.householdId, existingEventId);
    return {
      status: 200,
      body: {
        dayId: day.id,
        eventId: existingEventId,
        created: false,
        usedDefaultTime: schedule.usedDefaultTime,
        skipped: false,
      },
    };
  }

  const insert = await client
    .from('household_events')
    .insert({
      household_id: plan.householdId,
      created_by: input.authUserId,
      ...eventPayload,
    })
    .select('id')
    .single();

  if (insert.error || !insert.data || typeof insert.data !== 'object' || !('id' in insert.data)) {
    if (isRlsOrOwnershipError(insert.error)) {
      return { status: 403, body: { error: 'Not allowed to create calendar event' } };
    }
    return { status: 500, body: { error: insert.error?.message ?? 'Could not create event' } };
  }

  const eventId = String((insert.data as { id: string }).id);
  const peopleError = await replaceEventPeople(client, eventId, plan.householdId, plan.audiencePersonIds);
  if (peopleError) {
    await client.from('household_events').delete().eq('id', eventId);
    return { status: 500, body: { error: peopleError.message } };
  }

  const mapInsert = await client.from('training_plan_day_events').insert({
    training_plan_day_id: day.id,
    household_event_id: eventId,
  });
  if (mapInsert.error) {
    await client.from('household_events').delete().eq('id', eventId);
    if (isRlsOrOwnershipError(mapInsert.error)) {
      return { status: 403, body: { error: 'Not allowed to store calendar mapping' } };
    }
    return { status: 500, body: { error: mapInsert.error.message } };
  }

  await input.pushToGoogle?.(plan.householdId, eventId);
  return {
    status: 200,
    body: {
      dayId: day.id,
      eventId,
      created: true,
      usedDefaultTime: schedule.usedDefaultTime,
      skipped: false,
    },
  };
}

export type RemovePlanDayEventResult =
  | { status: 200; body: { dayId: string; eventId: string | null; removed: boolean } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleRemoveTrainingPlanDayEvent(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    dayId: string;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<RemovePlanDayEventResult> {
  if (!input.authUserId || !input.dayId) {
    return { status: 400, body: { error: 'authUserId and dayId are required' } };
  }

  const loaded = await loadPlanWithDay(client, input.dayId);
  if (!loaded.ok) return { status: loaded.status, body: { error: loaded.error } };
  if (loaded.plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only calendar-sync plans you own' } };
  }

  const mapping = await client
    .from('training_plan_day_events')
    .select('training_plan_day_id, household_event_id')
    .eq('training_plan_day_id', input.dayId)
    .maybeSingle();

  if (mapping.error) {
    if (isRlsOrOwnershipError(mapping.error)) {
      return { status: 403, body: { error: 'Not allowed to read calendar mapping' } };
    }
    return { status: 500, body: { error: mapping.error.message } };
  }
  if (!mapping.data || typeof mapping.data !== 'object' || !('household_event_id' in mapping.data)) {
    return { status: 200, body: { dayId: input.dayId, eventId: null, removed: false } };
  }

  const eventId = String((mapping.data as { household_event_id: string }).household_event_id);
  await input.deleteFromGoogle?.(loaded.plan.householdId, eventId);

  const delMap = await client.from('training_plan_day_events').delete().eq('training_plan_day_id', input.dayId);
  if (delMap.error) {
    if (isRlsOrOwnershipError(delMap.error)) {
      return { status: 403, body: { error: 'Not allowed to delete calendar mapping' } };
    }
    return { status: 500, body: { error: delMap.error.message } };
  }

  const delEvent = await client
    .from('household_events')
    .delete()
    .eq('id', eventId)
    .eq('household_id', loaded.plan.householdId);
  if (delEvent.error) {
    if (isRlsOrOwnershipError(delEvent.error)) {
      return { status: 403, body: { error: 'Not allowed to delete calendar event' } };
    }
    return { status: 500, body: { error: delEvent.error.message } };
  }

  return { status: 200, body: { dayId: input.dayId, eventId, removed: true } };
}

export type PlanDayEventSyncBody = {
  dayId: string;
  eventId: string;
  created: boolean;
  usedDefaultTime: boolean;
  skipped: boolean;
};

export type SyncPlanCalendarResult =
  | {
      status: 200;
      body: {
        planId: string;
        results: PlanDayEventSyncBody[];
        usedDefaultTimeDays: string[];
      };
    }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleSyncTrainingPlanToCalendar(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    force?: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<SyncPlanCalendarResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }

  const planResult = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
    .eq('id', input.planId)
    .maybeSingle();

  if (planResult.error) {
    if (isRlsOrOwnershipError(planResult.error)) {
      return { status: 403, body: { error: 'Not allowed to sync this plan' } };
    }
    return { status: 500, body: { error: planResult.error.message } };
  }
  if (!planResult.data || typeof planResult.data !== 'object') {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = mapTrainingPlanRow(planResult.data as Record<string, unknown>);
  if (!plan) return { status: 500, body: { error: 'Could not read plan' } };
  if (plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only calendar-sync plans you own' } };
  }

  if (!input.force && !plan.calendarAutoSync) {
    return { status: 200, body: { planId: plan.id, results: [], usedDefaultTimeDays: [] } };
  }

  const results: PlanDayEventSyncBody[] = [];
  const usedDefaultTimeDays: string[] = [];

  for (const day of plan.days) {
    const result = await handleUpsertTrainingPlanDayEvent(client, {
      authUserId: input.authUserId,
      dayId: day.id,
      force: true,
      pushToGoogle: input.pushToGoogle,
      deleteFromGoogle: input.deleteFromGoogle,
    });
    if (result.status !== 200) {
      return { status: result.status, body: { error: result.body.error } };
    }
    results.push(result.body);
    if (result.body.usedDefaultTime && !result.body.skipped) {
      usedDefaultTimeDays.push(day.id);
    }
  }

  return { status: 200, body: { planId: plan.id, results, usedDefaultTimeDays } };
}

export type SetCalendarAutoSyncResult =
  | { status: 200; body: { planId: string; calendarAutoSync: boolean } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleSetTrainingPlanCalendarAutoSync(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    calendarAutoSync: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<SetCalendarAutoSyncResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }

  const update = await client
    .from('training_plans')
    .update({ calendar_auto_sync: Boolean(input.calendarAutoSync) })
    .eq('id', input.planId)
    .eq('owner_id', input.authUserId)
    .select('id, calendar_auto_sync')
    .maybeSingle();

  if (update.error) {
    if (isRlsOrOwnershipError(update.error)) {
      return { status: 403, body: { error: 'Not allowed to update calendar auto-sync' } };
    }
    return { status: 500, body: { error: update.error.message } };
  }
  if (!update.data || typeof update.data !== 'object' || !('id' in update.data)) {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const enabled = Boolean((update.data as { calendar_auto_sync: boolean }).calendar_auto_sync);
  if (enabled) {
    const sync = await handleSyncTrainingPlanToCalendar(client, {
      authUserId: input.authUserId,
      planId: input.planId,
      force: true,
      pushToGoogle: input.pushToGoogle,
      deleteFromGoogle: input.deleteFromGoogle,
    });
    if (sync.status !== 200) return sync;
  }

  return { status: 200, body: { planId: input.planId, calendarAutoSync: enabled } };
}

export type UpdatePlanDayScheduleResult =
  | {
      status: 200;
      body: {
        dayId: string;
        scheduledTime: string | null;
        durationMin: number | null;
        day: Day;
        synced: boolean;
        eventId: string | null;
        usedDefaultTime: boolean;
      };
    }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

/** Edit schedule fields; when auto-sync is on, upsert/remove mapped events. */
export async function handleUpdateTrainingPlanDaySchedule(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    dayId: string;
    scheduledTime?: string | null;
    durationMin?: number | null;
    day?: Day;
    restDay?: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<UpdatePlanDayScheduleResult> {
  if (!input.authUserId || !input.dayId) {
    return { status: 400, body: { error: 'authUserId and dayId are required' } };
  }

  const loaded = await loadPlanWithDay(client, input.dayId);
  if (!loaded.ok) return { status: loaded.status, body: { error: loaded.error } };
  if (loaded.plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only edit plans you own' } };
  }

  const patch: Record<string, unknown> = {};
  if (input.scheduledTime !== undefined) {
    patch.scheduled_time = normalizePlanClock(input.scheduledTime);
  }
  if (input.durationMin !== undefined) {
    patch.duration_min =
      input.durationMin == null || input.durationMin <= 0 ? null : Math.round(input.durationMin);
  }
  if (input.day !== undefined) patch.day = input.day;
  if (input.restDay !== undefined) {
    patch.rest_day = Boolean(input.restDay);
    if (input.restDay) {
      patch.workout_id = null;
      patch.duration_min = null;
      patch.focus = [];
    }
  }

  if (Object.keys(patch).length === 0) {
    return { status: 400, body: { error: 'No schedule fields to update' } };
  }

  const update = await client
    .from('training_plan_days')
    .update(patch)
    .eq('id', input.dayId)
    .select(
      'id, day, rest_day, scheduled_time, duration_min, focus, status, session_id, workout_id, position, generated_spec',
    )
    .maybeSingle();

  if (update.error) {
    if (isRlsOrOwnershipError(update.error)) {
      return { status: 403, body: { error: 'Not allowed to update this plan day' } };
    }
    return { status: 500, body: { error: update.error.message } };
  }
  if (!update.data || typeof update.data !== 'object' || !('id' in update.data)) {
    return { status: 404, body: { error: 'Plan day not found' } };
  }

  const row = update.data as Record<string, unknown>;
  const restDay = Boolean(row.rest_day);
  let synced = false;
  let eventId: string | null = null;
  let usedDefaultTime = false;

  if (loaded.plan.calendarAutoSync) {
    if (restDay) {
      const removed = await handleRemoveTrainingPlanDayEvent(client, {
        authUserId: input.authUserId,
        dayId: input.dayId,
        deleteFromGoogle: input.deleteFromGoogle,
      });
      if (removed.status !== 200) return removed;
      synced = removed.body.removed;
      eventId = removed.body.eventId;
    } else {
      const upsert = await handleUpsertTrainingPlanDayEvent(client, {
        authUserId: input.authUserId,
        dayId: input.dayId,
        force: true,
        pushToGoogle: input.pushToGoogle,
        deleteFromGoogle: input.deleteFromGoogle,
      });
      if (upsert.status !== 200) return upsert;
      synced = !upsert.body.skipped;
      eventId = upsert.body.eventId || null;
      usedDefaultTime = upsert.body.usedDefaultTime;
    }
  }

  return {
    status: 200,
    body: {
      dayId: input.dayId,
      scheduledTime: typeof row.scheduled_time === 'string' ? row.scheduled_time : null,
      durationMin: typeof row.duration_min === 'number' ? row.duration_min : null,
      day: row.day as Day,
      synced,
      eventId,
      usedDefaultTime,
    },
  };
}

/** After regenerate/duplicate mutations: sync mapped events when auto-sync is on. */
export async function syncPlanCalendarIfEnabled(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    calendarAutoSync: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<{ ok: true } | { ok: false; status: 400 | 403 | 404 | 500; error: string }> {
  if (!input.calendarAutoSync) return { ok: true };
  const sync = await handleSyncTrainingPlanToCalendar(client, {
    authUserId: input.authUserId,
    planId: input.planId,
    force: true,
    pushToGoogle: input.pushToGoogle,
    deleteFromGoogle: input.deleteFromGoogle,
  });
  if (sync.status !== 200) {
    return { ok: false, status: sync.status, error: sync.body.error };
  }
  return { ok: true };
}
