import { describe, expect, it } from 'vitest';

import { containsProfanity, isBlockedDisplayText } from '../moderation/profanity';
import {
  funnyAliasFromSeed,
  generatePermanentHandle,
  isPermanentHandle,
} from './aliases';
import {
  audienceForBirthday,
  audienceFromCertification,
  canViewAudience,
  certificationAllowed,
  maxAllowedCertification,
  normalizeAuCertification,
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

  it('picks the strictest AU certificate across selected people', () => {
    const today = new Date('2026-11-10T12:00:00Z');
    expect(maxAllowedCertification([{ personType: 'adult' }], today)).toBe('R18+');
    expect(
      maxAllowedCertification(
        [{ personType: 'adult' }, { personType: 'child', birthday: '2018-01-01' }],
        today,
      ),
    ).toBe('PG');
    expect(
      maxAllowedCertification(
        [{ birthday: '2013-01-01' }, { birthday: '2012-06-01' }],
        today,
      ),
    ).toBe('M');
    expect(normalizeAuCertification('ma 15+')).toBe('MA15+');
    expect(certificationAllowed('PG', 'PG')).toBe(true);
    expect(certificationAllowed('M', 'PG')).toBe(false);
    expect(certificationAllowed(null, 'PG')).toBe(false);
    expect(certificationAllowed(null, 'R18+', { allowMissing: true })).toBe(true);
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

describe('permanent handles', () => {
  it('formats Adjective-Noun-#### and retries on collision', async () => {
    const taken = new Set<string>();
    const handle = await generatePermanentHandle((h) => taken.has(h), {
      random: (() => {
        let i = 0;
        const seq = [0, 0, 0.48, 0.1, 0.2, 0.48];
        return () => seq[i++] ?? Math.random();
      })(),
    });
    expect(isPermanentHandle(handle)).toBe(true);
    expect(handle).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{4}$/);

    taken.add(handle);
    let attempts = 0;
    const second = await generatePermanentHandle(
      (h) => {
        attempts += 1;
        return taken.has(h);
      },
      { maxAttempts: 8 },
    );
    expect(second).not.toBe(handle);
    expect(attempts).toBeGreaterThanOrEqual(1);
  });

  it('generates many handles that all pass the profanity filter', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const handle = await generatePermanentHandle((h) => seen.has(h));
      seen.add(handle);
      expect(isPermanentHandle(handle)).toBe(true);
      expect(containsProfanity(handle)).toBe(false);
      expect(isBlockedDisplayText(handle)).toBe(false);
    }
    expect(seen.size).toBe(200);
  });
});
