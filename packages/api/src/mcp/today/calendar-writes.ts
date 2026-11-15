import type { SupabaseClient } from '@supabase/supabase-js';
import {
  draftFromEvent,
  normalizeEventDraft,
  validateEventDraft,
  type CalendarColor,
  type CalendarEventDraft,
  type CalendarRecurrence,
} from '@kinexus/domain';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { CALENDAR_EVENT_NOT_FOUND, loadCalendarEventOrThrow } from './calendar-reads.js';
import { resolveCallerHousehold } from './shared.js';

export type CalendarWriteAction =
  | {
      action: 'create_calendar_event';
      draft: CalendarEventDraft;
    }
  | {
      action: 'update_calendar_event';
      eventId: string;
      draft: CalendarEventDraft;
    }
  | {
      action: 'delete_calendar_event';
      eventId: string;
      title: string;
      startsOn: string;
    };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: CalendarWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

function draftIssueMessage(issue: string): string {
  switch (issue) {
    case 'title':
      return 'Give the event a title';
    case 'startsOn':
    case 'endsOn':
      return 'Dates must be YYYY-MM-DD';
    case 'range':
      return 'End date must be on or after start date';
    case 'untilOn':
      return 'Recurrence end must be a valid date on or after start';
    case 'startTime':
    case 'endTime':
    case 'times':
      return 'Timed events need valid start/end times';
    default:
      return 'Invalid event draft';
  }
}

function partialDraft(
  base: CalendarEventDraft,
  patch: {
    title?: string;
    notes?: string;
    location?: string;
    allDay?: boolean;
    startsOn?: string;
    endsOn?: string;
    startTime?: string | null;
    endTime?: string | null;
    color?: string;
    remindMinutes?: number | null;
    recurrence?: string;
    untilOn?: string | null;
    personIds?: string[];
  },
): CalendarEventDraft {
  return {
    title: patch.title ?? base.title,
    notes: patch.notes ?? base.notes,
    location: patch.location ?? base.location,
    allDay: patch.allDay ?? base.allDay,
    startsOn: patch.startsOn ?? base.startsOn,
    endsOn: patch.endsOn ?? base.endsOn,
    startTime: patch.startTime !== undefined ? patch.startTime : base.startTime,
    endTime: patch.endTime !== undefined ? patch.endTime : base.endTime,
    color: (patch.color as CalendarColor | undefined) ?? base.color,
    remindMinutes: patch.remindMinutes !== undefined ? patch.remindMinutes : base.remindMinutes,
    recurrence: (patch.recurrence as CalendarRecurrence | undefined) ?? base.recurrence,
    untilOn: patch.untilOn !== undefined ? patch.untilOn : base.untilOn,
    personIds: patch.personIds ?? base.personIds,
  };
}

export async function previewCreateCalendarEvent(
  caller: McpCaller,
  input: {
    title: string;
    notes?: string;
    location?: string;
    allDay?: boolean;
    startsOn: string;
    endsOn?: string;
    startTime?: string | null;
    endTime?: string | null;
    color?: string;
    remindMinutes?: number | null;
    recurrence?: string;
    untilOn?: string | null;
    personIds?: string[];
  },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const draft = normalizeEventDraft({
    title: input.title,
    notes: input.notes ?? '',
    location: input.location ?? '',
    allDay: input.allDay ?? true,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? input.startsOn,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    color: (input.color as CalendarColor | undefined) ?? 'teal',
    remindMinutes: input.remindMinutes ?? null,
    recurrence: (input.recurrence as CalendarRecurrence | undefined) ?? 'none',
    untilOn: input.untilOn ?? null,
    personIds: input.personIds ?? [],
  });
  const issue = validateEventDraft(draft);
  if (issue) {
    return { kind: 'blocked', summary: 'Could not create event', message: draftIssueMessage(issue) };
  }
  if (!draft.title) {
    return { kind: 'blocked', summary: 'Could not create event', message: draftIssueMessage('title') };
  }

  return savePreview(
    caller,
    householdId,
    'preview_create_calendar_event',
    { action: 'create_calendar_event', draft },
    `Create "${draft.title}" on ${draft.startsOn}`,
    ['Insert household_events row', 'Replace event people', 'Notify household'],
  );
}

