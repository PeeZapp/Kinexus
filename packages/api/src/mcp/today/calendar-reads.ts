import type { SupabaseClient } from '@supabase/supabase-js';
import {
  expandEventsInRange,
  normalizeCalendarRecurrence,
  type CalendarColor,
  type CalendarEvent,
  type CalendarRecurrence,
} from '@kinexus/domain';

import { resolveCallerHousehold } from './shared.js';

export const CALENDAR_EVENT_NOT_FOUND = 'Calendar event not found';

export type CalendarEventSummary = {
  id: string;
  title: string;
  notes: string;
  location: string;
  allDay: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  remindMinutes: number | null;
  recurrence: string;
  untilOn: string | null;
  personIds: string[];
  createdBy: string | null;
};

function timeFromDb(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  return value.slice(0, 5);
}

function mapMaster(
  row: Record<string, unknown>,
  personIds: string[],
): CalendarEvent {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    title: String(row.title ?? ''),
    notes: String(row.notes ?? ''),
    location: String(row.location ?? ''),
    allDay: Boolean(row.all_day),
    startsOn: String(row.starts_on ?? ''),
    endsOn: String(row.ends_on ?? ''),
    startTime: timeFromDb(row.start_time),
    endTime: timeFromDb(row.end_time),
    color: (typeof row.color === 'string' ? row.color : 'teal') as CalendarColor,
    remindMinutes:
      row.remind_minutes == null
        ? null
        : typeof row.remind_minutes === 'number'
          ? row.remind_minutes
          : Number(row.remind_minutes),
    recurrence: normalizeCalendarRecurrence(row.recurrence as CalendarRecurrence | string | null),
    untilOn: typeof row.until_on === 'string' ? row.until_on : null,
    personIds,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toSummary(event: CalendarEvent): CalendarEventSummary {
  return {
    id: event.id,
    title: event.title,
    notes: event.notes,
    location: event.location,
    allDay: event.allDay,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    remindMinutes: event.remindMinutes,
    recurrence: event.recurrence,
    untilOn: event.untilOn,
    personIds: event.personIds,
    createdBy: event.createdBy,
  };
}

async function loadPeopleMap(
  client: SupabaseClient,
  householdId: string,
  eventIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (eventIds.length === 0) return map;
  const { data, error } = await client
    .from('household_event_people')
    .select('event_id, person_id')
    .eq('household_id', householdId)
    .in('event_id', eventIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const eventId = String((row as { event_id: string }).event_id);
    const personId = String((row as { person_id: string }).person_id);
    const list = map.get(eventId) ?? [];
    list.push(personId);
    map.set(eventId, list);
  }
  return map;
}

export async function loadHouseholdEventMasters(
  client: SupabaseClient,
  householdId: string,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const { data, error } = await client
    .from('household_events')
    .select('*')
    .eq('household_id', householdId)
    .lte('starts_on', to)
    .order('starts_on', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => {
    const endsOn = String(row.ends_on ?? '');
    const recurrence = normalizeCalendarRecurrence(row.recurrence as string | null);
    return endsOn >= from || recurrence !== 'none';
  });

  const peopleMap = await loadPeopleMap(
    client,
    householdId,
    rows.map((row) => String(row.id)),
  );

  return rows
    .map((row) => mapMaster(row, peopleMap.get(String(row.id)) ?? []))
    .filter((event) => event.recurrence === 'none' || !event.untilOn || event.untilOn >= from);
}

export async function getCalendar(
  client: SupabaseClient,
  userId: string,
  input: { date?: string; from?: string; to?: string },
): Promise<{ householdId: string; from: string; to: string; events: CalendarEventSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const today = new Date().toISOString().slice(0, 10);
  let from = input.from?.trim() || input.date?.trim() || today;
  let to = input.to?.trim() || input.date?.trim() || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('from/date must be YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('to must be YYYY-MM-DD');
  if (to < from) {
    const swap = from;
    from = to;
    to = swap;
  }

  const masters = await loadHouseholdEventMasters(client, householdId, from, to);
  const events = expandEventsInRange(masters, from, to).map(toSummary);
  return { householdId, from, to, events };
}

export async function loadCalendarEventOrThrow(
  client: SupabaseClient,
  householdId: string,
  eventId: string,
): Promise<CalendarEvent> {
  const { data, error } = await client
    .from('household_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(CALENDAR_EVENT_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(CALENDAR_EVENT_NOT_FOUND);
  const peopleMap = await loadPeopleMap(client, householdId, [eventId]);
  return mapMaster(rec, peopleMap.get(eventId) ?? []);
}
