import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import { getUnreadAlerts, listAlerts } from './alerts-reads.js';
import { previewMarkAlertRead, previewMarkAllAlertsRead } from './alerts-writes.js';
import { getCalendar } from './calendar-reads.js';
import {
  previewCreateCalendarEvent,
  previewDeleteCalendarEvent,
  previewUpdateCalendarEvent,
} from './calendar-writes.js';
import { getTodayOverview } from './overview.js';
import { getTalkItems, listTalkItems } from './talk-reads.js';
import {
  previewAddTalkItem,
  previewRemoveTalkItem,
  previewSetTalkItemDone,
  type PreviewResult,
} from './talk-writes.js';
import { resolveCallerHousehold, withTodayAudit } from './shared.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
  message: z.string().optional(),
  itemId: z.string().optional(),
});

const talkItemOut = z.object({
  id: z.string(),
  body: z.string(),
  done: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
});

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

function asPreviewResult(value: PreviewResult): z.infer<typeof previewResultSchema> {
  return value;
}

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withTodayAudit(caller, { tool, mode: 'write', householdId }, async () =>
    asPreviewResult(await run()),
  );
}

const listTalkItemsInput = z.object({});
const listTalkItemsOutput = z.object({
  householdId: z.string(),
  open: z.array(talkItemOut),
  recentDone: z.array(talkItemOut),
});

export const listTalkItemsTool: McpToolDefinition<typeof listTalkItemsInput, typeof listTalkItemsOutput> = {
  name: 'list_talk_items',
  title: 'List talk items',
  description: 'List open household talk items plus recent done ones. Shared with the household (RLS).',
  inputSchema: listTalkItemsInput,
  outputSchema: listTalkItemsOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withTodayAudit(caller, { tool: 'list_talk_items', mode: 'read' }, () =>
      listTalkItems(caller.client, caller.userId),
    ),
};

export const getTalkItemsTool: McpToolDefinition<typeof listTalkItemsInput, typeof listTalkItemsOutput> = {
  name: 'get_talk_items',
  title: 'Get talk items',
  description: 'Alias of list_talk_items — open + recent done talk items for the household.',
  inputSchema: listTalkItemsInput,
  outputSchema: listTalkItemsOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withTodayAudit(caller, { tool: 'get_talk_items', mode: 'read' }, () =>
      getTalkItems(caller.client, caller.userId),
    ),
};

const addTalkItemInput = z.object({ body: z.string() });

export const previewAddTalkItemTool: McpToolDefinition<typeof addTalkItemInput, typeof previewResultSchema> = {
  name: 'preview_add_talk_item',
  title: 'Preview add talk item',
  description: 'Preview adding a household Talk item (max 120 chars). Commit notifies the household.',
  inputSchema: addTalkItemInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_talk_item', () => previewAddTalkItem(caller, args)),
};

const setTalkItemDoneInput = z.object({
  itemId: z.string(),
  done: z.boolean(),
});

export const previewSetTalkItemDoneTool: McpToolDefinition<
  typeof setTalkItemDoneInput,
  typeof previewResultSchema
> = {
  name: 'preview_set_talk_item_done',
  title: 'Preview set talk item done',
  description: 'Preview marking a talk item done or reopening it.',
  inputSchema: setTalkItemDoneInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_set_talk_item_done', () => previewSetTalkItemDone(caller, args)),
};

const removeTalkItemInput = z.object({ itemId: z.string() });

export const previewRemoveTalkItemTool: McpToolDefinition<
  typeof removeTalkItemInput,
  typeof previewResultSchema
> = {
  name: 'preview_remove_talk_item',
  title: 'Preview remove talk item',
  description: 'Preview deleting a household talk item.',
  inputSchema: removeTalkItemInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_talk_item', () => previewRemoveTalkItem(caller, args)),
};

const calendarEventOut = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  location: z.string(),
  allDay: z.boolean(),
  startsOn: z.string(),
  endsOn: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  color: z.string(),
  remindMinutes: z.number().nullable(),
  recurrence: z.string(),
  untilOn: z.string().nullable(),
  personIds: z.array(z.string()),
  createdBy: z.string().nullable(),
});

