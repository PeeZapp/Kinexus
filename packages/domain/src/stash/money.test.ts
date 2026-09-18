import { describe, expect, it } from 'vitest';

import { evalMoneyExpression, formatMoney, isSale, parseMoney } from './money';

describe('stash money', () => {
  it('parses messy price strings', () => {
    expect(parseMoney('$12.50')).toBe(12.5);
    expect(parseMoney('1,299.00')).toBe(1299);
    expect(parseMoney('19,95')).toBe(19.95);
    expect(parseMoney('nope')).toBeNull();
  });

  it('adds a simple amount expression', () => {
    expect(evalMoneyExpression('50+30')).toBe(80);
    expect(evalMoneyExpression('50 + 30')).toBe(80);
    expect(evalMoneyExpression('12.50+7.50')).toBe(20);
    expect(evalMoneyExpression('100-20')).toBe(80);
    expect(evalMoneyExpression('10*4')).toBe(40);
    expect(evalMoneyExpression('90/3')).toBe(30);
    expect(evalMoneyExpression('(10+5)*2')).toBe(30);
    expect(evalMoneyExpression('50+')).toBeNull();
    expect(evalMoneyExpression('10/0')).toBeNull();
    expect(evalMoneyExpression('80')).toBe(80);
  });

  it('formats and detects sales', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(10, 'AUD')).toMatch(/10/);
    expect(isSale(8, 10)).toBe(true);
    expect(isSale(10, 8)).toBe(false);
  });
});
