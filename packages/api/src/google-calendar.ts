import { createHmac, timingSafeEqual } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
].join(' ');
const FAMILY_CAL_NAME = 'Kinexus Family';
const STATE_TTL_MS = 15 * 60 * 1000;

type HandlerResult = { status: number; body: Record<string, unknown> };
type RedirectResult = { status: number; location: string };

type ConnectionRow = {
  id: string;
  user_id: string;
  google_sub: string | null;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_expires_at: string | null;
  push_enabled: boolean;
  push_calendar_id: string | null;
  push_calendar_name: string | null;
  pull_calendar_ids: string[];
  connected_at: string;
  updated_at: string;
};

export type GoogleAccountPublic = {
  id: string;
  email: string | null;
  pushEnabled: boolean;
  pushCalendarId: string | null;
  pushCalendarName: string | null;
  pullCalendarIds: string[];
  connectedAt: string;
  calendars?: { id: string; name: string; primary: boolean; writable: boolean }[];
  calendarsError?: string | null;
};

function accountPublic(
  row: ConnectionRow,
  extra?: {
    calendars?: GoogleAccountPublic['calendars'];
    calendarsError?: string | null;
  },
): GoogleAccountPublic {
  return {
    id: row.id,
    email: row.google_email,
    pushEnabled: row.push_enabled,
    pushCalendarId: row.push_calendar_id,
    pushCalendarName: row.push_calendar_name,
    pullCalendarIds: row.pull_calendar_ids ?? [],
    connectedAt: row.connected_at,
    calendars: extra?.calendars ?? [],
    calendarsError: extra?.calendarsError ?? null,
  };
}

type GoogleCalendarListEntry = {
  id?: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
};

type HouseholdEventRow = {
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
  recurrence: string | null;
  until_on: string | null;
};

export type PersonalGoogleEvent = {
  id: string;
  title: string;
  notes: string;
  location: string;
  allDay: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  color: 'sky';
  remindMinutes: null;
  recurrence: 'none';
  untilOn: null;
  personIds: [];
  createdBy: null;
  createdAt: string;
  updatedAt: string;
  householdId: '';
  source: 'google';
  calendarName?: string;
};

function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID!.trim();
}

function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET!.trim();
}

function stateSecret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    'kinexus-google-calendar'
  );
}

function apiPublicOrigin(request: Request): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN?.trim()?.replace(/\/$/, '');
  if (explicit) return explicit;
  const url = new URL(request.url);
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
  }
  return `${url.protocol}//${url.host}`;
}

function oauthRedirectUri(request: Request): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override;
  return `${apiPublicOrigin(request)}/calendar/google/callback`;
}

function appReturnUrl(query: Record<string, string> = {}): string {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim().replace(/\/$/, '') ||
    'http://localhost:5300';
  const url = new URL(`${base}/settings`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, tsRaw, sig] = parts;
  if (!userId || !tsRaw || !sig) return null;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;
  const payload = `${userId}.${tsRaw}`;
  const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}

function timeFromDb(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

function recurrenceRule(recurrence: string | null | undefined, untilOn: string | null | undefined): string[] | undefined {
  if (!recurrence || recurrence === 'none') return undefined;
  const freq =
    recurrence === 'daily'
      ? 'DAILY'
      : recurrence === 'weekly'
        ? 'WEEKLY'
        : recurrence === 'monthly'
          ? 'MONTHLY'
          : recurrence === 'yearly'
            ? 'YEARLY'
            : null;
  if (!freq) return undefined;
  let rule = `RRULE:FREQ=${freq}`;
  if (untilOn && /^\d{4}-\d{2}-\d{2}$/.test(untilOn)) {
    rule += `;UNTIL=${untilOn.replace(/-/g, '')}`;
  }
  return [rule];
}

function toGoogleEventBody(event: HouseholdEventRow): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.notes || undefined,
    location: event.location || undefined,
    extendedProperties: {
      private: { kinexusEventId: event.id, kinexusHouseholdId: event.household_id },
    },
  };
  const rrule = recurrenceRule(event.recurrence, event.until_on);
  if (rrule) body.recurrence = rrule;

  if (event.all_day) {
    const endExclusive = addDaysIso(event.ends_on, 1);
    body.start = { date: event.starts_on };
    body.end = { date: endExclusive };
  } else {
    const startTime = timeFromDb(event.start_time) ?? '09:00';
    const endTime = timeFromDb(event.end_time) ?? '10:00';
    body.start = { dateTime: `${event.starts_on}T${startTime}:00`, timeZone: guessTimeZone() };
    body.end = { dateTime: `${event.ends_on}T${endTime}:00`, timeZone: guessTimeZone() };
  }
  return body;
}

