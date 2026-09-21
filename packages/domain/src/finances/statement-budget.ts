import { roundMoney } from '../stash/money';
import { DEFAULT_EXPENSE_LINES, DEFAULT_INCOME_LINES, monthLabel } from './budget';
import {
  merchantKey,
  statementMonths,
  type BankStatementFormat,
  type BankStatementImport,
  type BankStatementTxn,
} from './statement-import';
import type { FinanceBudgetLineKind } from './types';

export const AUTO_CATEGORY_CONFIDENCE = 0.8;
export const MAX_STATEMENT_QUESTIONS = 20;

export type StatementAssignment =
  | { ignore: true; kind?: never; name?: never }
  | { ignore?: false; kind: FinanceBudgetLineKind; name: string };

export type ClassifiedStatementTxn = BankStatementTxn & {
  confidence: number;
  reason: string;
  assignment: StatementAssignment | null;
};

export type StatementMerchantQuestion = {
  id: string;
  merchantKey: string;
  sample: string;
  count: number;
  total: number;
  kind: FinanceBudgetLineKind;
  suggestedName: string | null;
};

export type ProposedBudgetLine = {
  kind: FinanceBudgetLineKind;
  name: string;
  spent: number;
  total: number;
  count: number;
};

export type StatementBudgetDraft = {
  format: BankStatementFormat;
  monthCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  coverageDays: number;
  transactions: ClassifiedStatementTxn[];
  questions: StatementMerchantQuestion[];
  lines: ProposedBudgetLine[];
  autoCount: number;
  unsureCount: number;
  ignoredCount: number;
};

export type MerchantAnswer = {
  questionId: string;
  assignment: StatementAssignment;
};

export type AiMerchantGuess = {
  merchantKey: string;
  ignore?: boolean;
  kind?: FinanceBudgetLineKind;
  name?: string;
  confidence?: number;
};

export type BudgetCategoryOption = {
  kind: FinanceBudgetLineKind;
  name: string;
};

const IGNORE_PATTERNS = [
  /\b(opening|closing|brought forward|carried forward)\b.*\bbalance\b/,
  /\bbalance (brought|carried) forward\b/,
];

const TRANSFER_PATTERNS = [
  /\b(tfr|transfer|xfr)\b.+\b(saver|savings|offset|own|internal|netbank|commbank|ing|up home)\b/,
  /\b(internal transfer|own account|between accounts|transfer to .*saver)\b/,
];

type Rule = {
  kind: FinanceBudgetLineKind;
  name: string;
  pattern: RegExp;
  confidence: number;
  reason: string;
};

const RULES: Rule[] = [
  { kind: 'income', name: 'Salary', pattern: /\b(salary|wages|payroll|payg|employer)\b/, confidence: 0.92, reason: 'Looks like pay' },
  { kind: 'income', name: 'Other income', pattern: /\b(interest|dividend|refund|rebate|cashback|centrelink|family tax)\b/, confidence: 0.82, reason: 'Looks like other income' },
  { kind: 'expense', name: 'Housing', pattern: /\b(rent|landlord|mortgage|home loan|realestate|domain\.com|body corp|strata|council rates)\b/, confidence: 0.93, reason: 'Housing payment' },
  {
    kind: 'expense',
    name: 'Groceries',
    pattern: /\b(woolworths|woolies|coles|aldi|iga |iga$|foodworks|costco|harris farm|greengrocer|butcher|bakery)\b/,
    confidence: 0.95,
    reason: 'Supermarket',
  },
  {
    kind: 'expense',
    name: 'Transport',
    pattern:
      /\b(uber|didi|ola |transit|opal|myki|translink|citylink|linkt|petrol|fuel|bp |shell |caltex|ampol|7-eleven|7 eleven|parking|carpark|toll)\b/,
    confidence: 0.9,
    reason: 'Travel or fuel',
  },
  {
    kind: 'expense',
    name: 'Utilities',
    pattern: /\b(origin energy|agl |energyaustralia|synergy|ergon|telstra|optus|vodafone|belong |tpg |water corp|sydney water|electric|gas bill|internet)\b/,
    confidence: 0.92,
    reason: 'Bill or telco',
  },
  {
    kind: 'expense',
    name: 'Insurance',
    pattern: /\b(insurance|nrma|racq|racv|aami|allianz|youi|bupa|medibank|hcf |nib |ahm )\b/,
    confidence: 0.9,
    reason: 'Insurance',
  },
  {
    kind: 'expense',
    name: 'Healthcare',
    pattern: /\b(chemist warehouse|priceline|pharmacy|pathology|radiology|dental|dentist|physio|gp |medical|hospital|medicare)\b/,
    confidence: 0.88,
    reason: 'Health spend',
  },
  { kind: 'expense', name: 'Childcare', pattern: /\b(childcare|child care|goodstart|kindy|kindergarten|daycare|day care|oshc)\b/, confidence: 0.9, reason: 'Childcare' },
  {
    kind: 'expense',
    name: 'Subscriptions',
    pattern: /\b(netflix|spotify|disney|stan |prime video|apple\.com\/bill|google \*|youtube premium|adobe|icloud|microsoft|openai|chatgpt|anthropic|cursor)\b/,
    confidence: 0.94,
    reason: 'Subscription',
  },
  {
    kind: 'expense',
    name: 'Entertainment',
    pattern: /\b(event cinemas|hoyts|palace cinemas|steam |playstation|nintendo|ticketek|moshtix|pub |hotel |bar |tavern|restaurant|uber eats|doordash|menulog|deliveroo)\b/,
    confidence: 0.86,
    reason: 'Eating out or fun',
  },
  { kind: 'expense', name: 'Savings & Investments', pattern: /\b(term deposit|round.?up|savings goal|emergency fund|vanguard|etf|brokerage|shares?)\b/, confidence: 0.84, reason: 'Savings & Investments' },
];

