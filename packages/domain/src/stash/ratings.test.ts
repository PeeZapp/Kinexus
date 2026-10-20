import { describe, expect, it } from 'vitest';

import { funnyAliasFromSeed } from './aliases';
import {
  audienceForBirthday,
  audienceFromCertification,
  canViewAudience,
  viewerAudience,
} from './ratings';

describe('watchlist audiences', () => {
  it('maps certifications to bands', () => {
    expect(audienceFromCertification('G')).toBe('all');
    expect(audienceFromCertification('PG')).toBe('7+');
    expect(audienceFromCertification('PG-13')).toBe('13+');
    expect(audienceFromCertification('R')).toBe('16+');
    expect(audienceFromCertification('NC-17')).toBe('18+');
    expect(audienceFromCertification(null)).toBeNull();
  });

  it('uses birthday when present and keeps the tighter ceiling', () => {
    const today = new Date('2026-10-19T12:00:00Z');
    expect(audienceForBirthday('2020-01-01', today)).toBe('all');
    expect(audienceForBirthday('2015-01-01', today)).toBe('7+');
    expect(audienceForBirthday('2012-01-01', today)).toBe('13+');
    expect(viewerAudience({ role: 'teen', birthday: '2020-01-01', today })).toBe('all');
    expect(viewerAudience({ role: 'child', birthday: null, today })).toBe('7+');
  });

  it('gates list visibility by band', () => {
    expect(canViewAudience('7+', 'all')).toBe(true);
    expect(canViewAudience('7+', '13+')).toBe(false);
    expect(canViewAudience('18+', '16+')).toBe(true);
  });
});

describe('funny aliases', () => {
  it('is stable for a seed and looks like a funny name', () => {
    const a = funnyAliasFromSeed('user-1');
    const b = funnyAliasFromSeed('user-1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z]+ [A-Za-z]+ \d{2}$/);
    expect(funnyAliasFromSeed('user-2')).not.toBe(a);
  });
});