function guessTimeZone(): string {
  return process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function addDaysIso(day: string, days: number): string {
  const parts = day.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

async function googleTokenRequest(params: Record<string, string>): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
}

async function loadConnections(admin: SupabaseClient, userId: string): Promise<ConnectionRow[]> {
  const { data, error } = await admin
    .from('user_google_calendar')
    .select('*')
    .eq('user_id', userId)
    .order('connected_at', { ascending: true });
  if (error) throw error;
  return (data as ConnectionRow[] | null) ?? [];
}

async function loadConnection(
  admin: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await admin
    .from('user_google_calendar')
    .select('*')
    .eq('user_id', userId)
    .eq('id', connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRow | null) ?? null;
}

function connectionIdFromBody(body: { connectionId?: unknown }): string {
  return typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
}

async function accessTokenFor(admin: SupabaseClient, row: ConnectionRow): Promise<string> {
  const expiresAt = row.access_expires_at ? Date.parse(row.access_expires_at) : 0;
  if (row.access_token && expiresAt > Date.now() + 60_000) {
    return row.access_token;
  }
  const token = await googleTokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  });
  if (!token.access_token) {
    throw new Error(token.error_description || token.error || 'Could not refresh Google access token');
  }
  const accessExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
  const { error } = await admin
    .from('user_google_calendar')
    .update({
      access_token: token.access_token,
      access_expires_at: accessExpiresAt,
      refresh_token: token.refresh_token ?? row.refresh_token,
    })
    .eq('id', row.id);
  if (error) throw error;
  row.access_token = token.access_token;
  row.access_expires_at = accessExpiresAt;
  if (token.refresh_token) row.refresh_token = token.refresh_token;
  return token.access_token;
}

