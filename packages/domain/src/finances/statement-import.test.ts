import { describe, expect, it } from 'vitest';

import { parseBankStatement, parseStatementDate, merchantKey, statementMonths } from './statement-import';

const CBA = `Date,Narration,Debit,Credit,Balance
01/08/2026,WOOLWORTHS 3123,86.40,,1200.00
02/08/2026,NETFLIX.COM,16.99,,1183.01
03/08/2026,ACME PAYROLL,,4200.00,5383.01
04/08/2026,Transfer to NetBank Saver,200.00,,5183.01
`;

const ANZ = `Date,Amount,Description
15/08/2026,-54.20,COLES 4412
16/08/2026,120.00,ATO REFUND
`;

const OFX = `OFXHEADER:100
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260818
<TRNAMT>-62.10
<NAME>UBER TRIP
<MEMO>SYDNEY
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260820
<TRNAMT>80.00
<NAME>INTEREST
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

describe('parseBankStatement', () => {
  it('reads a CommBank-style debit/credit CSV', () => {
    const result = parseBankStatement(CBA);
    expect(result.format).toBe('csv');
    expect(result.transactions).toHaveLength(4);
    expect(result.dateFrom).toBe('2026-08-01');
    expect(result.dateTo).toBe('2026-08-04');
    expect(result.transactions[0]).toMatchObject({ description: 'WOOLWORTHS 3123', amount: -86.4 });
    expect(result.transactions.find((txn) => txn.description.includes('PAYROLL'))?.amount).toBe(4200);
  });

  it('reads a signed-amount CSV', () => {
    const result = parseBankStatement(ANZ);
    expect(result.transactions.map((txn) => [txn.description, txn.amount])).toEqual([
      ['COLES 4412', -54.2],
      ['ATO REFUND', 120],
    ]);
  });

  it('reads OFX statement transactions', () => {
    const result = parseBankStatement(OFX);
    expect(result.format).toBe('ofx');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({ amount: -62.1 });
    expect(result.transactions[0]?.merchantKey).toContain('UBER');
    expect(result.transactions[1]?.amount).toBe(80);
  });

  it('reads QIF and pasted text lines', () => {
    const qif = parseBankStatement(`!Type:Bank
D08/08/2026
T-22.50
PSPOTIFY P123
^
`);
    expect(qif.format).toBe('qif');
    expect(qif.transactions[0]).toMatchObject({ description: 'SPOTIFY P123', amount: -22.5 });

    const pasted = parseBankStatement('12/08/2026  BP CONNECT MELBOURNE   73.40 DR');
    expect(pasted.transactions[0]).toMatchObject({ amount: -73.4 });
    expect(pasted.transactions[0]?.description).toMatch(/BP CONNECT/);
  });

  it('parses Australian dates and groups merchants', () => {
    expect(parseStatementDate('7/9/2026')).toBe('2026-09-07');
    expect(parseStatementDate('20260815')).toBe('2026-08-15');
    expect(merchantKey('EFTPOS WOOLWORTHS 3123')).toBe('WOOLWORTHS');
  });

  it('lists distinct months in a multi-month file', () => {
    const result = parseBankStatement(`Date,Narration,Debit,Credit
01/01/2026,WOOLWORTHS,10.00,,
15/12/2026,WOOLWORTHS,20.00,,
`);
    expect(statementMonths(result.transactions)).toEqual(['2026-01-01', '2026-12-01']);
  });
});
