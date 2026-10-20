import {
  birthdayMarkers,
  mergeCalendarMarkers,
  publicHolidayMarkers,
  schoolHolidayMarkers,
  type CalendarMarker,
  type HouseholdPerson,
} from '@kinexus/domain';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function apiReady(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function postObservances(input: {
  country: string;
  from: string;
  to: string;
}): Promise<{ publicHolidays: { date: string; name: string }[]; schoolHolidays: CalendarMarker[] }> {
  if (!apiReady() || !supabase) {
    return { publicHolidays: [], schoolHolidays: [] };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { publicHolidays: [], schoolHolidays: [] };

  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}/calendar/observances`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { publicHolidays: [], schoolHolidays: [] };
  }

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicHolidays?: { date: string; name: string }[];
    schoolHolidays?: {
      id: string;
      title: string;
      startsOn: string;
      endsOn: string;
      source?: string;
    }[];
  };
  if (!res.ok) return { publicHolidays: [], schoolHolidays: [] };

  return {
    publicHolidays: payload.publicHolidays ?? [],
    schoolHolidays: (payload.schoolHolidays ?? []).map((row) => ({
      id: row.id,
      kind: 'school_holiday' as const,
      title: row.title,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      source: row.source,
    })),
  };
}

export async function loadCalendarMarkers(input: {
  country: string | null | undefined;
  people: readonly HouseholdPerson[];
  from: string;
  to: string;
}): Promise<CalendarMarker[]> {
  const country = input.country ?? 'AU';
  const birthdays = birthdayMarkers(input.people, input.from, input.to);
  const localSchool = schoolHolidayMarkers(country, input.from, input.to);
  const remote = await postObservances({ country, from: input.from, to: input.to });
  const publicMarkers = publicHolidayMarkers(remote.publicHolidays, input.from, input.to);
  return mergeCalendarMarkers(birthdays, publicMarkers, localSchool, remote.schoolHolidays);
}
