import type { SupabaseClient } from '@supabase/supabase-js';
import {
  appliedCarryByLine,
  budgetTotals,
  linesForMonth,
  monthStartIso,
  txnsInMonth,
} from '@kinexus/domain';

import {
  assertCanViewFinances,
  loadBudgetBundle,
  parseMonthStart,
  resolveCallerHousehold,
} from './shared.js';

export async function getBudgetMonth(
  client: SupabaseClient,
  userId: string,
  opts: { month?: string } = {},
): Promise<{
  householdId: string;
  budgetId: string;
  monthStart: string;
  totals: {
    planned: number;
    spent: number;
    leftover: number;
    income: number;
    incomePlanned: number;
    leftoverPlanned: number;
  };
  categories: {
    id: string;
    name: string;
    kind: string;
    planned: number;
    spent: number;
    leftover: number;
    parentId: string | null;
  }[];
  carryBalances: { lineId: string; name: string; balance: number }[];
}> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const monthStart = opts.month ? parseMonthStart(opts.month) : monthStartIso();
  const { budget, lines, txns, carries, carryEvents } = await loadBudgetBundle(client, householdId);
  const applied = appliedCarryByLine(carryEvents, monthStart);
  const monthLines = linesForMonth(lines, txns, monthStart, undefined, applied);
  const totals = budgetTotals(monthLines);
  const nameById = new Map(lines.map((line) => [line.id, line.name]));

  return {
    householdId,
    budgetId: budget.id,
    monthStart,
    totals: {
      planned: totals.expensePlanned,
      spent: totals.expenseSpent,
      leftover: totals.leftoverActual,
      income: totals.incomeSpent,
      incomePlanned: totals.incomePlanned,
      leftoverPlanned: totals.leftoverPlanned,
    },
    categories: monthLines.map((line) => ({
      id: line.id,
      name: line.name,
      kind: line.kind,
      planned: line.planned,
      spent: line.spent,
      leftover: line.planned - line.spent,
      parentId: line.parentId,
    })),
    carryBalances: carries
      .filter((row) => row.balance !== 0)
      .map((row) => ({
        lineId: row.lineId,
        name: nameById.get(row.lineId) ?? row.lineId,
        balance: row.balance,
      })),
  };
}

export async function listBudgetTransactions(
  client: SupabaseClient,
  userId: string,
  opts: { month?: string; lineId?: string; limit?: number } = {},
): Promise<{
  householdId: string;
  monthStart: string;
  transactions: {
    id: string;
    lineId: string | null;
    date: string;
    description: string;
    amount: number;
    source: string;
  }[];
}> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const monthStart = opts.month ? parseMonthStart(opts.month) : monthStartIso();
  const { txns } = await loadBudgetBundle(client, householdId);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let filtered = txnsInMonth(txns, monthStart).filter((txn) => !txn.ignored);
  if (opts.lineId) filtered = filtered.filter((txn) => txn.lineId === opts.lineId);
  return {
    householdId,
    monthStart,
    transactions: filtered.slice(0, limit).map((txn) => ({
      id: txn.id,
      lineId: txn.lineId,
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      source: txn.source ?? 'manual',
    })),
  };
}

export async function getBudgetCarry(
  client: SupabaseClient,
  userId: string,
): Promise<{
  householdId: string;
  budgetId: string;
  carries: { lineId: string; name: string; balance: number; lastAccruedMonth: string | null }[];
}> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const { budget, lines, carries } = await loadBudgetBundle(client, householdId);
  const nameById = new Map(lines.map((line) => [line.id, line.name]));
  return {
    householdId,
    budgetId: budget.id,
    carries: carries.map((row) => ({
      lineId: row.lineId,
      name: nameById.get(row.lineId) ?? row.lineId,
      balance: row.balance,
      lastAccruedMonth: row.lastAccruedMonth,
    })),
  };
}
