import { describe, expect, it } from 'vitest';

import { defaultsForRegion, kgToLb, lbToKg, roundWeight } from './units';

describe('weight conversion', () => {
  it('rounds kg to 0.5 and lb to 1', () => {
    expect(roundWeight(60.24, 0.5)).toBe(60);
    expect(roundWeight(60.26, 0.5)).toBe(60.5);
    expect(roundWeight(132.4, 1)).toBe(132);
    expect(roundWeight(132.5, 1)).toBe(133);
  });

  it('converts kg ↔ lb with those steps', () => {
    expect(kgToLb(100)).toBe(220);
    expect(lbToKg(225)).toBe(102);
    expect(lbToKg(kgToLb(60))).toBe(60);
  });
});

describe('locale unit defaults', () => {
  it('defaults AU to kg + metric', () => {
    expect(defaultsForRegion('AU')).toEqual({ weightUnit: 'kg', measurementSystem: 'metric' });
  });

  it('defaults US to lb + imperial', () => {
    expect(defaultsForRegion('US')).toEqual({ weightUnit: 'lb', measurementSystem: 'imperial' });
  });

  it('treats Liberia and Myanmar as imperial', () => {
    expect(defaultsForRegion('LR').weightUnit).toBe('lb');
    expect(defaultsForRegion('MM').measurementSystem).toBe('imperial');
  });
});
