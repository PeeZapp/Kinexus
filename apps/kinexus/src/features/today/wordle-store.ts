import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

function storageKey(userId: string, date: string) {
  return `kinexus.wordle.${userId}.${date}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function cleanGuesses(values: readonly string[]): string[] {
  const guesses: string[] = [];
  for (const value of values) {
    const guess = value.toLowerCase();
    if (!/^[a-z]{5}$/.test(guess)) continue;
    guesses.push(guess);
    if (guesses.length >= 6) break;
  }
  return guesses;
}

export async function loadWordleGuesses(user: AuthUser, date: string): Promise<string[]> {
  if (usesLocalStore(user)) {
    const raw = await AsyncStorage.getItem(storageKey(user.id, date));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return cleanGuesses(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return [];
    }
  }

  const { data, error } = await supabase!
    .from('user_wordle_days')
    .select('guesses')
    .eq('user_id', user.id)
    .eq('played_on', date)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205' || /user_wordle_days|schema cache/i.test(error.message)) {
      throw new Error('Wordle needs the latest database migration before it can save today’s guesses.');
    }
    throw new Error(error.message);
  }
  return cleanGuesses(data?.guesses ?? []);
}

export async function saveWordleGuesses(user: AuthUser, date: string, guesses: readonly string[]): Promise<void> {
  const next = cleanGuesses(guesses);
  if (usesLocalStore(user)) {
    await AsyncStorage.setItem(storageKey(user.id, date), JSON.stringify(next));
    return;
  }
  const { error } = await supabase!.from('user_wordle_days').upsert(
    { user_id: user.id, played_on: date, guesses: next },
    { onConflict: 'user_id,played_on' },
  );
  if (error) throw new Error(error.message);
}