const getCalendarInput = z.object({
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
const getCalendarOutput = z.object({
  householdId: z.string(),
  from: z.string(),
  to: z.string(),
  events: z.array(calendarEventOut),
});

export const getCalendarTool: McpToolDefinition<typeof getCalendarInput, typeof getCalendarOutput> = {
  name: 'get_calendar',
  title: 'Get calendar',
  description:
    'Household calendar events for a day or date range (YYYY-MM-DD). Expands recurrence. Does not include personal Google overlay or OAuth tokens.',
  inputSchema: getCalendarInput,
  outputSchema: getCalendarOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withTodayAudit(caller, { tool: 'get_calendar', mode: 'read' }, () =>
      getCalendar(caller.client, caller.userId, args),
    ),
};

const createCalendarEventInput = z.object({
  title: z.string(),
  notes: z.string().optional(),
  location: z.string().optional(),
  allDay: z.boolean().optional(),
  startsOn: z.string(),
  endsOn: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  color: z.string().optional(),
  remindMinutes: z.number().nullable().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
  untilOn: z.string().nullable().optional(),
  personIds: z.array(z.string()).optional(),
});

export const previewCreateCalendarEventTool: McpToolDefinition<
  typeof createCalendarEventInput,
  typeof previewResultSchema
> = {
  name: 'preview_create_calendar_event',
  title: 'Preview create calendar event',
  description: 'Preview creating a household calendar event. Commit notifies the household. No Google tokens.',
  inputSchema: createCalendarEventInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_create_calendar_event', () => previewCreateCalendarEvent(caller, args)),
};

const updateCalendarEventInput = createCalendarEventInput
  .partial()
  .extend({ eventId: z.string(), title: z.string().optional() });

export const previewUpdateCalendarEventTool: McpToolDefinition<
  typeof updateCalendarEventInput,
  typeof previewResultSchema
> = {
  name: 'preview_update_calendar_event',
  title: 'Preview update calendar event',
  description: 'Preview updating a household calendar event by id.',
  inputSchema: updateCalendarEventInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_calendar_event', () => previewUpdateCalendarEvent(caller, args)),
};

const deleteCalendarEventInput = z.object({ eventId: z.string() });

export const previewDeleteCalendarEventTool: McpToolDefinition<
  typeof deleteCalendarEventInput,
  typeof previewResultSchema
> = {
  name: 'preview_delete_calendar_event',
  title: 'Preview delete calendar event',
  description: 'Preview hard-deleting a household calendar event (cascades people mappings).',
  inputSchema: deleteCalendarEventInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_delete_calendar_event', () => previewDeleteCalendarEvent(caller, args)),
};

const getTodayInput = z.object({ date: z.string().optional() });
const getTodayOutput = z.object({
  date: z.string(),
  householdId: z.string(),
  tasks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      done: z.boolean(),
      scope: z.enum(['personal', 'household']),
      assignedTo: z.string().nullable(),
    }),
  ),
  talk: z.array(z.object({ id: z.string(), body: z.string(), createdBy: z.string() })),
  calendar: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      allDay: z.boolean(),
      startTime: z.string().nullable(),
      endTime: z.string().nullable(),
      location: z.string(),
    }),
  ),
  meals: z.object({
    available: z.boolean(),
    courses: z.array(z.object({ slotKey: z.string(), recipeName: z.string() })),
  }),
  shopping: z.object({
    available: z.boolean(),
    weekStart: z.string().nullable(),
    uncheckedCount: z.number(),
    topItems: z.array(z.object({ name: z.string(), amount: z.string().nullable() })),
  }),
  alerts: z.object({
    unreadCount: z.number(),
    latest: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        segment: z.string(),
        createdAt: z.string(),
      }),
    ),
  }),
  train: z.object({
    available: z.boolean(),
    planName: z.string().nullable(),
    day: z
      .object({
        restDay: z.boolean(),
        status: z.string(),
        workoutName: z.string().nullable(),
        focus: z.array(z.string()),
      })
      .nullable(),
  }),
  excluded: z.array(z.string()),
});