export async function previewUpdateCalendarEvent(
  caller: McpCaller,
  input: {
    eventId: string;
    title?: string;
    notes?: string;
    location?: string;
    allDay?: boolean;
    startsOn?: string;
    endsOn?: string;
    startTime?: string | null;
    endTime?: string | null;
    color?: string;
    remindMinutes?: number | null;
    recurrence?: string;
    untilOn?: string | null;
    personIds?: string[];
  },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const existing = await loadCalendarEventOrThrow(caller.client, householdId, input.eventId);
  const draft = normalizeEventDraft(partialDraft(draftFromEvent(existing), input));
  const issue = validateEventDraft(draft);
  if (issue) {
    return { kind: 'blocked', summary: 'Could not update event', message: draftIssueMessage(issue) };
  }

  return savePreview(
    caller,
    householdId,
    'preview_update_calendar_event',
    { action: 'update_calendar_event', eventId: existing.id, draft },
    `Update "${draft.title}" (${existing.id})`,
    [`Patch household event ${existing.id}`, 'Replace event people'],
  );
}

export async function previewDeleteCalendarEvent(
  caller: McpCaller,
  input: { eventId: string },
): Promise<PreviewResult> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const existing = await loadCalendarEventOrThrow(caller.client, householdId, input.eventId);

  return savePreview(
    caller,
    householdId,
    'preview_delete_calendar_event',
    {
      action: 'delete_calendar_event',
      eventId: existing.id,
      title: existing.title,
      startsOn: existing.startsOn,
    },
    `Delete "${existing.title}" on ${existing.startsOn}`,
    [`Hard-delete household event ${existing.id}`],
  );
}

async function replaceEventPeople(
  client: SupabaseClient,
  eventId: string,
  householdId: string,
  personIds: string[],
): Promise<void> {
  const { error: delError } = await client.from('household_event_people').delete().eq('event_id', eventId);
  if (delError) throw new Error(delError.message);
  if (personIds.length === 0) return;
  const { error } = await client.from('household_event_people').insert(
    personIds.map((personId) => ({
      event_id: eventId,
      person_id: personId,
      household_id: householdId,
    })),
  );
  if (error) throw new Error(error.message);
}

async function peekPreviewTool(
  client: SupabaseClient,
  userId: string,
  previewId: string,
): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function executeWrite(
  caller: McpCaller,
  householdId: string,
  payload: CalendarWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const client = caller.client;

  switch (payload.action) {
    case 'create_calendar_event': {
      const draft = normalizeEventDraft(payload.draft);
      const { data, error } = await client
        .from('household_events')
        .insert({
          household_id: householdId,
          title: draft.title,
          notes: draft.notes,
          location: draft.location,
          all_day: draft.allDay,
          starts_on: draft.startsOn,
          ends_on: draft.endsOn,
          start_time: draft.startTime,
          end_time: draft.endTime,
          color: draft.color,
          remind_minutes: draft.remindMinutes,
          recurrence: draft.recurrence,
          until_on: draft.untilOn,
          created_by: caller.userId,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      const eventId = String((data as { id: string }).id);
      await replaceEventPeople(client, eventId, householdId, draft.personIds);
      try {
        await client.rpc('notify_household_alert', {
          p_household_id: householdId,
          p_segment: 'calendar',
          p_title: draft.title,
          p_body: draft.startsOn,
          p_href: '/calendar',
          p_payload: { eventId },
        });
      } catch {
        // Non-blocking.
      }
      return {
        affectedIds: [eventId],
        result: {
          eventId,
          title: draft.title,
          startsOn: draft.startsOn,
          endsOn: draft.endsOn,
          personIds: draft.personIds,
        },
      };
    }
    case 'update_calendar_event': {
      const draft = normalizeEventDraft(payload.draft);
      const { data, error } = await client
        .from('household_events')
        .update({
          title: draft.title,
          notes: draft.notes,
          location: draft.location,
          all_day: draft.allDay,
          starts_on: draft.startsOn,
          ends_on: draft.endsOn,
          start_time: draft.startTime,
          end_time: draft.endTime,
          color: draft.color,
          remind_minutes: draft.remindMinutes,
          recurrence: draft.recurrence,
          until_on: draft.untilOn,
        })
        .eq('id', payload.eventId)
        .eq('household_id', householdId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(CALENDAR_EVENT_NOT_FOUND);
      await replaceEventPeople(client, payload.eventId, householdId, draft.personIds);
      return {
        affectedIds: [payload.eventId],
        result: {
          eventId: payload.eventId,
          title: draft.title,
          startsOn: draft.startsOn,
          endsOn: draft.endsOn,
          personIds: draft.personIds,
        },
      };
    }
    case 'delete_calendar_event': {
      const { data, error } = await client
        .from('household_events')
        .delete()
        .eq('id', payload.eventId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(CALENDAR_EVENT_NOT_FOUND);
      return { affectedIds: [payload.eventId], result: { deleted: payload.eventId } };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown calendar action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitCalendarPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');

  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);

  const payload = committed.preview.payload as CalendarWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const CALENDAR_PREVIEW_TOOLS = [
  'preview_create_calendar_event',
  'preview_update_calendar_event',
  'preview_delete_calendar_event',
] as const;
