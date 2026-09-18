import { describe, expect, it } from 'vitest';

import { parseShareImport } from './share-import';

describe('share import', () => {
  it('parses a CommSec-style holdings CSV', () => {
    const result = parseShareImport(`
Code,Name,Quantity,Average Price ($),Last Price,Market Value ($)
CBA,COMMONWEALTH BANK OF AUSTRALIA,100.00,95.20,125.40,12540.00
BHP.AX,BHP GROUP LIMITED,40,40.00,45.10,1804.00
AUD,Cash,1200,1,1,1200
`);
    expect(result.format).toBe('csv');
    expect(result.holdings.map((row) => row.symbol)).toEqual(['BHP', 'CBA']);
    expect(result.holdings.find((row) => row.symbol === 'CBA')).toMatchObject({
      units: 100,
      costPerUnit: 95.2,
      lastPrice: 125.4,
    });
  });

  it('parses a pasted CHESS holding statement and HIN', () => {
    const result = parseShareImport(`
CHESS HOLDING STATEMENT
HIN X0001234567
Security Code  CBA
Security Description  COMMONWEALTH BANK OF AUSTRALIA
Unit Balance  150
Security Code  VAS
Security Description  VANGUARD AUSTRALIAN SHARES INDEX ETF
Unit Balance  80
`);
    expect(result.format).toBe('chess');
    expect(result.holderId).toBe('X0001234567');
    expect(result.holderKind).toBe('hin');
    expect(result.holdings).toEqual([
      expect.objectContaining({ symbol: 'CBA', units: 150, name: expect.stringContaining('COMMONWEALTH') }),
      expect.objectContaining({ symbol: 'VAS', units: 80 }),
    ]);
  });

  it('merges duplicate codes and reads symbol,units,cost lines', () => {
    const result = parseShareImport(`CBA,50,90\nCBA,50,110\nVAS\t20\t98.5`);
    const cba = result.holdings.find((row) => row.symbol === 'CBA');
    expect(cba?.units).toBe(100);
    expect(cba?.costPerUnit).toBe(100);
    expect(result.holdings.find((row) => row.symbol === 'VAS')?.units).toBe(20);
  });
});
