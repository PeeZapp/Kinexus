/**
 * Client-safe display-text moderation: substring matching after leetspeak,
 * separator, and repeated-character normalisation.
 *
 * Blocklist is curated from LDNOOBW-style English obscenity lists plus slurs
 * and product-specific additions. Allowlist reduces Scunthorpe false positives.
 */

const LEET_TO_LETTER: Readonly<Record<string, string>> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** Digits that map to more than one letter — both forms are checked. */
const AMBIGUOUS_LEET: Readonly<Record<string, readonly string[]>> = {
  '1': ['i', 'l'],
};

/**
 * English obscenities / slurs (normalized, lowercase letters only).
 * Kept compact; extend via CUSTOM_BLOCKLIST rather than duplicating upstream lists.
 */
const BASE_BLOCKLIST = [
  'anal',
  'anus',
  'arse',
  'ass',
  'asshole',
  'ballsack',
  'bastard',
  'bitch',
  'biatch',
  'bloody',
  'blowjob',
  'bollock',
  'bollok',
  'boner',
  'boob',
  'bugger',
  'bum',
  'buttplug',
  'clitoris',
  'cock',
  'coon',
  'crap',
  'cunt',
  'damn',
  'dick',
  'dildo',
  'dyke',
  'fag',
  'faggot',
  'feck',
  'fellate',
  'fellatio',
  'felching',
  'fuck',
  'fudgepacker',
  'flange',
  'goddamn',
  'hell',
  'homo',
  'jerk',
  'jizz',
  'knobend',
  'labia',
  'muff',
  'nigger',
  'nigga',
  'penis',
  'piss',
  'poop',
  'prick',
  'pube',
  'pussy',
  'queer',
  'scrotum',
  'sex',
  'shit',
  'slut',
  'smegma',
  'spunk',
  'tit',
  'tosser',
  'turd',
  'twat',
  'vagina',
  'wank',
  'whore',
  'wtf',
] as const;

/** Extra product / community terms not always in generic lists. */
const CUSTOM_BLOCKLIST = [
  'retard',
  'retarded',
  'rape',
  'rapist',
  'molest',
  'pedo',
  'paedo',
  'nazis',
  'nazi',
  // Common compressed / leet stems after normalisation
  'fck',
  'fuk',
  'fock',
  'fvck',
  'fcuk',
] as const;

/**
 * Whole normalised substrings that should not trigger a block when they are
 * the intended word (Scunthorpe problem).
 */
const ALLOWLIST = [
  'scunthorpe',
  'shitake',
  'shiitake',
  'assassin',
  'assault',
  'assemble',
  'assembly',
  'assert',
  'assess',
  'asset',
  'assign',
  'assist',
  'associate',
  'assumption',
  'bass',
  'brass',
  'class',
  'classic',
  'compass',
  'cocktail',
  'document',
  'espresso',
  'grape',
  'hellenic',
  'hello',
  'shell',
  'passion',
  'pass',
  'sussex',
  'essex',
  'title',
  'attitude',
  'constitution',
  'peacock',
  'hancock',
  'dickens',
  'middlesex',
  'therapist',
  'analysis',
  'analyst',
  'canal',
  'arsenal',
  'cucumber',
  'scrap',
  'raccoon',
  'racoon',
  'balloon',
  'bassoon',
] as const;

/** Reserved names that must not be used as handles / display names. */
export const IMPERSONATION_TERMS = [
  'admin',
  'kinexus',
  'support',
  'staff',
  'official',
  'moderator',
] as const;

const BLOCKLIST: readonly string[] = Array.from(
  new Set(
    [...BASE_BLOCKLIST, ...CUSTOM_BLOCKLIST]
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))
      .filter(Boolean),
  ),
);

const ALLOWLIST_NORMALIZED: readonly string[] = ALLOWLIST.map((w) =>
  w.toLowerCase().replace(/[^a-z]/g, ''),
)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

/** Collapse every run of identical letters to one (fuuuuck → fuck, biittcch → bitch). */
function collapseAllRepeats(value: string): string {
  return value.replace(/(.)\1+/g, '$1');
}

