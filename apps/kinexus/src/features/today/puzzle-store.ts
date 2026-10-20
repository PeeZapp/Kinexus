import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PuzzleGameId } from '@kinexus/domain';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

function storageKey(userId: string, date: string, game: PuzzleGameId) {
  return `kinexus.puzzle.${userId}.${date}.${game}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function missingTable(error: { code?: string; message?: string }) {
  return error.code === 'PGRST205' || /user_puzzle_days|schema cache/i.test(error.message ?? '');
}

export async function loadPuzzleState(user: AuthUser, date: string, game: PuzzleGameId): Promise<unknown | null> {
  const local = async () => {
    const raw = await AsyncStorage.getItem(storageKey(user.id, date, game));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };

  if (usesLocalStore(user)) return local();

  const { data, error } = await supabase!
    .from('user_puzzle_days')
    .select('state')
    .eq('user_id', user.id)
    .eq('played_on', date)
    .eq('game', game)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return local();
    throw new Error(error.message);
  }
  return data?.state ?? (await local());
}

export async function savePuzzleState(user: AuthUser, date: string, game: PuzzleGameId, state: unknown): Promise<void> {
  await AsyncStorage.setItem(storageKey(user.id, date, game), JSON.stringify(state));
  if (usesLocalStore(user)) return;
  const { error } = await supabase!.from('user_puzzle_days').upsert(
    { user_id: user.id, played_on: date, game, state: state as never },
    { onConflict: 'user_id,played_on,game' },
  );
  if (error && !missingTable(error)) throw new Error(error.message);
}
