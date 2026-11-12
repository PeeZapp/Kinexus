import { describe, expect, it } from 'vitest';

import {
  buildTxnReview,
  chooseTxnPrefill,
  collapseBatchDuplicates,
  matchesExistingTxn,
} from './txn-review';

const line = { id: 'groceries', kind: 'expense' as const, name: 'Groceries' };

describe('collapseBatchDuplicates', () => {
  it('collapses overlapping screenshot rows', () => {
    const rows = collapseBatchDuplicates([
      { date: '2026-11-10', description: 'COLES', amount: -42.5, merchantKey: 'COLES' },
      { date: '2026-11-10', description: 'COLES', amount: -42.5, merchantKey: 'COLES' },
      { date: '2026-11-09', description: 'COLES', amount: -12, merchantKey: 'COLES' },
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe('matchesExistingTxn', () => {
  it('matches same amount + merchant within ±1 day', () => {
    const incoming = { date: '2026-11-10', amount: -20, merchantKey: 'UBER' };
    expect(
      matchesExistingTxn(incoming, { date: '2026-11-10', amount: -20, merchantKey: 'UBER' }),
    ).toBe(true);
    expect(
      matchesExistingTxn(incoming, { date: '2026-11-09', amount: -20, merchantKey: 'UBER' }),
    ).toBe(true);
    expect(
      matchesExistingTxn(incoming, { date: '2026-11-11', amount: -20, merchantKey: 'UBER' }),
    ).toBe(true);
    expect(
      matchesExistingTxn(incoming, { date: '2026-11-08', amount: -20, merchantKey: 'UBER' }),
    ).toBe(false);
    expect(
      matchesExistingTxn(incoming, { date: '2026-11-10', amount: -21, merchantKey: 'UBER' }),
    ).toBe(false);
  });
});

describe('chooseTxnPrefill', () => {
  it('prefers remembered merchant rule over AI', () => {
    const result = chooseTxnPrefill({
      merchantKey: 'COLES',
      existing: [
        {
          date: '2026-10-01',
          merchantKey: 'COLES',
          lineId: 'groceries',
          ignored: false,
        },
      ],
      lines: [line],
      aiGuess: { merchantKey: 'COLES', kind: 'expense', name: 'Other', confidence: 0.99 },
    });
    expect(result.prefill).toEqual({ source: 'remembered', lineId: 'groceries' });
    expect(result.assignment).toEqual({ kind: 'expense', name: 'Groceries' });
  });

  it('uses AI guess at confidence threshold', () => {
    const result = chooseTxnPrefill({
      merchantKey: 'NEW CAFE',
      existing: [],
      lines: [line],
      aiGuess: { merchantKey: 'NEW CAFE', kind: 'expense', name: 'Groceries', confidence: 0.8 },
    });
    expect(result.prefill.source).toBe('ai');
    expect(result.assignment).toEqual({ kind: 'expense', name: 'Groceries' });
  });

  it('ignores low-confidence AI', () => {
    const result = chooseTxnPrefill({
      merchantKey: 'NEW CAFE',
      existing: [],
      lines: [line],
      aiGuess: { merchantKey: 'NEW CAFE', kind: 'expense', name: 'Groceries', confidence: 0.79 },
    });
    expect(result.prefill).toEqual({ source: 'none' });
    expect(result.assignment).toBeNull();
  });
});

describe('buildTxnReview', () => {
  it('marks pending unticked and hides already-added under count', () => {
    const { rows, alreadyAddedCount } = buildTxnReview({
      incoming: [
        { date: '2026-11-10', description: 'COLES', amount: -55, merchantKey: 'COLES' },
        { date: '2026-11-10', description: 'Pending Uber', amount: -18, merchantKey: 'PENDING UBER', pending: true },
        { date: '2026-11-09', description: 'COLES', amount: -40, merchantKey: 'COLES' },
      ],
      existing: [
        {
          date: '2026-11-10',
          amount: -40,
          merchantKey: 'COLES',
          lineId: 'groceries',
          ignored: false,
        },
      ],
      lines: [line],
    });
    expect(alreadyAddedCount).toBe(1);
    const fresh = rows.find((row) => row.amount === -55);
    const pending = rows.find((row) => row.pending);
    const duplicate = rows.find((row) => row.alreadyAdded);
    expect(fresh?.selected).toBe(true);
    expect(pending?.selected).toBe(false);
    expect(duplicate?.selected).toBe(false);
  });

  it('saves ignore assignment via prefill', () => {
    const { rows } = buildTxnReview({
      incoming: [{ date: '2026-11-10', description: 'Transfer', amount: -100, merchantKey: 'TRANSFER' }],
      existing: [],
      lines: [line],
      aiGuesses: [{ merchantKey: 'TRANSFER', ignore: true, confidence: 0.95 }],
    });
    expect(rows[0]?.assignment).toEqual({ ignore: true });
    expect(rows[0]?.prefill.source).toBe('ignore');
  });
});
