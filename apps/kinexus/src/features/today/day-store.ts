import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clipDayText,
  JOURNAL_LIMIT,
  normalizeDayTasks,
  WORKOUT_NOTES_LIMIT,
  WORKOUT_TITLE_LIMIT,
  type DayTask,
} from '@kinexus/domain';
import type { Json } from '@kinexus/db';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export type UserDay = {
  date: string;
  tasks: DayTask[];
  journal: string;
  workoutTitle: string;
  workoutNotes: string;
};

export function emptyUserDay(date: string): UserDay {
  return { date, tasks: [], journal: '', workoutTitle: '', workoutNotes: '' };
}

function storageKey(userId: string, date: string) {
  return `kinexus.userDay.${userId}.${date}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function fromStored(date: string, value: unknown): UserDay {
  if (!value || typeof value !== 'object') return emptyUserDay(date);
  const row = value as Record<string, unknown>;
  return {
    date,
    tasks: normalizeDayTasks(row.tasks),
    journal: clipDayText(row.journal, JOURNAL_LIMIT),
    workoutTitle: clipDayText(row.workoutTitle, WORKOUT_TITLE_LIMIT).trim(),
    workoutNotes: clipDayText(row.workoutNotes, WORKOUT_NOTES_LIMIT),
  };
}

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not load this day.';
  if (error.code === 'PGRST205' || /user_days|user_journal_entries|schema cache/i.test(message)) {
    return new Error('Today needs the latest database migration before tasks and the journal can save.');
  }
  return new Error(message);
}

export async function loadUserDay(user: AuthUser, date: string): Promise<UserDay> {
  if (usesLocalStore(user)) {
    const raw = await AsyncStorage.getItem(storageKey(user.id, date));
    if (!raw) return emptyUserDay(date);
    try {
      return fromStored(date, JSON.parse(raw));
    } catch {
      return emptyUserDay(date);
    }
  }

  const { data, error } = await supabase!
    .from('user_days')
    .select('tasks, journal, workout_title, workout_notes')
    .eq('user_id', user.id)
    .eq('day', date)
    .maybeSingle();
  if (error) throw explain(error);
  if (!data) return emptyUserDay(date);
  return {
    date,
    tasks: normalizeDayTasks(data.tasks),
    journal: clipDayText(data.journal, JOURNAL_LIMIT),
    workoutTitle: clipDayText(data.workout_title, WORKOUT_TITLE_LIMIT).trim(),
    workoutNotes: clipDayText(data.workout_notes, WORKOUT_NOTES_LIMIT),
  };
}

export type JournalEntry = {
  id: string;
  date: string;
  body: string;
  createdAt: string | null;
};

function entriesKey(userId: string) {
  return `kinexus.journalEntries.${userId}`;
}

export async function loadJournalEntries(user: AuthUser): Promise<JournalEntry[]> {
  if (usesLocalStore(user)) {
    const prefix = `kinexus.userDay.${user.id}.`;
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
    const pairs = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
    const legacy: JournalEntry[] = [];
    for (const [key, raw] of pairs) {
      if (!raw) continue;
      const date = key.slice(prefix.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      try {
        const body = clipDayText(JSON.parse(raw)?.journal, JOURNAL_LIMIT).trim();
        if (body) legacy.push({ id: `legacy:${date}`, date, body, createdAt: null });
      } catch {
        continue;
      }
    }
    let logged: JournalEntry[] = [];
    const saved = await AsyncStorage.getItem(entriesKey(user.id));
    if (saved) {
      try {
        logged = normalizeLoggedEntries(JSON.parse(saved));
      } catch {
        logged = [];
      }
    }
    return [...logged, ...legacy].sort(newestEntry);
  }

  const [{ data, error }, legacyResult] = await Promise.all([
    supabase!.from('user_journal_entries').select('id, day, body, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase!.from('user_days').select('day, journal').eq('user_id', user.id),
  ]);
  if (error) throw explain(error);
  if (legacyResult.error) throw explain(legacyResult.error);
  const logged = (data ?? []).map((row) => ({
    id: row.id,
    date: row.day,
    body: clipDayText(row.body, JOURNAL_LIMIT).trim(),
    createdAt: row.created_at,
  }));
  const legacy = (legacyResult.data ?? [])
    .map((row) => ({
      id: `legacy:${row.day}`,
      date: row.day,
      body: clipDayText(row.journal, JOURNAL_LIMIT).trim(),
      createdAt: null,
    }))
    .filter((entry) => entry.body.length > 0);
  return [...logged, ...legacy].filter((entry) => entry.body.length > 0).sort(newestEntry);
}

function newestEntry(a: JournalEntry, b: JournalEntry): number {
  const left = a.createdAt ?? `${a.date}T00:00:00`;
  const right = b.createdAt ?? `${b.date}T00:00:00`;
  return left < right ? 1 : left > right ? -1 : 0;
}

function normalizeLoggedEntries(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: JournalEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.date !== 'string') continue;
    const body = clipDayText(row.body, JOURNAL_LIMIT).trim();
    if (!body) continue;
    entries.push({
      id: row.id,
      date: row.date,
      body,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
    });
  }
  return entries;
}

export async function addJournalEntry(user: AuthUser, date: string, body: string): Promise<void> {
  const next = clipDayText(body, JOURNAL_LIMIT).trim();
  if (!next) return;
  if (usesLocalStore(user)) {
    const saved = await AsyncStorage.getItem(entriesKey(user.id));
    const logged = saved ? normalizeLoggedEntries(JSON.parse(saved)) : [];
    logged.unshift({
      id: `local-${Date.now().toString(36)}`,
      date,
      body: next,
      createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(entriesKey(user.id), JSON.stringify(logged));
    return;
  }

  const { error } = await supabase!.from('user_journal_entries').insert({
    user_id: user.id,
    day: date,
    body: next,
  });
  if (error) throw explain(error);
}

export async function saveUserDay(user: AuthUser, day: UserDay): Promise<void> {
  const next: UserDay = {
    date: day.date,
    tasks: normalizeDayTasks(day.tasks),
    journal: clipDayText(day.journal, JOURNAL_LIMIT),
    workoutTitle: clipDayText(day.workoutTitle, WORKOUT_TITLE_LIMIT).trim(),
    workoutNotes: clipDayText(day.workoutNotes, WORKOUT_NOTES_LIMIT),
  };
  if (usesLocalStore(user)) {
    await AsyncStorage.setItem(storageKey(user.id, next.date), JSON.stringify(next));
    return;
  }

  const { error } = await supabase!.from('user_days').upsert(
    {
      user_id: user.id,
      day: next.date,
      tasks: next.tasks as unknown as Json,
      journal: next.journal,
      workout_title: next.workoutTitle,
      workout_notes: next.workoutNotes,
    },
    { onConflict: 'user_id,day' },
  );
  if (error) throw explain(error);
}
