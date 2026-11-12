import { describe, expect, it } from 'vitest';

import { normaliseRepsTarget } from '@/src/features/train/normalise-reps-target';

describe('normaliseRepsTarget', () => {
  it('trims and keeps simple values', () => {
    expect(normaliseRepsTarget('  10  ')).toBe('10');
    expect(normaliseRepsTarget('AMRAP')).toBe('AMRAP');
    expect(normaliseRepsTarget('10-12')).toBe('10-12');
  });

  it('turns en/em dashes and "to" into hyphen ranges', () => {
    expect(normaliseRepsTarget('10 – 12')).toBe('10-12');
    expect(normaliseRepsTarget('8—10')).toBe('8-10');
    expect(normaliseRepsTarget('8 to 10')).toBe('8-10');
    expect(normaliseRepsTarget('8 TO 10')).toBe('8-10');
  });

  it('caps at 40 characters', () => {
    const long = '1234567890'.repeat(5);
    expect(normaliseRepsTarget(long).length).toBe(40);
  });
});
