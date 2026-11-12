import { merchantKey, redactBankDescription, roundMoney } from '@kinexus/domain';

import { parseJsonObject } from '../recipe-draft.js';
import type { AiImageInput } from './provider.js';
import { completeResolved, type ResolvedAiClient } from './resolve.js';
import type { AiDraftResult } from './extract.js';

export type BankScreenshotTxn = {
  date: string;
  description: string;
  amount: number;
  pending: boolean;
  merchantKey: string;
};

export type BankScreenshotReadResult = {
  transactions: BankScreenshotTxn[];
  skipped: number;
};

const MAX_LOOKBACK_DAYS = 120;
const BALANCE_LINE =
  /\b(opening|closing|available|current|running)?\s*balance\b|\btotal\b|\bbrought forward\b|\bcarried forward\b/i;

function isoToday(localDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return localDate;
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function resolveRelativeDate(raw: string, localDate: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const today = isoToday(localDate);
  const lower = value.toLowerCase();
  if (lower === 'today') return today;
  if (lower === 'yesterday') return addDays(today, -1);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{2,4}))?$/);
  if (named) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.findIndex((item) => (named[2] ?? '').toLowerCase().startsWith(item));
    if (month < 0) return null;
    const yearRaw = named[3] ? Number(named[3]) : Number(today.slice(0, 4));
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const day = Number(named[1]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const yearRaw = dmy[3] ? Number(dmy[3]) : Number(today.slice(0, 4));
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidBankScreenshotTxn(
  txn: Pick<BankScreenshotTxn, 'date' | 'description' | 'amount'>,
  localDate: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) return false;
  if (txn.date > isoToday(localDate)) return false;
  if (txn.date < addDays(isoToday(localDate), -MAX_LOOKBACK_DAYS)) return false;
  if (!Number.isFinite(txn.amount) || txn.amount === 0) return false;
  const description = txn.description.trim();
  if (!description) return false;
  if (BALANCE_LINE.test(description)) return false;
  return true;
}

export function normalizeBankScreenshotRows(
  raw: unknown,
  localDate: string,
): BankScreenshotReadResult {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { transactions?: unknown }).transactions)
      ? ((raw as { transactions: unknown[] }).transactions)
      : [];
  const transactions: BankScreenshotTxn[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      skipped += 1;
      continue;
    }
    const rec = row as Record<string, unknown>;
    const date = resolveRelativeDate(String(rec.date ?? ''), localDate);
    const description = redactBankDescription(String(rec.description ?? '').replace(/\s+/g, ' ').trim());
    const amountRaw = Number(rec.amount);
    const amount = Number.isFinite(amountRaw) ? roundMoney(amountRaw) : 0;
    const pending = Boolean(rec.pending);
    if (!date || !isValidBankScreenshotTxn({ date, description, amount }, localDate)) {
      skipped += 1;
      continue;
    }
    transactions.push({
      date,
      description,
      amount,
      pending,
      merchantKey: merchantKey(description),
    });
  }
  return { transactions, skipped };
}

export async function readBankScreenshotsWithAi(
  resolved: ResolvedAiClient,
  images: AiImageInput[],
  localDate: string,
): Promise<AiDraftResult<BankScreenshotReadResult>> {
  const out = await completeResolved(resolved, {
    json: true,
    images,
    prompt: `You read Australian bank-app transaction screenshots.

The user's local date is ${isoToday(localDate)}. Use it to resolve "Today", "Yesterday", and missing years.

Extract only visible posted or pending transactions. Never invent rows.
Money out is negative. Money in is positive.
Skip balance, available funds, totals, and summary lines.

Return ONLY JSON:
{ "transactions": [ { "date": "YYYY-MM-DD or Today/Yesterday or D Mon", "description": string, "amount": number, "pending": boolean } ] }`,
  });
  return {
    value: normalizeBankScreenshotRows(parseJsonObject(out.text), localDate),
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}