async function googleFetch(
  admin: SupabaseClient,
  row: ConnectionRow,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await accessTokenFor(admin, row);
  const res = await fetch(`${GOOGLE_CAL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

async function listGoogleCalendars(
  admin: SupabaseClient,
  row: ConnectionRow,
): Promise<{ id: string; name: string; primary: boolean; writable: boolean }[]> {
  const res = await googleFetch(admin, row, '/users/me/calendarList?minAccessRole=reader&maxResults=250');
  const payload = (await res.json().catch(() => ({}))) as {
    items?: GoogleCalendarListEntry[];
    error?: { message?: string; status?: string; errors?: { reason?: string; message?: string }[] };
  };
  if (!res.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    const detail = payload.error?.message || payload.error?.errors?.[0]?.message;
    if (reason === 'accessNotConfigured' || /has not been used|disabled/i.test(detail ?? '')) {
      throw new Error(
        'Google Calendar API is not enabled for this Google Cloud project. Enable it in Google Cloud Console → APIs & Services → Library → Google Calendar API.',
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        detail ||
          'Google denied calendar access. Remove the account and connect again, then approve calendar permission.',
      );
    }
    throw new Error(detail || `Google calendar list failed (${res.status})`);
  }
  return (payload.items ?? [])
    .filter((item): item is GoogleCalendarListEntry & { id: string } => Boolean(item.id))
    .map((item) => ({
      id: item.id,
      name: item.summary?.trim() || item.id,
      primary: Boolean(item.primary),
      writable: item.accessRole === 'owner' || item.accessRole === 'writer',
    }));
}

async function ensureFamilyCalendar(admin: SupabaseClient, row: ConnectionRow): Promise<{ id: string; name: string }> {
  if (row.push_calendar_id) {
    return { id: row.push_calendar_id, name: row.push_calendar_name || FAMILY_CAL_NAME };
  }
  const calendars = await listGoogleCalendars(admin, row);
  const existing = calendars.find((cal) => cal.name === FAMILY_CAL_NAME && cal.writable);
  if (existing) {
    await admin
      .from('user_google_calendar')
      .update({ push_calendar_id: existing.id, push_calendar_name: existing.name })
      .eq('id', row.id);
    row.push_calendar_id = existing.id;
    row.push_calendar_name = existing.name;
    return existing;
  }
  const res = await googleFetch(admin, row, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: FAMILY_CAL_NAME }),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; summary?: string; error?: { message?: string } };
  if (!res.ok || !payload.id) {
    throw new Error(payload.error?.message || 'Could not create Kinexus Family calendar');
  }
  const name = payload.summary?.trim() || FAMILY_CAL_NAME;
  await admin
    .from('user_google_calendar')
    .update({ push_calendar_id: payload.id, push_calendar_name: name })
    .eq('id', row.id);
  row.push_calendar_id = payload.id;
  row.push_calendar_name = name;
  return { id: payload.id, name };
}

async function loadHouseholdEvent(admin: SupabaseClient, eventId: string): Promise<HouseholdEventRow | null> {
  const { data, error } = await admin
    .from('household_events')
    .select(
      'id, household_id, title, notes, location, all_day, starts_on, ends_on, start_time, end_time, recurrence, until_on',
    )
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as HouseholdEventRow | null) ?? null;
}

async function assertHouseholdMember(admin: SupabaseClient, userId: string, householdId: string): Promise<void> {
  const { data, error } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('Not a member of this household');
    (err as { status?: number }).status = 403;
    throw err;
  }
}

async function householdMemberUserIds(admin: SupabaseClient, householdId: string): Promise<string[]> {
  const { data, error } = await admin.from('household_members').select('user_id').eq('household_id', householdId);
  if (error) throw error;
  return (data ?? []).map((row) => row.user_id as string);
}

async function pushEventToUser(
  admin: SupabaseClient,
  row: ConnectionRow,
  event: HouseholdEventRow,
): Promise<void> {
  if (!row.push_enabled) return;
  const calendar = await ensureFamilyCalendar(admin, row);
  const { data: existing } = await admin
    .from('household_event_google_maps')
    .select('google_event_id, google_calendar_id')
    .eq('household_event_id', event.id)
    .eq('connection_id', row.id)
    .maybeSingle();

  const body = toGoogleEventBody(event);
  if (existing?.google_event_id) {
    const calId = encodeURIComponent(existing.google_calendar_id || calendar.id);
    const evtId = encodeURIComponent(existing.google_event_id);
    const res = await googleFetch(admin, row, `/calendars/${calId}/events/${evtId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.status === 404) {
      // Fall through to create
    } else if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(payload.error?.message || `Google event update failed (${res.status})`);
    } else {
      await admin
        .from('household_event_google_maps')
        .update({ synced_at: new Date().toISOString(), google_calendar_id: calendar.id })
        .eq('household_event_id', event.id)
        .eq('connection_id', row.id);
      return;
    }
  }

  const calId = encodeURIComponent(calendar.id);
  const res = await googleFetch(admin, row, `/calendars/${calId}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !payload.id) {
    throw new Error(payload.error?.message || `Google event create failed (${res.status})`);
  }
  await admin.from('household_event_google_maps').upsert({
    household_event_id: event.id,
    user_id: row.user_id,
    connection_id: row.id,
    google_calendar_id: calendar.id,
    google_event_id: payload.id,
    synced_at: new Date().toISOString(),
  });
}

async function deleteEventForUser(
  admin: SupabaseClient,
  row: ConnectionRow,
  eventId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from('household_event_google_maps')
    .select('google_event_id, google_calendar_id')
    .eq('household_event_id', eventId)
    .eq('connection_id', row.id)
    .maybeSingle();
  if (!existing?.google_event_id) return;
  const calId = encodeURIComponent(existing.google_calendar_id);
  const evtId = encodeURIComponent(existing.google_event_id);
  const res = await googleFetch(admin, row, `/calendars/${calId}/events/${evtId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `Google event delete failed (${res.status})`);
  }
  await admin
    .from('household_event_google_maps')
    .delete()
    .eq('household_event_id', eventId)
    .eq('connection_id', row.id);
}

