import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canEnterBudgetAmounts,
  canManageBudgetPlan,
  canViewFinances,
  normalizeAnchorMonth,
  normalizeBudgetCadence,
  type FinanceBudget,
  type FinanceBudgetCarry,
  type FinanceBudgetCarryEvent,
  type FinanceBudgetLine,
  type FinanceBudgetTxn,
  type HouseholdRole,
} from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import {
  resolveCallerHousehold,
  withMcpAudit,
  type CallerHousehold,
} from '../meals/shared.js';

export const BUDGET_NOT_FOUND = 'Budget not found';
export const LINE_NOT_FOUND = 'Budget category not found';
export const CARRY_NOT_FOUND = 'Carry balance not found';
export const FINANCES_FORBIDDEN = 'Your household role cannot access finances';
export const FINANCES_WRITE_FORBIDDEN = 'Your household role cannot change the budget';

export { resolveCallerHousehold, withMcpAudit };
export type { CallerHousehold };

const ROLE_SET = new Set<string>(['owner', 'admin', 'adult', 'teen', 'child']);

export function asHouseholdRole(role: string): HouseholdRole | null {
  return ROLE_SET.has(role) ? (role as HouseholdRole) : null;
}

export function assertCanViewFinances(role: string): HouseholdRole {
  const r = asHouseholdRole(role);
  if (!canViewFinances(r)) throw new Error(FINANCES_FORBIDDEN);
  return r!;
}

export function assertCanEnterAmounts(role: string): HouseholdRole {
  const r = asHouseholdRole(role);
  if (!canEnterBudgetAmounts(r)) throw new Error(FINANCES_WRITE_FORBIDDEN);
  return r!;
}

export function assertCanManagePlan(role: string): HouseholdRole {
  const r = asHouseholdRole(role);
  if (!canManageBudgetPlan(r)) throw new Error(FINANCES_WRITE_FORBIDDEN);
  return r!;
}

function asNum(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function money2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapBudget(row: Record<string, unknown>): FinanceBudget {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    notes: typeof row.notes === 'string' ? row.notes : null,
    setupCompletedAt: typeof row.setup_completed_at === 'string' ? row.setup_completed_at : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapLine(row: Record<string, unknown>): FinanceBudgetLine {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    budgetId: String(row.budget_id),
    kind: row.kind === 'income' ? 'income' : 'expense',
    name: String(row.name ?? ''),
    planned: Math.max(0, asNum(row.planned)),
    spent: Math.max(0, asNum(row.spent)),
    position: typeof row.position === 'number' ? row.position : Number(row.position ?? 0),
    cadence: normalizeBudgetCadence(row.cadence as string),
    anchorMonth: normalizeAnchorMonth(row.anchor_month),
    parentId: typeof row.parent_id === 'string' ? row.parent_id : null,
    autoApply: Boolean(row.auto_apply),
    autoAppliedMonth: typeof row.auto_applied_month === 'string' ? row.auto_applied_month : null,
    captureSurplus: Boolean(row.capture_surplus),
  };
}

export function mapTxn(row: Record<string, unknown>): FinanceBudgetTxn {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    budgetId: String(row.budget_id),
    lineId: typeof row.line_id === 'string' ? row.line_id : null,
    date: String(row.txn_date ?? '').slice(0, 10),
    description: String(row.description ?? ''),
    merchantKey: String(row.merchant_key ?? ''),
    amount: asNum(row.amount),
    ignored: Boolean(row.ignored),
    source: row.source === 'import' || row.source === 'auto' ? row.source : 'manual',
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
  };
}

export function mapCarry(row: Record<string, unknown>): FinanceBudgetCarry {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    budgetId: String(row.budget_id),
    lineId: String(row.line_id),
    balance: asNum(row.balance),
    lastAccruedMonth: typeof row.last_accrued_month === 'string' ? row.last_accrued_month.slice(0, 10) : null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapCarryEvent(row: Record<string, unknown>): FinanceBudgetCarryEvent {
  const kind =
    row.kind === 'accrue' || row.kind === 'apply' || row.kind === 'transfer' || row.kind === 'clear'
      ? row.kind
      : 'accrue';
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    budgetId: String(row.budget_id),
    lineId: String(row.line_id),
    kind,
    amount: asNum(row.amount),
    sourceMonth: typeof row.source_month === 'string' ? row.source_month.slice(0, 10) : null,
    targetLineId: typeof row.target_line_id === 'string' ? row.target_line_id : null,
    targetMonth: typeof row.target_month === 'string' ? row.target_month.slice(0, 10) : null,
    note: typeof row.note === 'string' ? row.note : null,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    createdAt: String(row.created_at ?? ''),
  };
}

export async function ensureBudget(
  client: SupabaseClient,
  householdId: string,
): Promise<FinanceBudget> {
  const { data: id, error } = await client.rpc('ensure_finance_budget', {
    p_household_id: householdId,
  });
  if (error) throw new Error(error.message);
  const { data, error: fetchError } = await client
    .from('finance_budgets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error(BUDGET_NOT_FOUND);
  return mapBudget(data as Record<string, unknown>);
}

export async function loadBudgetBundle(
  client: SupabaseClient,
  householdId: string,
): Promise<{
  budget: FinanceBudget;
  lines: FinanceBudgetLine[];
  txns: FinanceBudgetTxn[];
  carries: FinanceBudgetCarry[];
  carryEvents: FinanceBudgetCarryEvent[];
}> {
  const budget = await ensureBudget(client, householdId);
  const [linesRes, txnsRes, carryRes, eventsRes] = await Promise.all([
    client.from('finance_budget_lines').select('*').eq('budget_id', budget.id).order('position'),
    client
      .from('finance_budget_txns')
      .select('*')
      .eq('budget_id', budget.id)
      .order('txn_date', { ascending: false }),
    client.from('finance_budget_carry').select('*').eq('budget_id', budget.id),
    client
      .from('finance_budget_carry_events')
      .select('*')
      .eq('budget_id', budget.id)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (txnsRes.error) throw new Error(txnsRes.error.message);
  if (carryRes.error) throw new Error(carryRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  return {
    budget,
    lines: (linesRes.data ?? []).map((row) => mapLine(row as Record<string, unknown>)),
    txns: (txnsRes.data ?? []).map((row) => mapTxn(row as Record<string, unknown>)),
    carries: (carryRes.data ?? []).map((row) => mapCarry(row as Record<string, unknown>)),
    carryEvents: (eventsRes.data ?? []).map((row) => mapCarryEvent(row as Record<string, unknown>)),
  };
}

export async function withFinancesAudit<T>(
  caller: McpCaller,
  opts: { tool: string; mode: 'read' | 'write'; householdId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  return withMcpAudit(caller, opts, run);
}

export function parseMonthStart(value: string | undefined, label = 'month'): string {
  const raw = (value ?? '').trim();
  if (/^\d{4}-\d{2}-01$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  throw new Error(`${label} must be YYYY-MM or YYYY-MM-01`);
}