function addNormalizedForms(out: Set<string>, lettersOnly: string): void {
  if (!lettersOnly) return;
  out.add(lettersOnly);
  const collapsed = collapseAllRepeats(lettersOnly);
  if (collapsed) out.add(collapsed);
}

function expandAmbiguous(chars: string[]): string[] {
  let variants = [''];
  for (const ch of chars) {
    const options = AMBIGUOUS_LEET[ch];
    if (options) {
      const next: string[] = [];
      for (const prefix of variants) {
        for (const opt of options) next.push(prefix + opt);
      }
      variants = next;
    } else {
      const mapped = LEET_TO_LETTER[ch] ?? ch;
      variants = variants.map((prefix) => prefix + mapped);
    }
  }
  return variants;
}

/**
 * Produce normalised candidate strings for matching.
 * Handles case, leetspeak (including 1→i/l), separators, and repeated letters.
 */
export function normalizeProfanityCandidates(input: string): string[] {
  const lower = input.toLowerCase();
  const chars = [...lower];
  const expanded = expandAmbiguous(chars);
  const out = new Set<string>();
  for (const variant of expanded) {
    // Drop dots/underscores/hyphens/spaces and leftover digits used as separators.
    addNormalizedForms(out, variant.replace(/[^a-z]/g, ''));
  }
  // Second pass: treat digits purely as separators (no letter substitution).
  addNormalizedForms(out, lower.replace(/[^a-z]/g, ''));
  return Array.from(out);
}

/** Primary normalised form: leet (1→i), separators stripped, long repeats collapsed. */
export function normalizeProfanityInput(input: string): string {
  const lower = input.toLowerCase();
  const primary = expandAmbiguous([...lower])[0] ?? '';
  // Collapse runs of 3+ only so legitimate doubles (ass) survive in the debug form.
  return primary.replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1');
}

function maskAllowlisted(normalized: string): string {
  let masked = normalized;
  for (const allowed of ALLOWLIST_NORMALIZED) {
    if (!allowed) continue;
    if (masked.includes(allowed)) {
      masked = masked.split(allowed).join(' '.repeat(allowed.length));
    }
  }
  return masked.replace(/ /g, '');
}

function matchesBlocklist(normalized: string): boolean {
  // Mask allowlisted phrases before matching (Scunthorpe).
  const masked = maskAllowlisted(normalized);
  if (!masked) return false;
  for (const word of BLOCKLIST) {
    if (masked.includes(word)) return true;
  }
  const collapsed = collapseAllRepeats(masked);
  if (collapsed && collapsed !== masked) {
    for (const word of BLOCKLIST) {
      if (collapsed.includes(word)) return true;
    }
  }
  return false;
}

/** True when any normalised candidate contains a blocked substring. */
export function containsProfanity(input: string): boolean {
  if (!input.trim()) return false;
  for (const candidate of normalizeProfanityCandidates(input)) {
    if (matchesBlocklist(candidate)) return true;
  }
  return false;
}

/** True when the text uses a reserved impersonation term as a segment. */
export function containsImpersonation(input: string): boolean {
  const reserved = new Set<string>(IMPERSONATION_TERMS);
  const parts = input.toLowerCase().split(/[^a-z0-9@$]+/);
  for (const part of parts) {
    if (!part) continue;
    for (const candidate of normalizeProfanityCandidates(part)) {
      if (reserved.has(candidate)) return true;
    }
  }
  for (const candidate of normalizeProfanityCandidates(input)) {
    if (reserved.has(candidate)) return true;
  }
  return false;
}

export type DisplayTextCheck =
  | { blocked: false }
  | { blocked: true; reason: 'profanity' | 'impersonation' };

/** Combined check for handles and display names (client-side instant feedback). */
export function checkDisplayText(input: string): DisplayTextCheck {
  if (containsImpersonation(input)) return { blocked: true, reason: 'impersonation' };
  if (containsProfanity(input)) return { blocked: true, reason: 'profanity' };
  return { blocked: false };
}

export function isBlockedDisplayText(input: string): boolean {
  return checkDisplayText(input).blocked;
}