export const getTodayTool: McpToolDefinition<typeof getTodayInput, typeof getTodayOutput> = {
  name: 'get_today',
  title: 'Get today overview',
  description:
    'Concise brief for a date (default today): personal + household tasks, talk, calendar, meals/shopping if scoped, unread alerts, optional train. Never includes journal/PIN, puzzles, or others’ private lists.',
  inputSchema: getTodayInput,
  outputSchema: getTodayOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withTodayAudit(caller, { tool: 'get_today', mode: 'read' }, () => getTodayOverview(caller, args)),
};

export const getOverviewTool: McpToolDefinition<typeof getTodayInput, typeof getTodayOutput> = {
  name: 'get_overview',
  title: 'Get overview',
  description: 'Alias of get_today — household + personal brief for a date.',
  inputSchema: getTodayInput,
  outputSchema: getTodayOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withTodayAudit(caller, { tool: 'get_overview', mode: 'read' }, () => getTodayOverview(caller, args)),
};

const alertOut = z.object({
  id: z.string(),
  segment: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  href: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

const listAlertsInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
  unreadOnly: z.boolean().optional(),
});
const listAlertsOutput = z.object({
  householdId: z.string(),
  alerts: z.array(alertOut),
});

export const listAlertsTool: McpToolDefinition<typeof listAlertsInput, typeof listAlertsOutput> = {
  name: 'list_alerts',
  title: 'List alerts',
  description: 'List the signed-in user’s alerts (own inbox only).',
  inputSchema: listAlertsInput,
  outputSchema: listAlertsOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withTodayAudit(caller, { tool: 'list_alerts', mode: 'read' }, () =>
      listAlerts(caller.client, caller.userId, args),
    ),
};

const getUnreadAlertsInput = z.object({
  limit: z.number().int().positive().max(100).optional(),
});
const getUnreadAlertsOutput = z.object({
  householdId: z.string(),
  unreadCount: z.number(),
  alerts: z.array(alertOut),
});

export const getUnreadAlertsTool: McpToolDefinition<typeof getUnreadAlertsInput, typeof getUnreadAlertsOutput> = {
  name: 'get_unread_alerts',
  title: 'Get unread alerts',
  description: 'Unread alerts for the signed-in user only.',
  inputSchema: getUnreadAlertsInput,
  outputSchema: getUnreadAlertsOutput,
  scope: 'today:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withTodayAudit(caller, { tool: 'get_unread_alerts', mode: 'read' }, () =>
      getUnreadAlerts(caller.client, caller.userId, args),
    ),
};

const markAlertReadInput = z.object({ alertId: z.string() });

export const previewMarkAlertReadTool: McpToolDefinition<typeof markAlertReadInput, typeof previewResultSchema> = {
  name: 'preview_mark_alert_read',
  title: 'Preview mark alert read',
  description: 'Preview marking one of your alerts as read. Cannot mark others’ alerts.',
  inputSchema: markAlertReadInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_mark_alert_read', () => previewMarkAlertRead(caller, args)),
};

const markAllAlertsReadInput = z.object({});

export const previewMarkAllAlertsReadTool: McpToolDefinition<
  typeof markAllAlertsReadInput,
  typeof previewResultSchema
> = {
  name: 'preview_mark_all_alerts_read',
  title: 'Preview mark all alerts read',
  description: 'Preview marking all of your unread alerts as read (your inbox only).',
  inputSchema: markAllAlertsReadInput,
  outputSchema: previewResultSchema,
  scope: 'today:write',
  annotations: writeAnnotations,
  handler: async (_args, caller) =>
    auditedPreview(caller, 'preview_mark_all_alerts_read', () => previewMarkAllAlertsRead(caller)),
};

export const TODAY_MCP_TOOLS = [
  listTalkItemsTool,
  getTalkItemsTool,
  previewAddTalkItemTool,
  previewSetTalkItemDoneTool,
  previewRemoveTalkItemTool,
  getCalendarTool,
  previewCreateCalendarEventTool,
  previewUpdateCalendarEventTool,
  previewDeleteCalendarEventTool,
  getTodayTool,
  getOverviewTool,
  listAlertsTool,
  getUnreadAlertsTool,
  previewMarkAlertReadTool,
  previewMarkAllAlertsReadTool,
] as const;
