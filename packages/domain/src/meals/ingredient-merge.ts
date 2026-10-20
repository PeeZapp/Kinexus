/**
 * Canonical merge keys for shopping-list dedupe.
 * Merges prep/unit variants (sliced onion ≈ onion, garlic cloves ≈ garlic)
 * but keeps distinct varieties (red onion ≠ brown onion, green onion ≠ onion).
 */

const DISTINCT_PHRASES = [
  'green onion',
  'spring onion',
  'salad onion',
  'scallion',
  'red onion',
  'brown onion',
  'white onion',
  'yellow onion',
  'spanish onion',
  'green apple',
  'red apple',
  'granny smith',
  'pink lady',
  // Vinegars first (longer than bare wines) — never merge with drinking wine
  'white wine vinegar',
  'red wine vinegar',
  'rice wine vinegar',
  'apple cider vinegar',
  'balsamic vinegar',
  'sherry vinegar',
  'malt vinegar',
  'cider vinegar',
  'rice vinegar',
  'wine vinegar',
  'red wine',
  'white wine',
  'rose wine',
  'rosé wine',
  'sparkling wine',
  'rice wine',
  'shaoxing wine',
].sort((a, b) => b.length - a.length);

const PREP_RE =
  /\b(?:finely|roughly|freshly|thinly|coarsely)?\s*(?:sliced|chopped|diced|minced|grated|crushed|peeled|halved|quartered|cubed|shredded|torn)\b/g;

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePlural(value: string): string {
  if (value.endsWith('ies') && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith('oes') && value.length > 4) return value.slice(0, -2);
  if (value.endsWith('sses')) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss') && value.length > 3) return value.slice(0, -1);
  return value;
}

function stripPrep(value: string): string {
  return collapseSpaces(value.replace(PREP_RE, ' ').replace(/\b(?:fresh|extra)\b/g, ' '));
}

function phraseInName(name: string, phrase: string): boolean {
  if (name === phrase) return true;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(name);
}

/** Stable key used to merge shopping rows that are the same item. */
export function shoppingMergeKey(name: string): string {
  let n = collapseSpaces(name.toLowerCase());
  if (!n) return '';

  n = stripPrep(n);

  // Garlic unit wording in the name
  n = n.replace(/\bgarlic\s+cloves?\b/g, 'garlic');
  n = n.replace(/\bcloves?\s+(?:of\s+)?garlic\b/g, 'garlic');

  // Plain cooking salt variants (not seasoned salts like garlic salt)
  if (!/\b(?:garlic|celery|onion|lemon|smoked)\s+salt\b/.test(n)) {
    n = n.replace(/\b(?:fine|flaky|coarse|cracked)?\s*sea\s+salt\b/g, 'salt');
    n = n.replace(/\btable\s+salt\b/g, 'salt');
  }

  // Vinegars are never the same product as each other or as wine
  if (/\bvinegar\b/.test(n)) {
    for (const phrase of DISTINCT_PHRASES) {
      if (!phrase.includes('vinegar')) continue;
      if (phraseInName(n, phrase)) return normalizePlural(phrase);
    }
    return normalizePlural(n);
  }

  // Wine style: dry white wine → white wine (keep red/white distinct via phrases)
  n = n.replace(/\bdry\s+(?=(?:white|red)\s+wine\b)/g, '');

  for (const phrase of DISTINCT_PHRASES) {
    if (phraseInName(n, phrase)) return normalizePlural(phrase);
  }

  n = collapseSpaces(n);
  return normalizePlural(n);
}

/** Prefer a short, clean display name from a merge group. */
export function pickCanonicalShoppingName(names: readonly string[]): string {
  if (names.length === 0) return '';
  const scored = names.map((raw) => {
    const trimmed = raw.trim();
    const key = shoppingMergeKey(trimmed);
    const stripped = stripPrep(trimmed.toLowerCase())
      .replace(/\bgarlic\s+cloves?\b/g, 'garlic')
      .replace(/\bdry\s+(?=(?:white|red)\s+wine\b)/g, '');
    const cleanLen = stripped.length;
    const hasPrep = PREP_RE.test(trimmed.toLowerCase());
    PREP_RE.lastIndex = 0;
    const clovey = /\bcloves?\b/i.test(trimmed) && key === 'garlic';
    return { trimmed, cleanLen, hasPrep, clovey };
  });
  scored.sort((a, b) => {
    if (a.clovey !== b.clovey) return a.clovey ? 1 : -1;
    if (a.hasPrep !== b.hasPrep) return a.hasPrep ? 1 : -1;
    if (a.cleanLen !== b.cleanLen) return a.cleanLen - b.cleanLen;
    return a.trimmed.localeCompare(b.trimmed);
  });
  const best = scored[0]?.trimmed ?? names[0] ?? '';
  // Title-ish: keep original casing of the winner
  return best;
}
