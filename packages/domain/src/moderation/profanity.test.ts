import { describe, expect, it } from 'vitest';

import {
  checkDisplayText,
  containsImpersonation,
  containsProfanity,
  IMPERSONATION_TERMS,
  isBlockedDisplayText,
  normalizeProfanityInput,
} from './profanity';

describe('normalizeProfanityInput', () => {
  it('lowercases and strips separators', () => {
    expect(normalizeProfanityInput('F.u_c-K')).toBe('fuck');
  });

  it('maps leetspeak and collapses repeats', () => {
    expect(normalizeProfanityInput('f0ck')).toBe('fock');
    expect(normalizeProfanityInput('a55')).toBe('ass');
    expect(normalizeProfanityInput('sh1t')).toBe('shit');
    expect(normalizeProfanityInput('fuuuuck')).toBe('fuck');
    expect(normalizeProfanityInput('@55h0l3')).toBe('asshole');
    expect(normalizeProfanityInput('7i7')).toBe('tit');
  });
});

describe('containsProfanity', () => {
  it('flags plain and cased obscenities', () => {
    expect(containsProfanity('fuck')).toBe(true);
    expect(containsProfanity('FuCk')).toBe(true);
    expect(containsProfanity('hello world')).toBe(false);
  });

  it('flags leetspeak', () => {
    expect(containsProfanity('f0ck')).toBe(true);
    expect(containsProfanity('sh1t')).toBe(true);
    expect(containsProfanity('a55hole')).toBe(true);
    expect(containsProfanity('b1tch')).toBe(true);
    expect(containsProfanity('$h1t')).toBe(true);
    expect(containsProfanity('@ss')).toBe(true);
  });

  it('flags separator evasion', () => {
    expect(containsProfanity('f.u.c.k')).toBe(true);
    expect(containsProfanity('f_u_c_k')).toBe(true);
    expect(containsProfanity('f u c k')).toBe(true);
    expect(containsProfanity('s.h.i.t')).toBe(true);
    expect(containsProfanity('f2u2c2k')).toBe(true);
  });

  it('flags repeated characters', () => {
    expect(containsProfanity('fuuuuck')).toBe(true);
    expect(containsProfanity('shitttt')).toBe(true);
    expect(containsProfanity('biittcch')).toBe(true);
  });

  it('allows Scunthorpe-style false positives via allowlist', () => {
    expect(containsProfanity('Scunthorpe')).toBe(false);
    expect(containsProfanity('classic')).toBe(false);
    expect(containsProfanity('assassin')).toBe(false);
    expect(containsProfanity('hello')).toBe(false);
    expect(containsProfanity('title')).toBe(false);
    expect(containsProfanity('cocktail')).toBe(false);
    expect(containsProfanity('shiitake')).toBe(false);
    expect(containsProfanity('document')).toBe(false);
    expect(containsProfanity('Raccoon')).toBe(false);
  });
});

describe('impersonation terms', () => {
  it('blocks reserved segments', () => {
    for (const term of IMPERSONATION_TERMS) {
      expect(containsImpersonation(term)).toBe(true);
      expect(containsImpersonation(term.toUpperCase())).toBe(true);
      expect(isBlockedDisplayText(`${term}-Waffle-4821`)).toBe(true);
    }
  });

  it('does not flag ordinary handles', () => {
    expect(containsImpersonation('Sleepy-Waffle-4821')).toBe(false);
    expect(checkDisplayText('Sleepy-Waffle-4821')).toEqual({ blocked: false });
  });
});

describe('checkDisplayText', () => {
  it('reports reason', () => {
    expect(checkDisplayText('fuck')).toEqual({ blocked: true, reason: 'profanity' });
    expect(checkDisplayText('admin')).toEqual({ blocked: true, reason: 'impersonation' });
    expect(checkDisplayText('kinexus')).toEqual({ blocked: true, reason: 'impersonation' });
  });
});
