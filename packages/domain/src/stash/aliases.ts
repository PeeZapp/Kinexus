/** Stable funny display names for global watchlist social features. */

import { containsProfanity, isBlockedDisplayText } from '../moderation/profanity';

const ADJECTIVES = [
  'Bouncy',
  'Cosmic',
  'Crispy',
  'Dapper',
  'Dizzy',
  'Fuzzy',
  'Giddy',
  'Jolly',
  'Lucky',
  'Merry',
  'Nifty',
  'Peppy',
  'Quirky',
  'Rusty',
  'Snappy',
  'Sunny',
  'Wobbly',
  'Zesty',
  'Brave',
  'Calm',
  'Chipper',
  'Daring',
  'Gentle',
  'Happy',
  'Keen',
  'Lively',
  'Mighty',
  'Nimble',
  'Plucky',
  'Quick',
  'Radiant',
  'Spry',
  'Swift',
  'Upbeat',
  'Vivid',
  'Wily',
] as const;

const NOUNS = [
  'Badger',
  'Beaver',
  'Bison',
  'Corgi',
  'Cricket',
  'Dolphin',
  'Falcon',
  'Ferret',
  'Gecko',
  'Heron',
  'Koala',
  'Llama',
  'Mango',
  'Narwhal',
  'Otter',
  'Panda',
  'Penguin',
  'Puffin',
  'Quokka',
  'Raccoon',
  'Seagull',
  'Sloth',
  'Sparrow',
  'Turtle',
  'Wombat',
  'Yak',
  'Zebra',
  'Axolotl',
  'Bear',
  'Fox',
  'Hedgehog',
  'Moose',
  'Owl',
  'Rabbit',
  'Tiger',
  'Whale',
] as const;

function screenWords<T extends string>(words: readonly T[]): readonly T[] {
  const clean = words.filter((w) => !containsProfanity(w) && !isBlockedDisplayText(w));
  if (clean.length !== words.length) {
    const dropped = words.filter((w) => containsProfanity(w) || isBlockedDisplayText(w));
    throw new Error(`Alias word list failed moderation screen: ${dropped.join(', ')}`);
  }
  return clean;
}

const SAFE_ADJECTIVES = screenWords(ADJECTIVES);
const SAFE_NOUNS = screenWords(NOUNS);

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic funny alias from a stable seed (usually user id). */
export function funnyAliasFromSeed(seed: string): string {
  const h = hashSeed(seed || 'anonymous');
  const adjective = SAFE_ADJECTIVES[h % SAFE_ADJECTIVES.length]!;
  const noun = SAFE_NOUNS[Math.floor(h / SAFE_ADJECTIVES.length) % SAFE_NOUNS.length]!;
  const suffix = (h % 90) + 10;
  return `${adjective} ${noun} ${suffix}`;
}

export function isFunnyAlias(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 48) return false;
  return /^[A-Za-z]+ [A-Za-z]+ \d{2}$/.test(trimmed);
}

const PERMANENT_HANDLE_RE = /^[A-Za-z]+-[A-Za-z]+-\d{4}$/;

export function isPermanentHandle(value: string): boolean {
  return PERMANENT_HANDLE_RE.test(value.trim());
}

export function formatPermanentHandle(adjective: string, noun: string, n: number): string {
  const num = Math.abs(Math.floor(n)) % 10000;
  return `${adjective}-${noun}-${String(num).padStart(4, '0')}`;
}

export type HandleTakenCheck = (handle: string) => boolean | Promise<boolean>;

export type GeneratePermanentHandleOptions = {
  /** Max attempts before giving up (default 32). */
  maxAttempts?: number;
  /** RNG in [0, 1). Inject for tests. */
  random?: () => number;
};

/**
 * Permanent handle: Adjective-Noun-#### from the same curated lists as funny aliases.
 * Caller supplies `isTaken` for collision checks; retries until unique or maxAttempts.
 */
export async function generatePermanentHandle(
  isTaken: HandleTakenCheck,
  options: GeneratePermanentHandleOptions = {},
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 32;
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const adjective = SAFE_ADJECTIVES[Math.floor(random() * SAFE_ADJECTIVES.length)]!;
    const noun = SAFE_NOUNS[Math.floor(random() * SAFE_NOUNS.length)]!;
    const n = Math.floor(random() * 10000);
    const handle = formatPermanentHandle(adjective, noun, n);
    if (isBlockedDisplayText(handle)) continue;
    if (await isTaken(handle)) continue;
    return handle;
  }

  throw new Error(`Could not generate a unique handle after ${maxAttempts} attempts`);
}
