import { AUTO_CATEGORY_CONFIDENCE } from './statement-budget';
import type { StatementAssignment } from './statement-budget';
import type { FinanceBudgetLine, FinanceBudgetTxn } from './types';

export type ReviewTxnInput = {
  date: string;
  description: string;
  amount: number;
  merchantKey: string;
  pending?: boolean;
};

export type ReviewPrefill =
  | { source: 'none' }
  | { source: 'remembered'; lineId: string }
  | { source: 'ai'; assignment: StatementAssignment; confidence: number }
  | { source: 'ignore' };

export type ReviewTxnRow = ReviewTxnInput & {
  id: string;
  selected: boolean;
  alreadyAdded: boolean;
  prefill: ReviewPrefill;
  assignment: StatementAssignment | null;
};

export type AiMerchantPrefill = {
  merchantKey: string;
  confidence?: number;
  ignore?: boolean;
  kind?: FinanceBudgetLine['kind'];
  name?: string;
};

export type BuildTxnReviewInput = {
  incoming: readonly ReviewTxnInput[];
  existing: readonly Pick<FinanceBudgetTxn, 'date' | 'amount' | 'merchantKey' | 'lineId' | 'ignored'>[];
  lines: readonly Pick<FinanceBudgetLine, 'id' | 'kind' | 'name'>[];
  aiGuesses?: readonly AiMerchantPrefill[];
};

function dayOffset(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function batchKey(txn: Pick<ReviewTxnInput, 'date' | 'amount' | 'description'>): string {
  return `${txn.date}|${txn.amount}|${txn.description.trim().toLowerCase()}`;
}

/** Collapse exact duplicates within one import batch (same date + amount + description). */
export function collapseBatchDuplicates<T extends ReviewTxnInput>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = batchKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Match an incoming row to an existing budget txn: same amount + merchantKey, date within ±1 day. */
export function matchesExistingTxn(
  incoming: Pick<ReviewTxnInput, 'date' | 'amount' | 'merchantKey'>,
  existing: Pick<FinanceBudgetTxn, 'date' | 'amount' | 'merchantKey'>,
): boolean {
  if (incoming.amount !== existing.amount) return false;
  if (incoming.merchantKey !== existing.merchantKey) return false;
  if (incoming.date === existing.date) return true;
  return incoming.date === dayOffset(existing.date, -1) || incoming.date === dayOffset(existing.date, 1);
}

export function findRememberedLineId(
  merchantKey: string,
  existing: readonly Pick<FinanceBudgetTxn, 'date' | 'merchantKey' | 'lineId' | 'ignored'>[],
): string | null {
  let best: { date: string; lineId: string } | null = null;
  for (const txn of existing) {
    if (txn.ignored || !txn.lineId) continue;
    if (txn.merchantKey !== merchantKey) continue;
    if (!best || txn.date > best.date) best = { date: txn.date, lineId: txn.lineId };
  }
  return best?.lineId ?? null;
}

export function chooseTxnPrefill(input: {
  merchantKey: string;
  existing: readonly Pick<FinanceBudgetTxn, 'date' | 'merchantKey' | 'lineId' | 'ignored'>[];
  lines: readonly Pick<FinanceBudgetLine, 'id' | 'kind' | 'name'>[];
  aiGuess?: AiMerchantPrefill | null;
}): { prefill: ReviewPrefill; assignment: StatementAssignment | null } {
  const rememberedId = findRememberedLineId(input.merchantKey, input.existing);
  if (rememberedId) {
    const line = input.lines.find((item) => item.id === rememberedId);
    if (line) {
      return {
        prefill: { source: 'remembered', lineId: line.id },
        assignment: { kind: line.kind, name: line.name },
      };
    }
  }

  const guess = input.aiGuess;
  const confidence = typeof guess?.confidence === 'number' ? guess.confidence : 0;
  if (guess && confidence >= AUTO_CATEGORY_CONFIDENCE) {
    if (guess.ignore) {
      return { prefill: { source: 'ignore' }, assignment: { ignore: true } };
    }
    if (guess.kind && guess.name?.trim()) {
      const assignment = { kind: guess.kind, name: guess.name.trim() } as const;
      return {
        prefill: { source: 'ai', assignment, confidence },
        assignment,
      };
    }
  }

  return { prefill: { source: 'none' }, assignment: null };
}

export function buildTxnReview(input: BuildTxnReviewInput): {
  rows: ReviewTxnRow[];
  alreadyAddedCount: number;
} {
  const unique = collapseBatchDuplicates(input.incoming);
  const guessByMerchant = new Map<string, AiMerchantPrefill>();
  for (const guess of input.aiGuesses ?? []) {
    if (!guess.merchantKey) continue;
    guessByMerchant.set(guess.merchantKey, guess);
  }

  const rows: ReviewTxnRow[] = [];
  let alreadyAddedCount = 0;
  let index = 0;

  for (const txn of unique) {
    const alreadyAdded = input.existing.some((existing) => matchesExistingTxn(txn, existing));
    if (alreadyAdded) alreadyAddedCount += 1;
    const { prefill, assignment } = chooseTxnPrefill({
      merchantKey: txn.merchantKey,
      existing: input.existing,
      lines: input.lines,
      aiGuess: guessByMerchant.get(txn.merchantKey) ?? null,
    });
    const pending = Boolean(txn.pending);
    rows.push({
      ...txn,
      id: `review-${index++}`,
      alreadyAdded,
      selected: !alreadyAdded && !pending,
      prefill,
      assignment: alreadyAdded ? null : assignment,
    });
  }

  return { rows, alreadyAddedCount };
}

export function groupReviewRowsByDate(rows: readonly ReviewTxnRow[]): Array<{ date: string; rows: ReviewTxnRow[] }> {
  const order: string[] = [];
  const map = new Map<string, ReviewTxnRow[]>();
  for (const row of rows) {
    if (!map.has(row.date)) {
      order.push(row.date);
      map.set(row.date, []);
    }
    map.get(row.date)!.push(row);
  }
  order.sort((a, b) => b.localeCompare(a));
  return order.map((date) => ({ date, rows: map.get(date)! }));
}
