import { Platform } from 'react-native';

import type { CalendarEvent } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function apiReady(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function authHeaders(): Promise<HeadersInit | null> {
  if (!apiReady() || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Sign in required', status: 401 };
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  } catch {
    return { ok: false, error: 'Could not reach the API', status: 0 };
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    return { ok: false, error: payload.error || `Request failed (${res.status})`, status: res.status };
  }
  return { ok: true, data: payload };
}

export type GoogleCalendarListItem = {
  id: string;
  name: string;
  primary: boolean;
  writable: boolean;
};

export type GoogleAccountStatus = {
  id: string;
  email: string | null;
  pushEnabled: boolean;
  pushCalendarId: string | null;
  pushCalendarName: string | null;
  pullCalendarIds: string[];
  connectedAt: string;
  calendars?: GoogleCalendarListItem[];
  calendarsError?: string | null;
};

export type GoogleCalendarStatus = {
  connected: boolean;
  configured?: boolean;
  accounts?: GoogleAccountStatus[];
  /** @deprecated single-account shape kept for older responses */
  email?: string | null;
  pushEnabled?: boolean;
  pushCalendarId?: string | null;
  pushCalendarName?: string | null;
  pullCalendarIds?: string[];
  connectedAt?: string;
};

export async function loadGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const result = await apiJson<GoogleCalendarStatus>('/calendar/google/status');
  if (!result.ok) return { connected: false, configured: false, accounts: [] };
  const data = result.data;
  if (!data.accounts && data.connected && data.email) {
    return {
      ...data,
      accounts: [
        {
          id: 'legacy',
          email: data.email ?? null,
          pushEnabled: Boolean(data.pushEnabled),
          pushCalendarId: data.pushCalendarId ?? null,
          pushCalendarName: data.pushCalendarName ?? null,
          pullCalendarIds: data.pullCalendarIds ?? [],
          connectedAt: data.connectedAt ?? new Date().toISOString(),
        },
      ],
    };
  }
  return { ...data, accounts: data.accounts ?? [] };
}

export async function startGoogleCalendarConnect(): Promise<string> {
  const result = await apiJson<{ url?: string; error?: string }>('/calendar/google/connect', { method: 'POST' });
  if (!result.ok) throw new Error(result.error);
  if (!result.data.url) throw new Error('No Google connect URL returned');
  return result.data.url;
}

export async function loadGoogleCalendars(connectionId: string): Promise<GoogleCalendarListItem[]> {
  const result = await apiJson<{ calendars?: GoogleCalendarListItem[] }>('/calendar/google/calendars', {
    method: 'POST',
    body: JSON.stringify({ connectionId }),
  });
  if (!result.ok) throw new Error(result.error);
  return result.data.calendars ?? [];
}

export async function saveGoogleCalendarSettings(input: {
  connectionId: string;
  pushEnabled?: boolean;
  pushCalendarId?: string | null;
  pullCalendarIds?: string[];
}): Promise<GoogleCalendarStatus> {
  const result = await apiJson<GoogleCalendarStatus>('/calendar/google/settings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function disconnectGoogleCalendar(connectionId?: string): Promise<GoogleCalendarStatus> {
  const result = await apiJson<GoogleCalendarStatus>('/calendar/google/disconnect', {
    method: 'POST',
    body: JSON.stringify(connectionId ? { connectionId } : {}),
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function pushHouseholdEventToGoogle(householdId: string, eventId: string): Promise<void> {
  try {
    await apiJson('/calendar/google/push', {
      method: 'POST',
      body: JSON.stringify({ householdId, eventId }),
    });
  } catch {
    // ignore
  }
}

export async function deleteHouseholdEventFromGoogle(householdId: string, eventId: string): Promise<void> {
  try {
    await apiJson('/calendar/google/delete', {
      method: 'POST',
      body: JSON.stringify({ householdId, eventId }),
    });
  } catch {
    // ignore
  }
}

function clientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function mapPersonalEvents(events: CalendarEvent[] | undefined): CalendarEvent[] {
  return (events ?? []).map((event) => ({
    ...event,
    source: 'google' as const,
    householdId: event.householdId || '',
    personIds: event.personIds ?? [],
    recurrence: event.recurrence || 'none',
    untilOn: event.untilOn ?? null,
    remindMinutes: event.remindMinutes ?? null,
    color: event.color || 'sky',
  }));
}

export async function loadPersonalGoogleDayEvents(day: string): Promise<CalendarEvent[]> {
  const result = await apiJson<{ events?: CalendarEvent[] }>('/calendar/google/personal', {
    method: 'POST',
    body: JSON.stringify({ day, timeZone: clientTimeZone() }),
  });
  if (!result.ok) return [];
  return mapPersonalEvents(result.data.events);
}

export async function loadPersonalGoogleEventsInRange(from: string, to: string): Promise<CalendarEvent[]> {
  const result = await apiJson<{ events?: CalendarEvent[] }>('/calendar/google/personal', {
    method: 'POST',
    body: JSON.stringify({ from, to, timeZone: clientTimeZone() }),
  });
  if (!result.ok) return [];
  return mapPersonalEvents(result.data.events);
}