export function budgetCategoryOptions(existing: readonly BudgetCategoryOption[] = []): BudgetCategoryOption[] {
  const seed: BudgetCategoryOption[] = [
    ...DEFAULT_INCOME_LINES.map((name) => ({ kind: 'income' as const, name })),
    ...DEFAULT_EXPENSE_LINES.map((name) => ({ kind: 'expense' as const, name })),
  ];
  const out: BudgetCategoryOption[] = [];
  const seen = new Set<string>();
  for (const item of [...existing, ...seed]) {
    const key = `${item.kind}:${item.name.trim().toLowerCase()}`;
    if (!item.name.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: item.kind, name: item.name.trim() });
  }
  return out;
}

export function draftBudgetFromStatement(
  parsed: BankStatementImport,
  options: { existingLines?: readonly BudgetCategoryOption[] } = {},
): StatementBudgetDraft {
  const existing = budgetCategoryOptions(options.existingLines);
  const classified = parsed.transactions.map((txn) => classifyTxn(txn, existing));
  return buildDraft(parsed.format, parsed.dateFrom, parsed.dateTo, classified, existing);
}

export function applyMerchantAnswers(draft: StatementBudgetDraft, answers: readonly MerchantAnswer[]): StatementBudgetDraft {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.assignment]));
  const classified = draft.transactions.map((txn) => {
    const questionId = questionIdFor(txn);
    const assignment = byId.get(questionId);
    if (!assignment) return txn;
    return {
      ...txn,
      assignment,
      confidence: 1,
      reason: assignment.ignore ? 'Ignored' : `Filed as ${assignment.name}`,
    };
  });
  return buildDraft(draft.format, draft.dateFrom, draft.dateTo, classified, linesAsOptions(draft.lines));
}

export function applyAiMerchantGuesses(
  draft: StatementBudgetDraft,
  guesses: readonly AiMerchantGuess[],
  threshold = AUTO_CATEGORY_CONFIDENCE,
): StatementBudgetDraft {
  const byKey = new Map(guesses.map((guess) => [normalizeKey(guess.merchantKey), guess]));
  const classified = draft.transactions.map((txn) => {
    if (txn.assignment) return txn;
    const guess = byKey.get(txn.merchantKey) ?? byKey.get(normalizeKey(txn.merchantKey));
    if (!guess) return txn;
    const confidence = clampConfidence(guess.confidence);
    if (guess.ignore && confidence >= threshold) {
      return { ...txn, assignment: { ignore: true } as const, confidence, reason: 'Marked as a transfer' };
    }
    const name = guess.name?.trim();
    if (!name || !guess.kind || confidence < threshold) {
      return {
        ...txn,
        confidence: Math.max(txn.confidence, confidence),
        reason: name ? `Maybe ${name}` : txn.reason,
      };
    }
    return {
      ...txn,
      assignment: { kind: guess.kind, name },
      confidence,
      reason: `Filed as ${name}`,
    };
  });
  return buildDraft(draft.format, draft.dateFrom, draft.dateTo, classified, linesAsOptions(draft.lines));
}

