/** Stable funny display names for global watchlist social features. */

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
  const adjective = ADJECTIVES[h % ADJECTIVES.length]!;
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length]!;
  const suffix = (h % 90) + 10;
  return `${adjective} ${noun} ${suffix}`;
}

export function isFunnyAlias(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 48) return false;
  return /^[A-Za-z]+ [A-Za-z]+ \d{2}$/.test(trimmed);
}
