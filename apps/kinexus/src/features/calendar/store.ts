import {
  expandEventsInRange,
  normalizeCalendarRecurrence,
  normalizeEventDraft,
  type CalendarEvent,
  type CalendarEventDraft,
} from '@kinexus/domain';

import {
  deleteHouseholdEventFromGoogle,
  pushHouseholdEventToGoogle,
} from '@/src/features/calendar/google-sync';
import { supabase } from '@/src/lib/supabase';

type EventRow = {
  id: string;
  household_id: string;
  title: string;
  notes: string;
  location: string;
  all_day: boolean;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  color: string;
  remind_minutes: number | null;
  recurrence?: string | null;
  until_on?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  household_event_people?: { person_id: string }[] | null;
};

function timeFromDb(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    notes: row.notes ?? '',
    location: row.location ?? '',
    allDay: row.all_day,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startTime: timeFromDb(row.start_time),
    endTime: timeFromDb(row.end_time),
    color: (row.color as CalendarEvent['color']) || 'teal',
    remindMinutes: row.remind_minutes,
    recurrence: normalizeCalendarRecurrence(row.recurrence),
    untilOn: row.until_on ?? null,
    personIds: (row.household_event_people ?? []).map((item) => item.person_id),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Raw series rows that could produce occurrences in [from, to]. */
export async function loadHouseholdEventMasters(
  householdId: string,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('household_events')
    .select('*, household_event_people(person_id)')
    .eq('household_id', householdId)
    .lte('starts_on', to)
    .or(`ends_on.gte.${from},recurrence.neq.none`)
    .order('starts_on', { ascending: true });
  if (error) throw error;
  return ((data as EventRow[] | null) ?? [])
    .map(mapEvent)
    .filter((event) => event.recurrence === 'none' || !event.untilOn || event.untilOn >= from);
}

export async function loadHouseholdEvents(
  householdId: string,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const masters = await loadHouseholdEventMasters(householdId, from, to);
  return expandEventsInRange(masters, from, to);
}

export async function loadDayEvents(householdId: string, day: string): Promise<CalendarEvent[]> {
  return loadHouseholdEvents(householdId, day, day);
}

async function replaceEventPeople(eventId: string, householdId: string, personIds: string[]) {
  if (!supabase) return;
  const { error: delError } = await supabase.from('household_event_people').delete().eq('event_id', eventId);
  if (delError) throw delError;
  if (personIds.length === 0) return;
  const { error } = await supabase.from('household_event_people').insert(
    personIds.map((personId) => ({
      event_id: eventId,
      person_id: personId,
      household_id: householdId,
    })),
  );
  if (error) throw error;
}

export async function createHouseholdEvent(
  householdId: string,
  draft: CalendarEventDraft,
  createdBy: string | null,
): Promise<CalendarEvent> {
  if (!supabase) throw new Error('Calendar needs an online connection.');
  const normalized = normalizeEventDraft(draft);
  const { data, error } = await supabase
    .from('household_events')
    .insert({
      household_id: householdId,
      title: normalized.title,
      notes: normalized.notes,
      location: normalized.location,
      all_day: normalized.allDay,
      starts_on: normalized.startsOn,
      ends_on: normalized.endsOn,
      start_time: normalized.startTime,
      end_time: normalized.endTime,
      color: normalized.color,
      remind_minutes: normalized.remindMinutes,
      recurrence: normalized.recurrence,
      until_on: normalized.untilOn,
      created_by: createdBy,
    })
    .select('*, household_event_people(person_id)')
    .single();
  if (error) throw error;
  const event = mapEvent(data as EventRow);
  await replaceEventPeople(event.id, householdId, normalized.personIds);
  const saved = { ...event, personIds: normalized.personIds };
  void pushHouseholdEventToGoogle(householdId, saved.id);
  return saved;
}

export async function updateHouseholdEvent(
  eventId: string,
  householdId: string,
  draft: CalendarEventDraft,
): Promise<CalendarEvent> {
  if (!supabase) throw new Error('Calendar needs an online connection.');
  const normalized = normalizeEventDraft(draft);
  const { data, error } = await supabase
    .from('household_events')
    .update({
      title: normalized.title,
      notes: normalized.notes,
      location: normalized.location,
      all_day: normalized.allDay,
      starts_on: normalized.startsOn,
      ends_on: normalized.endsOn,
      start_time: normalized.startTime,
      end_time: normalized.endTime,
      color: normalized.color,
      remind_minutes: normalized.remindMinutes,
      recurrence: normalized.recurrence,
      until_on: normalized.untilOn,
    })
    .eq('id', eventId)
    .eq('household_id', householdId)
    .select('*, household_event_people(person_id)')
    .single();
  if (error) throw error;
  await replaceEventPeople(eventId, householdId, normalized.personIds);
  const saved = { ...mapEvent(data as EventRow), personIds: normalized.personIds };
  void pushHouseholdEventToGoogle(householdId, saved.id);
  return saved;
}

export async function deleteHouseholdEvent(eventId: string, householdId: string): Promise<void> {
  if (!supabase) throw new Error('Calendar needs an online connection.');
  await deleteHouseholdEventFromGoogle(householdId, eventId);
  const { error } = await supabase
    .from('household_events')
    .delete()
    .eq('id', eventId)
    .eq('household_id', householdId);
  if (error) throw error;
}