export function unsureMerchantsForAi(draft: StatementBudgetDraft, limit = 40): Array<{
  merchantKey: string;
  sample: string;
  count: number;
  total: number;
  kind: FinanceBudgetLineKind;
}> {
  return draft.questions.slice(0, limit).map((question) => ({
    merchantKey: question.merchantKey,
    sample: question.sample,
    count: question.count,
    total: question.total,
    kind: question.kind,
  }));
}

function buildDraft(
  format: BankStatementFormat,
  dateFrom: string | null,
  dateTo: string | null,
  classified: ClassifiedStatementTxn[],
  existing: readonly BudgetCategoryOption[],
): StatementBudgetDraft {
  const questions = questionsFrom(classified, existing);
  const assigned = classified.map((txn) => assignLeftovers(txn, questions));
  const months = statementMonths(assigned);
  const lines = linesFrom(assigned, months.length);
  const coverageDays = coverageDayCount(assigned.map((txn) => txn.date));
  return {
    format,
    monthCount: months.length,
    dateFrom: assigned[0]?.date ?? dateFrom,
    dateTo: assigned[assigned.length - 1]?.date ?? dateTo,
    coverageDays,
    transactions: assigned,
    questions,
    lines,
    autoCount: assigned.filter((txn) => txn.assignment && !txn.assignment.ignore && txn.confidence >= AUTO_CATEGORY_CONFIDENCE).length,
    unsureCount: questions.reduce((sum, question) => sum + question.count, 0),
    ignoredCount: assigned.filter((txn) => txn.assignment?.ignore).length,
  };
}

function classifyTxn(txn: BankStatementTxn, existing: readonly BudgetCategoryOption[]): ClassifiedStatementTxn {
  const haystack = `${txn.merchantKey} ${txn.description}`.toLowerCase();
  if (IGNORE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { ...txn, confidence: 1, reason: 'Balance line', assignment: { ignore: true } };
  }
  if (TRANSFER_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { ...txn, confidence: 0.7, reason: 'Looks like a transfer', assignment: null };
  }
  const kind: FinanceBudgetLineKind = txn.amount >= 0 ? 'income' : 'expense';
  const fallback = kind === 'income' ? 'Other income' : 'Other';
  for (const rule of RULES) {
    if (rule.kind !== kind) continue;
    if (!rule.pattern.test(haystack)) continue;
    const name = resolveCategoryName(rule.name, kind, existing);
    return {
      ...txn,
      confidence: rule.confidence,
      reason: rule.reason,
      assignment: rule.confidence >= AUTO_CATEGORY_CONFIDENCE ? { kind, name } : null,
    };
  }
  return {
    ...txn,
    confidence: 0.2,
    reason: 'Unknown merchant',
    assignment: null,
  };
}

function questionsFrom(
  classified: readonly ClassifiedStatementTxn[],
  existing: readonly BudgetCategoryOption[],
): StatementMerchantQuestion[] {
  const groups = new Map<
    string,
    { sample: string; count: number; total: number; kind: FinanceBudgetLineKind; suggestedName: string | null }
  >();
  for (const txn of classified) {
    if (txn.assignment) continue;
    const kind: FinanceBudgetLineKind = txn.amount >= 0 ? 'income' : 'expense';
    const current = groups.get(txn.merchantKey) ?? {
      sample: txn.description,
      count: 0,
      total: 0,
      kind,
      suggestedName: suggestedNameFor(txn, kind, existing),
    };
    current.count += 1;
    current.total = roundMoney(current.total + Math.abs(txn.amount));
    groups.set(txn.merchantKey, current);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      id: questionIdFor({ merchantKey: key, amount: group.kind === 'income' ? 1 : -1 }),
      merchantKey: key,
      ...group,
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, MAX_STATEMENT_QUESTIONS);
}

function assignLeftovers(
  txn: ClassifiedStatementTxn,
  questions: readonly StatementMerchantQuestion[],
): ClassifiedStatementTxn {
  if (txn.assignment) return txn;
  const asked = new Set(questions.map((question) => question.merchantKey));
  if (asked.has(txn.merchantKey)) return txn;
  const kind: FinanceBudgetLineKind = txn.amount >= 0 ? 'income' : 'expense';
  return {
    ...txn,
    assignment: { kind, name: kind === 'income' ? 'Other income' : 'Other' },
    confidence: 0.4,
    reason: 'Small leftover filed as Other',
  };
}

export function txnsForProposedLine(
  transactions: readonly ClassifiedStatementTxn[],
  line: Pick<ProposedBudgetLine, 'kind' | 'name'>,
): ClassifiedStatementTxn[] {
  const name = line.name.trim().toLowerCase();
  return transactions
    .filter((txn) => {
      const assignment = txn.assignment;
      return Boolean(
        assignment &&
          !assignment.ignore &&
          assignment.kind === line.kind &&
          assignment.name.trim().toLowerCase() === name,
      );
    })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.amount) - Math.abs(a.amount));
}