function zonedDateTime(value: string, timeZone: string): { date: string; time: string } | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const year = dateParts.find((part) => part.type === 'year')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed);
  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';
  return { date: `${year}-${month}-${day}`, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` };
}

function mapPersonalEvent(
  item: {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  },
  calendarName?: string,
  timeZone: string = guessTimeZone(),
): PersonalGoogleEvent | null {
  if (!item.id) return null;
  const allDay = Boolean(item.start?.date);
  let startsOn: string | null = null;
  let endsOn: string | null = null;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (allDay) {
    startsOn = item.start?.date && /^\d{4}-\d{2}-\d{2}$/.test(item.start.date) ? item.start.date : null;
    if (!startsOn) return null;
    if (item.end?.date && /^\d{4}-\d{2}-\d{2}$/.test(item.end.date)) {
      endsOn = addDaysIso(item.end.date, -1);
      if (endsOn < startsOn) endsOn = startsOn;
    } else {
      endsOn = startsOn;
    }
  } else {
    const start = item.start?.dateTime ? zonedDateTime(item.start.dateTime, timeZone) : null;
    const end = item.end?.dateTime ? zonedDateTime(item.end.dateTime, timeZone) : null;
    if (!start) return null;
    startsOn = start.date;
    startTime = start.time;
    endsOn = end?.date ?? start.date;
    endTime = end?.time ?? start.time;
  }

  const now = new Date().toISOString();
  return {
    id: `google:${item.id}`,
    title: item.summary?.trim() || 'Busy',
    notes: item.description?.trim() || '',
    location: item.location?.trim() || '',
    allDay,
    startsOn,
    endsOn,
    startTime,
    endTime,
    color: 'sky',
    remindMinutes: null,
    recurrence: 'none',
    untilOn: null,
    personIds: [],
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    householdId: '',
    source: 'google',
    calendarName,
  };
}

async function ensureDefaultPullCalendars(admin: SupabaseClient, row: ConnectionRow): Promise<ConnectionRow> {
  if ((row.pull_calendar_ids ?? []).length > 0) return row;
  try {
    const calendars = await listGoogleCalendars(admin, row);
    const primary = calendars.find((cal) => cal.primary) ?? calendars[0];
    if (!primary) return row;
    const pull = [primary.id];
    await admin.from('user_google_calendar').update({ pull_calendar_ids: pull }).eq('id', row.id);
    row.pull_calendar_ids = pull;
  } catch {
    // leave empty
  }
  return row;
}

async function collectPersonalEvents(
  admin: SupabaseClient,
  userId: string,
  from: string,
  to: string,
  timeZone: string,
): Promise<PersonalGoogleEvent[]> {
  const accounts = await loadConnections(admin, userId);
  if (accounts.length === 0) return [];

  const timeMin = `${addDaysIso(from, -1)}T00:00:00Z`;
  const timeMax = `${addDaysIso(to, 2)}T00:00:00Z`;
  const events: PersonalGoogleEvent[] = [];
  let pullBudget = 40;

  for (const raw of accounts) {
    const row = await ensureDefaultPullCalendars(admin, raw);
    const pullIds = (row.pull_calendar_ids ?? []).filter(Boolean);
    if (pullIds.length === 0) continue;
    let calendars: { id: string; name: string }[] = [];
    try {
      calendars = await listGoogleCalendars(admin, row);
    } catch {
      continue;
    }
    const nameById = new Map(calendars.map((cal) => [cal.id, cal.name]));
    for (const calendarId of pullIds) {
      if (pullBudget <= 0) break;
      pullBudget -= 1;
      const calId = encodeURIComponent(calendarId);
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin,
        timeMax,
        maxResults: '250',
      });
      const res = await googleFetch(admin, row, `/calendars/${calId}/events?${params.toString()}`);
      const payload = (await res.json().catch(() => ({}))) as {
        items?: Parameters<typeof mapPersonalEvent>[0][];
      };
      if (!res.ok) continue;
      for (const item of payload.items ?? []) {
        const privateProps = (item as { extendedProperties?: { private?: { kinexusEventId?: string } } })
          .extendedProperties?.private;
        if (privateProps?.kinexusEventId) continue;
        const label = [row.google_email, nameById.get(calendarId)].filter(Boolean).join(' · ');
        const mapped = mapPersonalEvent(item, label || nameById.get(calendarId), timeZone);
        if (!mapped) continue;
        if (mapped.endsOn < from || mapped.startsOn > to) continue;
        events.push(mapped);
      }
    }
  }

  events.sort((a, b) => {
    if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? -1 : 1;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title);
  });
  return events;
}

export async function handleGoogleConnectStart(
  request: Request,
  userId: string,
): Promise<HandlerResult> {
  if (!googleConfigured()) {
    return {
      status: 503,
      body: { error: 'Google Calendar sync is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).' },
    };
  }
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }
  const redirectUri = oauthRedirectUri(request);
  const state = signState(userId);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  // select_account lets the user add a second Google account; consent ensures refresh_token.
  url.searchParams.set('prompt', 'select_account consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return { status: 200, body: { url: url.toString() } };
}

export async function handleGoogleConnectCallback(request: Request): Promise<RedirectResult> {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return { status: 302, location: appReturnUrl({ google: 'error', reason: error.slice(0, 80) }) };
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return { status: 302, location: appReturnUrl({ google: 'error', reason: 'missing_code' }) };
  }
  const userId = verifyState(state);
  if (!userId) {
    return { status: 302, location: appReturnUrl({ google: 'error', reason: 'invalid_state' }) };
  }
  if (!googleConfigured() || !isServiceRoleConfigured()) {
    return { status: 302, location: appReturnUrl({ google: 'error', reason: 'not_configured' }) };
  }

  try {
    const token = await googleTokenRequest({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: oauthRedirectUri(request),
      grant_type: 'authorization_code',
    });
    if (!token.access_token) {
      return {
        status: 302,
        location: appReturnUrl({ google: 'error', reason: (token.error || 'token_exchange').slice(0, 80) }),
      };
    }

    const admin = createServiceClient();

    let googleEmail: string | null = null;
    let googleSub: string | null = null;
    try {
      const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const profile = (await me.json().catch(() => ({}))) as { email?: string; id?: string };
      if (profile.email) googleEmail = profile.email;
      if (profile.id) googleSub = profile.id;
    } catch {
      // optional
    }

    const accounts = await loadConnections(admin, userId);
    const existing =
      accounts.find((row) => googleSub && row.google_sub === googleSub) ||
      accounts.find(
        (row) =>
          googleEmail &&
          row.google_email &&
          row.google_email.toLowerCase() === googleEmail.toLowerCase(),
      ) ||
      null;

    const refreshToken = token.refresh_token || existing?.refresh_token;
    if (!refreshToken) {
      return { status: 302, location: appReturnUrl({ google: 'error', reason: 'no_refresh_token' }) };
    }

    const accessExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
    const payload = {
      user_id: userId,
      google_sub: googleSub ?? existing?.google_sub ?? null,
      google_email: googleEmail ?? existing?.google_email ?? null,
      refresh_token: refreshToken,
      access_token: token.access_token,
      access_expires_at: accessExpiresAt,
      push_enabled: existing?.push_enabled ?? true,
      push_calendar_id: existing?.push_calendar_id ?? null,
      push_calendar_name: existing?.push_calendar_name ?? null,
      pull_calendar_ids: existing?.pull_calendar_ids ?? [],
      connected_at: existing?.connected_at ?? new Date().toISOString(),
    };

    let connectionId = existing?.id ?? null;
    if (existing) {
      const { error: updateError } = await admin.from('user_google_calendar').update(payload).eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('user_google_calendar')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;
      connectionId = inserted.id as string;
    }

    if (connectionId) {
      let row = await loadConnection(admin, userId, connectionId);
      if (row) {
        try {
          if (row.push_enabled) await ensureFamilyCalendar(admin, row);
        } catch {
          // Connect still succeeds; user can pick a calendar in settings.
        }
        try {
          row = await ensureDefaultPullCalendars(admin, row);
        } catch {
          // optional
        }
      }
    }

    return { status: 302, location: appReturnUrl({ google: 'connected' }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'connect_failed';
    return { status: 302, location: appReturnUrl({ google: 'error', reason: message.slice(0, 80) }) };
  }
}

export async function handleGoogleStatus(userId: string): Promise<HandlerResult> {
  if (!isServiceRoleConfigured()) {
    return { status: 200, body: { connected: false, configured: googleConfigured(), accounts: [] } };
  }
  const admin = createServiceClient();
  const rows = await loadConnections(admin, userId);
  const accounts: GoogleAccountPublic[] = [];
  for (const raw of rows) {
    let row = raw;
    try {
      row = await ensureDefaultPullCalendars(admin, raw);
    } catch {
      // keep going
    }
    try {
      const calendars = await listGoogleCalendars(admin, row);
      accounts.push(accountPublic(row, { calendars, calendarsError: null }));
    } catch (err) {
      accounts.push(
        accountPublic(row, {
          calendars: [],
          calendarsError: err instanceof Error ? err.message : 'Could not list Google calendars',
        }),
      );
    }
  }
  return {
    status: 200,
    body: {
      connected: accounts.length > 0,
      configured: googleConfigured(),
      accounts,
    },
  };
}

export async function handleGoogleCalendars(
  userId: string,
  body: { connectionId?: unknown },
): Promise<HandlerResult> {
  if (!googleConfigured()) return { status: 503, body: { error: 'Google Calendar sync is not configured' } };
  if (!isServiceRoleConfigured()) return { status: 503, body: { error: 'API service role is not configured' } };
  const connectionId = connectionIdFromBody(body);
  if (!connectionId) return { status: 400, body: { error: 'connectionId is required' } };
  const admin = createServiceClient();
  const row = await loadConnection(admin, userId, connectionId);
  if (!row) return { status: 404, body: { error: 'Google account is not connected' } };
  try {
    const calendars = await listGoogleCalendars(admin, row);
    return { status: 200, body: { calendars, connectionId: row.id } };
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : 'Could not list calendars' } };
  }
}

export async function handleGoogleSettings(
  userId: string,
  body: {
    connectionId?: unknown;
    pushEnabled?: unknown;
    pushCalendarId?: unknown;
    pullCalendarIds?: unknown;
  },
): Promise<HandlerResult> {
  if (!isServiceRoleConfigured()) return { status: 503, body: { error: 'API service role is not configured' } };
  const connectionId = connectionIdFromBody(body);
  if (!connectionId) return { status: 400, body: { error: 'connectionId is required' } };
  const admin = createServiceClient();
  const row = await loadConnection(admin, userId, connectionId);
  if (!row) return { status: 404, body: { error: 'Google account is not connected' } };

  const patch: Record<string, unknown> = {};
  if (typeof body.pushEnabled === 'boolean') patch.push_enabled = body.pushEnabled;

  if (typeof body.pushCalendarId === 'string') {
    const id = body.pushCalendarId.trim();
    if (!id) {
      patch.push_calendar_id = null;
      patch.push_calendar_name = null;
    } else {
      try {
        const calendars = await listGoogleCalendars(admin, row);
        const match = calendars.find((cal) => cal.id === id);
        if (!match) return { status: 400, body: { error: 'Unknown push calendar' } };
        if (!match.writable) return { status: 400, body: { error: 'Push calendar must be writable' } };
        patch.push_calendar_id = match.id;
        patch.push_calendar_name = match.name;
      } catch (err) {
        return { status: 502, body: { error: err instanceof Error ? err.message : 'Could not verify calendar' } };
      }
    }
  }

  if (Array.isArray(body.pullCalendarIds)) {
    const ids = body.pullCalendarIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 40);
    patch.pull_calendar_ids = ids;
  }

  if (Object.keys(patch).length === 0) {
    return handleGoogleStatus(userId);
  }

  const { error } = await admin.from('user_google_calendar').update(patch).eq('id', row.id);
  if (error) return { status: 500, body: { error: error.message } };
  return handleGoogleStatus(userId);
}

export async function handleGoogleDisconnect(
  userId: string,
  body: { connectionId?: unknown },
): Promise<HandlerResult> {
  if (!isServiceRoleConfigured()) return { status: 503, body: { error: 'API service role is not configured' } };
  const admin = createServiceClient();
  const connectionId = connectionIdFromBody(body);
  if (connectionId) {
    const row = await loadConnection(admin, userId, connectionId);
    if (!row) return { status: 404, body: { error: 'Google account is not connected' } };
    await admin.from('household_event_google_maps').delete().eq('connection_id', row.id);
    const { error } = await admin.from('user_google_calendar').delete().eq('id', row.id).eq('user_id', userId);
    if (error) return { status: 500, body: { error: error.message } };
  } else {
    const accounts = await loadConnections(admin, userId);
    const ids = accounts.map((row) => row.id);
    if (ids.length > 0) {
      await admin.from('household_event_google_maps').delete().in('connection_id', ids);
    }
    const { error } = await admin.from('user_google_calendar').delete().eq('user_id', userId);
    if (error) return { status: 500, body: { error: error.message } };
  }
  return handleGoogleStatus(userId);
}

export async function handleGooglePushEvent(
  userId: string,
  body: { householdId?: unknown; eventId?: unknown },
): Promise<HandlerResult> {
  if (!googleConfigured()) return { status: 503, body: { error: 'Google Calendar sync is not configured' } };
  if (!isServiceRoleConfigured()) return { status: 503, body: { error: 'API service role is not configured' } };

  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!householdId || !eventId) return { status: 400, body: { error: 'householdId and eventId are required' } };

  const admin = createServiceClient();
  try {
    await assertHouseholdMember(admin, userId, householdId);
    const event = await loadHouseholdEvent(admin, eventId);
    if (!event || event.household_id !== householdId) {
      return { status: 404, body: { error: 'Event not found' } };
    }

    const memberIds = await householdMemberUserIds(admin, householdId);
    const { data: connections, error } = await admin
      .from('user_google_calendar')
      .select('*')
      .in('user_id', memberIds)
      .eq('push_enabled', true);
    if (error) throw error;

    let pushed = 0;
    const errors: string[] = [];
    for (const row of (connections ?? []) as ConnectionRow[]) {
      try {
        await pushEventToUser(admin, row, event);
        pushed += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'push failed');
      }
    }
    return { status: 200, body: { pushed, errors: errors.slice(0, 5) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not push event';
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
    return { status, body: { error: message.slice(0, 300) } };
  }
}

export async function handleGoogleDeleteEvent(
  userId: string,
  body: { householdId?: unknown; eventId?: unknown },
): Promise<HandlerResult> {
  if (!googleConfigured()) return { status: 503, body: { error: 'Google Calendar sync is not configured' } };
  if (!isServiceRoleConfigured()) return { status: 503, body: { error: 'API service role is not configured' } };

  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!householdId || !eventId) return { status: 400, body: { error: 'householdId and eventId are required' } };

  const admin = createServiceClient();
  try {
    await assertHouseholdMember(admin, userId, householdId);
    const memberIds = await householdMemberUserIds(admin, householdId);
    const { data: connections, error } = await admin.from('user_google_calendar').select('*').in('user_id', memberIds);
    if (error) throw error;

    let deleted = 0;
    const errors: string[] = [];
    for (const row of (connections ?? []) as ConnectionRow[]) {
      try {
        await deleteEventForUser(admin, row, eventId);
        deleted += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'delete failed');
      }
    }
    return { status: 200, body: { deleted, errors: errors.slice(0, 5) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete synced event';
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
    return { status, body: { error: message.slice(0, 300) } };
  }
}

export async function handleGooglePersonalDay(
  userId: string,
  body: { day?: unknown; from?: unknown; to?: unknown; timeZone?: unknown },
): Promise<HandlerResult> {
  if (!googleConfigured()) return { status: 200, body: { events: [] } };
  if (!isServiceRoleConfigured()) return { status: 200, body: { events: [] } };

  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day.trim()) ? body.day.trim() : '';
  const from =
    typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from.trim()) ? body.from.trim() : day;
  const to = typeof body.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.to.trim()) ? body.to.trim() : day;
  if (!from || !to) return { status: 400, body: { error: 'day or from/to (YYYY-MM-DD) is required' } };
  if (to < from) return { status: 400, body: { error: 'to must be on or after from' } };
  const timeZone =
    typeof body.timeZone === 'string' && body.timeZone.trim().length > 0 && body.timeZone.trim().length < 80
      ? body.timeZone.trim()
      : guessTimeZone();

  const admin = createServiceClient();
  try {
    const events = await collectPersonalEvents(admin, userId, from, to, timeZone);
    return { status: 200, body: { events } };
  } catch (err) {
    return { status: 502, body: { error: err instanceof Error ? err.message : 'Could not load personal events' } };
  }
}
