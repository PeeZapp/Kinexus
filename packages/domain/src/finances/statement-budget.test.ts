import { describe, expect, it } from 'vitest';

import {
  applyAiMerchantGuesses,
  applyMerchantAnswers,
  draftBudgetFromStatement,
  merchantsForProposedLine,
  statementCoverageHint,
  statementRangeLabel,
  txnsForProposedLine,
  unsureMerchantsForAi,
} from './statement-budget';
import { parseBankStatement } from './statement-import';

const STATEMENT = `Date,Narration,Debit,Credit,Balance
01/08/2026,WOOLWORTHS 3123,120.00,,
02/08/2026,WOOLWORTHS METRO,40.00,,
03/08/2026,NETFLIX.COM,16.99,,
04/08/2026,MYSTERY CAFE SURRY HILLS,48.00,,
05/08/2026,ZZZ ODD SHOP,9.50,,
06/08/2026,ACME PAYROLL,,5000.00,
07/08/2026,Transfer to NetBank Saver,300.00,,
`;

const YEAR = `Date,Narration,Debit,Credit,Balance
01/01/2026,WOOLWORTHS 3123,120.00,,
01/02/2026,WOOLWORTHS 3123,180.00,,
01/03/2026,WOOLWORTHS 3123,150.00,,
01/04/2026,WOOLWORTHS 3123,90.00,,
01/05/2026,WOOLWORTHS 3123,210.00,,
01/06/2026,WOOLWORTHS 3123,160.00,,
01/07/2026,WOOLWORTHS 3123,140.00,,
01/08/2026,WOOLWORTHS 3123,170.00,,
01/09/2026,WOOLWORTHS 3123,130.00,,
01/10/2026,WOOLWORTHS 3123,190.00,,
01/11/2026,WOOLWORTHS 3123,110.00,,
01/12/2026,WOOLWORTHS 3123,200.00,,
15/01/2026,NETFLIX.COM,16.99,,
15/02/2026,NETFLIX.COM,16.99,,
15/03/2026,NETFLIX.COM,16.99,,
15/04/2026,NETFLIX.COM,16.99,,
15/05/2026,NETFLIX.COM,16.99,,
15/06/2026,NETFLIX.COM,16.99,,
15/07/2026,NETFLIX.COM,16.99,,
15/08/2026,NETFLIX.COM,16.99,,
15/09/2026,NETFLIX.COM,16.99,,
15/10/2026,NETFLIX.COM,16.99,,
15/11/2026,NETFLIX.COM,16.99,,
15/12/2026,NETFLIX.COM,16.99,,
`;

describe('statement budget draft', () => {
  it('auto-files known merchants and asks about the rest', () => {
    const draft = draftBudgetFromStatement(parseBankStatement(STATEMENT));
    expect(draft.monthCount).toBe(1);
    expect(draft.autoCount).toBeGreaterThanOrEqual(4);
    const groceries = draft.lines.find((line) => line.name === 'Groceries');
    expect(groceries?.spent).toBe(160);
    expect(groceries?.total).toBe(160);
    expect(draft.lines.find((line) => line.name === 'Subscriptions')?.spent).toBe(16.99);
    expect(draft.lines.find((line) => line.name === 'Salary')?.spent).toBe(5000);
    expect(draft.questions.some((question) => question.merchantKey.includes('MYSTERY'))).toBe(true);
    expect(draft.questions.some((question) => /SAVER|TRANSFER/.test(question.merchantKey))).toBe(true);
  });

  it('averages category totals across every month in the file', () => {
    const draft = draftBudgetFromStatement(parseBankStatement(YEAR));
    expect(draft.monthCount).toBe(12);
    expect(statementCoverageHint(draft)).toBeNull();
    expect(statementRangeLabel(draft)).toContain('12 months');
    const groceries = draft.lines.find((line) => line.name === 'Groceries');
    expect(groceries?.total).toBe(1850);
    expect(groceries?.spent).toBeCloseTo(1850 / 12);
    expect(groceries?.count).toBe(12);
    expect(draft.lines.find((line) => line.name === 'Subscriptions')?.spent).toBeCloseTo(16.99);
    const groceryTxns = txnsForProposedLine(draft.transactions, groceries!);
    expect(groceryTxns).toHaveLength(12);
    expect(groceryTxns[0]?.description).toContain('WOOLWORTHS');
    expect(merchantsForProposedLine(draft.transactions, groceries!).map((item) => item.merchantKey)).toEqual([
      'WOOLWORTHS',
    ]);
  });

  it('applies answers and ignores transfers', () => {
    const start = draftBudgetFromStatement(parseBankStatement(STATEMENT));
    const cafe = start.questions.find((question) => question.merchantKey.includes('MYSTERY'));
    const transfer = start.questions.find((question) => /SAVER|TRANSFER/.test(question.merchantKey));
    expect(cafe && transfer).toBeTruthy();
    const next = applyMerchantAnswers(start, [
      { questionId: cafe!.id, assignment: { kind: 'expense', name: 'Entertainment' } },
      { questionId: transfer!.id, assignment: { ignore: true } },
    ]);
    expect(next.lines.find((line) => line.name === 'Entertainment')?.spent).toBe(48);
    expect(txnsForProposedLine(next.transactions, { kind: 'expense', name: 'Entertainment' }).map((txn) => txn.description)).toEqual([
      'MYSTERY CAFE SURRY HILLS',
    ]);
    expect(next.ignoredCount).toBeGreaterThanOrEqual(1);
    expect(next.questions.some((question) => question.id === cafe!.id)).toBe(false);
  });

  it('promotes confident AI guesses and leaves weak ones as questions', () => {
    const start = draftBudgetFromStatement(parseBankStatement(STATEMENT));
    const unsure = unsureMerchantsForAi(start);
    expect(unsure.length).toBeGreaterThan(0);
    const cafe = unsure.find((item) => item.merchantKey.includes('MYSTERY'));
    const next = applyAiMerchantGuesses(start, [
      { merchantKey: cafe?.merchantKey ?? 'MYSTERY CAFE', kind: 'expense', name: 'Entertainment', confidence: 0.91 },
      { merchantKey: 'ZZZ ODD SHOP', kind: 'expense', name: 'Other', confidence: 0.4 },
    ]);
    expect(next.lines.find((line) => line.name === 'Entertainment')?.spent).toBe(48);
    expect(next.questions.some((question) => question.merchantKey.includes('ODD'))).toBe(true);
  });
});
