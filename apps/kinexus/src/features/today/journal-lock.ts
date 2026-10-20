import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

const PIN_LENGTH = 6;
const HASH_ROUNDS = 64;

export type JournalLock = {
  salt: string;
  hash: string;
};

function storageKey(userId: string) {
  return `kinexus.journalLock.${userId}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not load your journal lock.';
  if (error.code === 'PGRST205' || /user_journal_prefs|schema cache/i.test(message)) {
    return new Error('Today needs the latest database migration before the journal PIN can save.');
  }
  return new Error(message);
}

export function isJournalPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function normalizeJournalPin(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

async function digest(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  let next = `${salt}:${pin}`;
  for (let round = 0; round < HASH_ROUNDS; round += 1) {
    next = await digest(next);
  }
  return next;
}

async function makeSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromStored(value: unknown): JournalLock | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.salt !== 'string' || typeof row.hash !== 'string') return null;
  if (row.salt.length < 16 || row.hash.length !== 64) return null;
  return { salt: row.salt, hash: row.hash };
}

export async function loadJournalLock(user: AuthUser): Promise<JournalLock | null> {
  if (usesLocalStore(user)) {
    const raw = await AsyncStorage.getItem(storageKey(user.id));
    if (!raw) return null;
    try {
      return fromStored(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase!
    .from('user_journal_prefs')
    .select('pin_salt, pin_hash')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw explain(error);
  if (!data) return null;
  return fromStored({ salt: data.pin_salt, hash: data.pin_hash });
}

export async function saveJournalPin(user: AuthUser, pin: string): Promise<void> {
  if (!isJournalPin(pin)) throw new Error('Use a 6-digit PIN.');
  const salt = await makeSalt();
  const hash = await hashPin(pin, salt);
  if (usesLocalStore(user)) {
    await AsyncStorage.setItem(storageKey(user.id), JSON.stringify({ salt, hash }));
    return;
  }

  const { error } = await supabase!.from('user_journal_prefs').upsert(
    {
      user_id: user.id,
      pin_salt: salt,
      pin_hash: hash,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw explain(error);
}

export async function verifyJournalPin(user: AuthUser, pin: string, lock?: JournalLock | null): Promise<boolean> {
  if (!isJournalPin(pin)) return false;
  const current = lock === undefined ? await loadJournalLock(user) : lock;
  if (!current) return false;
  const hash = await hashPin(pin, current.salt);
  return hash === current.hash;
}

export async function clearJournalPin(user: AuthUser, currentPin: string): Promise<void> {
  const ok = await verifyJournalPin(user, currentPin);
  if (!ok) throw new Error('That PIN is incorrect.');
  if (usesLocalStore(user)) {
    await AsyncStorage.removeItem(storageKey(user.id));
    return;
  }
  const { error } = await supabase!.from('user_journal_prefs').delete().eq('user_id', user.id);
  if (error) throw explain(error);
}
