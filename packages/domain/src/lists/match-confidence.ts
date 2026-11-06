/** Auto-accept when confidence is at or above this. */
export const MATCH_AUTO_ACCEPT = 0.9;
/** Show as "needs confirmation" when at or above this but below auto-accept. */
export const MATCH_NEEDS_CONFIRM = 0.55;

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeTitle(value).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

/**
 * Score how well a TMDB (or search) candidate matches a title+year query.
 * Exact normalized title + same year → ~0.98; year off by 1 → ~0.85; fuzzy title lower.
 */
export function titleYearMatchConfidence(
  query: { title: string; year: number | null },
  candidate: { title: string; year: number | null },
): number {
  const qTitle = normalizeTitle(query.title);
  const cTitle = normalizeTitle(candidate.title);
  if (!qTitle || !cTitle) return 0;

  let titleScore = 0;
  if (qTitle === cTitle) titleScore = 1;
  else if (cTitle.startsWith(qTitle) || qTitle.startsWith(cTitle)) titleScore = 0.88;
  else {
    const overlap = jaccard(tokenSet(qTitle), tokenSet(cTitle));
    titleScore = overlap >= 0.7 ? 0.7 + (overlap - 0.7) * 0.5 : overlap * 0.65;
  }

  let yearScore = 0.7;
  if (query.year != null && candidate.year != null) {
    const delta = Math.abs(query.year - candidate.year);
    if (delta === 0) yearScore = 1;
    else if (delta === 1) yearScore = 0.55;
    else if (delta <= 2) yearScore = 0.35;
    else yearScore = 0.1;
  } else if (query.year == null || candidate.year == null) {
    yearScore = 0.75;
  }

  // Exact title + wrong year should land in the confirm band, not auto-accept.
  const blended = titleScore * 0.72 + yearScore * 0.28;
  if (titleScore >= 0.99 && query.year != null && candidate.year != null && query.year !== candidate.year) {
    return Math.min(MATCH_AUTO_ACCEPT - 0.01, Math.round(blended * 1000) / 1000);
  }
  return Math.round(Math.min(1, blended) * 1000) / 1000;
}

export function classifyMatchConfidence(confidence: number): 'auto' | 'confirm' | 'none' {
  if (confidence >= MATCH_AUTO_ACCEPT) return 'auto';
  if (confidence >= MATCH_NEEDS_CONFIRM) return 'confirm';
  return 'none';
}

/** Letterboxd 0.5–5 → Kinexus 1–10 integer. */
export function letterboxdRatingToScore(rating: number): number | null {
  if (!Number.isFinite(rating) || rating <= 0) return null;
  const score = Math.round(rating * 2);
  if (score < 1 || score > 10) return null;
  return score;
}

/** Kinexus 1–10 → Letterboxd 0.5–5 (half-star steps). */
export function scoreToLetterboxdRating(score: number): number | null {
  if (!Number.isInteger(score) || score < 1 || score > 10) return null;
  return score / 2;
}

export function normalizeImdbId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(tt)?(\d{5,10})$/i);
  if (!match) return null;
  return `tt${match[2]}`;
}