export type ProposedLineMerchant = {
  merchantKey: string;
  sample: string;
  count: number;
  total: number;
  transactions: ClassifiedStatementTxn[];
};

export function merchantsForProposedLine(
  transactions: readonly ClassifiedStatementTxn[],
  line: Pick<ProposedBudgetLine, 'kind' | 'name'>,
): ProposedLineMerchant[] {
  const groups = new Map<string, ProposedLineMerchant>();
  for (const txn of txnsForProposedLine(transactions, line)) {
    const current = groups.get(txn.merchantKey) ?? {
      merchantKey: txn.merchantKey,
      sample: txn.description,
      count: 0,
      total: 0,
      transactions: [],
    };
    current.count += 1;
    current.total = roundMoney(current.total + Math.abs(txn.amount));
    current.transactions.push(txn);
    groups.set(txn.merchantKey, current);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.merchantKey.localeCompare(b.merchantKey));
}

function linesFrom(classified: readonly ClassifiedStatementTxn[], monthCount: number): ProposedBudgetLine[] {
  const divisor = Math.max(1, monthCount);
  const map = new Map<string, ProposedBudgetLine>();
  for (const txn of classified) {
    if (!txn.assignment || txn.assignment.ignore) continue;
    const key = `${txn.assignment.kind}:${txn.assignment.name.toLowerCase()}`;
    const current = map.get(key) ?? {
      kind: txn.assignment.kind,
      name: txn.assignment.name,
      spent: 0,
      total: 0,
      count: 0,
    };
    current.total = roundMoney(current.total + Math.abs(txn.amount));
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()]
    .map((line) => ({ ...line, spent: roundMoney(line.total / divisor) }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'income' ? -1 : 1;
      return b.spent - a.spent || a.name.localeCompare(b.name);
    });
}

function suggestedNameFor(
  txn: ClassifiedStatementTxn,
  kind: FinanceBudgetLineKind,
  existing: readonly BudgetCategoryOption[],
): string | null {
  const haystack = `${txn.merchantKey} ${txn.description}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.kind !== kind) continue;
    if (rule.pattern.test(haystack)) return resolveCategoryName(rule.name, kind, existing);
  }
  return null;
}

function resolveCategoryName(wanted: string, kind: FinanceBudgetLineKind, existing: readonly BudgetCategoryOption[]): string {
  const match = existing.find((item) => item.kind === kind && item.name.trim().toLowerCase() === wanted.toLowerCase());
  return match?.name ?? wanted;
}

function linesAsOptions(lines: readonly ProposedBudgetLine[]): BudgetCategoryOption[] {
  return budgetCategoryOptions(lines.map((line) => ({ kind: line.kind, name: line.name })));
}

function questionIdFor(txn: Pick<BankStatementTxn, 'merchantKey' | 'amount'>): string {
  return `${txn.amount >= 0 ? 'in' : 'out'}:${txn.merchantKey}`;
}

function coverageDayCount(dates: readonly string[]): number {
  return new Set(dates).size;
}

function clampConfidence(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function normalizeKey(value: string): string {
  return merchantKey(value);
}

export function statementCoverageHint(draft: StatementBudgetDraft): string | null {
  if (draft.monthCount <= 1) {
    return 'This file covers one month. A 12-month export usually gives a more stable average.';
  }
  if (draft.monthCount < 12) {
    return `This file covers ${draft.monthCount} months. A full year usually gives a more stable average.`;
  }
  return null;
}

export function statementRangeLabel(draft: Pick<StatementBudgetDraft, 'monthCount' | 'dateFrom' | 'dateTo'>): string {
  const count = `${draft.monthCount} month${draft.monthCount === 1 ? '' : 's'}`;
  if (!draft.dateFrom || !draft.dateTo) return count;
  const from = monthLabel(`${draft.dateFrom.slice(0, 7)}-01`);
  const to = monthLabel(`${draft.dateTo.slice(0, 7)}-01`);
  if (from === to) return `${count} (${from})`;
  return `${count} (${from} – ${to})`;
}

export function emptyStatementDraft(): StatementBudgetDraft {
  return {
    format: 'text',
    monthCount: 0,
    dateFrom: null,
    dateTo: null,
    coverageDays: 0,
    transactions: [],
    questions: [],
    lines: [],
    autoCount: 0,
    unsureCount: 0,
    ignoredCount: 0,
  };
}
