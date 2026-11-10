import type { HouseholdRole } from '../household/types';

/** Simplified content bands used for age-gating lists and titles. */
export type WatchlistAudience = 'all' | '7+' | '13+' | '16+' | '18+';

export const WATCHLIST_AUDIENCES = ['all', '7+', '13+', '16+', '18+'] as const;

const AUDIENCE_RANK: Record<WatchlistAudience, number> = {
  all: 0,
  '7+': 1,
  '13+': 2,
  '16+': 3,
  '18+': 4,
};

const AUDIENCE_SET = new Set<string>(WATCHLIST_AUDIENCES);

export function isWatchlistAudience(value: string): value is WatchlistAudience {
  return AUDIENCE_SET.has(value);
}

export function audienceRank(audience: WatchlistAudience): number {
  return AUDIENCE_RANK[audience];
}

/** Higher of two bands (more restrictive ceiling for a list). */
export function maxAudience(a: WatchlistAudience, b: WatchlistAudience): WatchlistAudience {
  return audienceRank(a) >= audienceRank(b) ? a : b;
}

/** True when a viewer allowed up to `allowed` may see content rated `content`. */
export function canViewAudience(allowed: WatchlistAudience, content: WatchlistAudience): boolean {
  return audienceRank(content) <= audienceRank(allowed);
}

/** Map common US movie/TV certifications to a band. Unknown → null. */
export function audienceFromCertification(certification: string | null | undefined): WatchlistAudience | null {
  const raw = certification?.trim().toUpperCase();
  if (!raw) return null;
  if (['G', 'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'U', 'UC'].includes(raw)) return 'all';
  if (['PG', 'TV-PG'].includes(raw)) return '7+';
  if (['PG-13', 'TV-14', '12', '12A', 'M'].includes(raw)) return '13+';
  if (['R', 'TV-MA', '15', '16', 'MA15+'].includes(raw)) return '16+';
  if (['NC-17', 'X', 'R18+', '18', 'R21'].includes(raw)) return '18+';
  return null;
}

/** Role-based default ceiling when birthday is unknown. */
export function audienceForRole(role: HouseholdRole | null | undefined): WatchlistAudience {
  if (role === 'child') return '7+';
  if (role === 'teen') return '13+';
  return '18+';
}

/** Birthday-based ceiling (ISO date YYYY-MM-DD). */
export function audienceForBirthday(birthday: string | null | undefined, today = new Date()): WatchlistAudience {
  const trimmed = birthday?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '18+';
  const born = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(born.getTime())) return '18+';
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const month = today.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < born.getUTCDate())) age -= 1;
  if (age < 7) return 'all';
  if (age < 13) return '7+';
  if (age < 16) return '13+';
  if (age < 18) return '16+';
  return '18+';
}

/**
 * Viewer ceiling: more restrictive of household role and birthday (when known).
 * Adults/owners/admins without a birthday get full access.
 */
export function viewerAudience(opts: {
  role: HouseholdRole | null | undefined;
  birthday?: string | null;
  today?: Date;
}): WatchlistAudience {
  const byRole = audienceForRole(opts.role);
  if (!opts.birthday?.trim()) return byRole;
  const byAge = audienceForBirthday(opts.birthday, opts.today);
  return audienceRank(byAge) <= audienceRank(byRole) ? byAge : byRole;
}

export function audienceLabel(audience: WatchlistAudience): string {
  if (audience === 'all') return 'All ages';
  return audience;
}

/** Australian classification labels used for Watch next age gating. */
export type AuCertification = 'G' | 'PG' | 'M' | 'MA15+' | 'R18+';

export const AU_CERTIFICATIONS = ['G', 'PG', 'M', 'MA15+', 'R18+'] as const;

const AU_CERT_RANK: Record<AuCertification, number> = {
  G: 0,
  PG: 1,
  M: 2,
  'MA15+': 3,
  'R18+': 4,
};

const AU_CERT_SET = new Set<string>(AU_CERTIFICATIONS);

export function isAuCertification(value: string): value is AuCertification {
  return AU_CERT_SET.has(value);
}

export function auCertificationRank(cert: AuCertification): number {
  return AU_CERT_RANK[cert];
}

/** Map AU (and common equivalent) labels to a canonical AU certificate. */
export function normalizeAuCertification(raw: string | null | undefined): AuCertification | null {
  const value = raw?.trim().toUpperCase().replace(/\s+/g, '');
  if (!value) return null;
  if (['G', 'TV-G', 'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'U', 'UC'].includes(value)) return 'G';
  if (['PG', 'TV-PG'].includes(value)) return 'PG';
  if (['M', 'PG-13', 'TV-14', '12', '12A'].includes(value)) return 'M';
  if (['MA15+', 'R', 'TV-MA', '15', '16'].includes(value)) return 'MA15+';
  if (['R18+', 'NC-17', 'X', '18', 'R21'].includes(value)) return 'R18+';
  return isAuCertification(value) ? value : null;
}

export function audienceToAuCertification(audience: WatchlistAudience): AuCertification {
  if (audience === 'all') return 'G';
  if (audience === '7+') return 'PG';
  if (audience === '13+') return 'M';
  if (audience === '16+') return 'MA15+';
  return 'R18+';
}

export type WatchAudiencePerson = {
  birthday?: string | null;
  personType?: 'adult' | 'child' | 'other' | null;
};

/** Birthday when known; otherwise child → 7+, everyone else → 18+. */
export function personWatchAudience(person: WatchAudiencePerson, today = new Date()): WatchlistAudience {
  if (person.birthday?.trim()) return audienceForBirthday(person.birthday, today);
  if (person.personType === 'child') return '7+';
  return '18+';
}

export function isWatchAdult(person: WatchAudiencePerson, today = new Date()): boolean {
  return personWatchAudience(person, today) === '18+';
}

/** Strictest AU certificate the selected people may watch together. */
export function maxAllowedCertification(
  people: readonly WatchAudiencePerson[],
  today = new Date(),
): AuCertification {
  if (people.length === 0) return 'R18+';
  let allowed = audienceToAuCertification(personWatchAudience(people[0]!, today));
  for (let i = 1; i < people.length; i += 1) {
    const next = audienceToAuCertification(personWatchAudience(people[i]!, today));
    if (auCertificationRank(next) < auCertificationRank(allowed)) allowed = next;
  }
  return allowed;
}

/** True when content cert is at or under the ceiling. Missing certs only when allowMissing. */
export function certificationAllowed(
  content: string | null | undefined,
  maxAllowed: AuCertification,
  opts?: { allowMissing?: boolean },
): boolean {
  const cert = normalizeAuCertification(content);
  if (!cert) return Boolean(opts?.allowMissing);
  return auCertificationRank(cert) <= auCertificationRank(maxAllowed);
}
