import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clampApplyAmount,
  defaultTxnDateForMonth,
  evalMoneyExpression,
  merchantKey,
  monthStartIso,
} from '@kinexus/domain';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import {
  CARRY_NOT_FOUND,
  LINE_NOT_FOUND,
  assertCanEnterAmounts,
  assertCanManagePlan,
  loadBudgetBundle,
  money2,
  parseMonthStart,
  resolveCallerHousehold,
} from './shared.js';

export type FinancesWriteAction =
  | {
      action: 'add_budget_txn';
      lineId: string;
      description: string;
      amount: number;
      date: string;
      entryKind: 'spend' | 'return' | 'income';
      signedAmount: number;
    }
  | {
      action: 'apply_budget_carry';
      lineId: string;
      monthStart: string;
      amount: number;
      targetLineId: string;
    }
  | {
      action: 'clear_budget_carry';
      lineId: string;
      clearedAmount: number;
      carryRowId: string;
    }
  | {
      action: 'transfer_budget_carry';
      fromLineId: string;
      toLineId: string;
      amount: number;
      fromCarryId: string;
      toCarryId: string | null;
      toLastAccruedMonth: string | null;
    };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    }
  | {
      kind: 'noop';
      summary: string;
      message: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: FinancesWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

export async function previewAddBudgetTxn(
  caller: McpCaller,
  input: {
    lineId: string;
    description: string;
    amount: string | number;
    date?: string;
    entryKind?: 'spend' | 'return' | 'income';
    month?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanEnterAmounts(role);
  const monthStart = input.month ? parseMonthStart(input.month) : monthStartIso();
  const { lines } = await loadBudgetBundle(caller.client, householdId);
  const line = lines.find((item) => item.id === input.lineId);
  if (!line) return { kind: 'blocked', summary: 'Unknown category', message: LINE_NOT_FOUND };

  const description = input.description.trim();
  if (!description) {
    return { kind: 'blocked', summary: 'Could not add transaction', message: 'Say what this is for' };
  }
  const amount =
    typeof input.amount === 'number' ? input.amount : evalMoneyExpression(String(input.amount));
  if (amount == null || !(amount > 0)) {
    return { kind: 'blocked', summary: 'Could not add transaction', message: 'Enter a positive amount' };
  }
  const date = (input.date?.trim() || defaultTxnDateForMonth(monthStart)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { kind: 'blocked', summary: 'Could not add transaction', message: 'Pick a date YYYY-MM-DD' };
  }
  const entryKind = input.entryKind ?? (line.kind === 'income' ? 'income' : 'spend');
  if (entryKind === 'return' && line.kind !== 'expense') {
    return { kind: 'blocked', summary: 'Invalid entry', message: 'Returns go back into an expense category' };
  }
  if (entryKind === 'income' && line.kind !== 'income') {
    return { kind: 'blocked', summary: 'Invalid entry', message: 'Pick an income category for money in' };
  }
  const signedAmount = entryKind === 'spend' ? -amount : amount;

  return savePreview(
    caller,
    householdId,
    'preview_add_budget_txn',
    {
      action: 'add_budget_txn',
      lineId: line.id,
      description: description.slice(0, 240),
      amount,
      date,
      entryKind,
      signedAmount,
    },
    `Add ${entryKind} $${amount.toFixed(2)} to ${line.name}`,
    [`Insert finance_budget_txns for ${line.name}`],
  );
}

export async function previewApplyBudgetCarry(
  caller: McpCaller,
  input: { lineId: string; month?: string; amount?: number; targetLineId?: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanManagePlan(role);
  const monthStart = input.month ? parseMonthStart(input.month) : monthStartIso();
  const { lines, carries } = await loadBudgetBundle(caller.client, householdId);
  const existing = carries.find((row) => row.lineId === input.lineId);
  if (!existing || money2(existing.balance) === 0) {
    return { kind: 'blocked', summary: 'Nothing to apply', message: 'Carry balance is empty' };
  }
  const applyAmount = clampApplyAmount(existing.balance, input.amount ?? Math.abs(existing.balance));
  if (applyAmount === 0) {
    return { kind: 'blocked', summary: 'Nothing to apply', message: 'Carry balance is empty' };
  }
  const destLineId = input.targetLineId ?? input.lineId;
  const destLine = lines.find((line) => line.id === destLineId);
  if (!destLine || destLine.kind !== 'expense') {
    return { kind: 'blocked', summary: 'Invalid target', message: 'Pick an expense category' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_apply_budget_carry',
    {
      action: 'apply_budget_carry',
      lineId: input.lineId,
      monthStart,
      amount: applyAmount,
      targetLineId: destLineId,
    },
    `Apply carry $${Math.abs(applyAmount).toFixed(2)} to ${destLine.name} (${monthStart})`,
    ['Insert apply carry event', 'Update carry balance'],
  );
}

export async function previewClearBudgetCarry(
  caller: McpCaller,
  input: { lineId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanManagePlan(role);
  const { carries } = await loadBudgetBundle(caller.client, householdId);
  const existing = carries.find((row) => row.lineId === input.lineId);
  if (!existing || money2(existing.balance) === 0) {
    return { kind: 'noop', summary: 'Already clear', message: 'Carry balance is already zero' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_clear_budget_carry',
    {
      action: 'clear_budget_carry',
      lineId: input.lineId,
      clearedAmount: money2(existing.balance),
      carryRowId: existing.id,
    },
    `Clear carry balance on line ${input.lineId}`,
    ['Insert clear carry event', 'Zero carry balance'],
  );
}

export async function previewTransferBudgetCarry(
  caller: McpCaller,
  input: { fromLineId: string; toLineId: string; amount?: number },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanManagePlan(role);
  if (input.fromLineId === input.toLineId) {
    return { kind: 'blocked', summary: 'Invalid transfer', message: 'Pick a different category' };
  }
  const { lines, carries } = await loadBudgetBundle(caller.client, householdId);
  const from = carries.find((row) => row.lineId === input.fromLineId);
  if (!from || money2(from.balance) === 0) {
    return { kind: 'blocked', summary: 'Nothing to move', message: 'Source carry balance is empty' };
  }
  const move = clampApplyAmount(from.balance, input.amount ?? Math.abs(from.balance));
  if (move === 0) {
    return { kind: 'blocked', summary: 'Nothing to move', message: 'Source carry balance is empty' };
  }
  const toLine = lines.find((line) => line.id === input.toLineId);
  if (!toLine || toLine.kind !== 'expense') {
    return { kind: 'blocked', summary: 'Invalid target', message: 'Pick an expense category' };
  }
  const toExisting = carries.find((row) => row.lineId === input.toLineId) ?? null;

  return savePreview(
    caller,
    householdId,
    'preview_transfer_budget_carry',
    {
      action: 'transfer_budget_carry',
      fromLineId: input.fromLineId,
      toLineId: input.toLineId,
      amount: move,
      fromCarryId: from.id,
      toCarryId: toExisting?.id ?? null,
      toLastAccruedMonth: from.lastAccruedMonth,
    },
    `Transfer carry $${Math.abs(move).toFixed(2)} → ${toLine.name}`,
    ['Insert transfer events', 'Update carry balances'],
  );
}

async function peekPreviewTool(
  client: SupabaseClient,
  userId: string,
  previewId: string,
): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function executeWrite(
  caller: McpCaller,
  householdId: string,
  payload: FinancesWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const { budget, lines, carries } = await loadBudgetBundle(caller.client, householdId);

  switch (payload.action) {
    case 'add_budget_txn': {
      const line = lines.find((item) => item.id === payload.lineId);
      if (!line) throw new Error(LINE_NOT_FOUND);
      const id = randomUUID();
      const { error } = await caller.client.from('finance_budget_txns').insert({
        id,
        household_id: householdId,
        budget_id: budget.id,
        line_id: line.id,
        txn_date: payload.date,
        description: payload.description,
        merchant_key: merchantKey(payload.description).slice(0, 80) || 'UNKNOWN',
        amount: payload.signedAmount,
        ignored: false,
        source: 'manual',
        created_by: caller.userId,
      });
      if (error) throw new Error(error.message);
      return {
        affectedIds: [id],
        result: {
          txnId: id,
          lineId: line.id,
          amount: payload.signedAmount,
          entryKind: payload.entryKind,
        },
      };
    }
    case 'apply_budget_carry': {
      const existing = carries.find((row) => row.lineId === payload.lineId);
      if (!existing) throw new Error(CARRY_NOT_FOUND);
      const { error: eventError } = await caller.client.from('finance_budget_carry_events').insert({
        id: randomUUID(),
        household_id: householdId,
        budget_id: budget.id,
        line_id: payload.lineId,
        kind: 'apply',
        amount: payload.amount,
        target_line_id: payload.targetLineId,
        target_month: payload.monthStart,
        note:
          payload.targetLineId === payload.lineId
            ? `Applied to ${payload.monthStart}`
            : `Applied to target line`,
        created_by: caller.userId,
      });
      if (eventError) throw new Error(eventError.message);
      const nextBalance = money2(existing.balance - payload.amount);
      const { error } = await caller.client
        .from('finance_budget_carry')
        .update({ balance: nextBalance })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return {
        affectedIds: [existing.id],
        result: { lineId: payload.lineId, applied: payload.amount, balance: nextBalance },
      };
    }
    case 'clear_budget_carry': {
      const { error: eventError } = await caller.client.from('finance_budget_carry_events').insert({
        id: randomUUID(),
        household_id: householdId,
        budget_id: budget.id,
        line_id: payload.lineId,
        kind: 'clear',
        amount: -payload.clearedAmount,
        note: 'Cleared',
        created_by: caller.userId,
      });
      if (eventError) throw new Error(eventError.message);
      const { error } = await caller.client
        .from('finance_budget_carry')
        .update({ balance: 0 })
        .eq('id', payload.carryRowId);
      if (error) throw new Error(error.message);
      return {
        affectedIds: [payload.carryRowId],
        result: { lineId: payload.lineId, cleared: payload.clearedAmount },
      };
    }
    case 'transfer_budget_carry': {
      const from = carries.find((row) => row.id === payload.fromCarryId);
      if (!from) throw new Error(CARRY_NOT_FOUND);
      const toLine = lines.find((line) => line.id === payload.toLineId);
      if (!toLine) throw new Error(LINE_NOT_FOUND);

      const { error: outError } = await caller.client.from('finance_budget_carry_events').insert({
        id: randomUUID(),
        household_id: householdId,
        budget_id: budget.id,
        line_id: payload.fromLineId,
        kind: 'transfer',
        amount: -payload.amount,
        target_line_id: payload.toLineId,
        note: `Moved to ${toLine.name}`,
        created_by: caller.userId,
      });
      if (outError) throw new Error(outError.message);

      const { error: inError } = await caller.client.from('finance_budget_carry_events').insert({
        id: randomUUID(),
        household_id: householdId,
        budget_id: budget.id,
        line_id: payload.toLineId,
        kind: 'transfer',
        amount: payload.amount,
        target_line_id: payload.fromLineId,
        note: 'Moved from category',
        created_by: caller.userId,
      });
      if (inError) throw new Error(inError.message);

      const fromNext = money2(from.balance - payload.amount);
      const { error: fromUpdateError } = await caller.client
        .from('finance_budget_carry')
        .update({ balance: fromNext })
        .eq('id', from.id);
      if (fromUpdateError) throw new Error(fromUpdateError.message);

      if (payload.toCarryId) {
        const toExisting = carries.find((row) => row.id === payload.toCarryId);
        const { error } = await caller.client
          .from('finance_budget_carry')
          .update({ balance: money2((toExisting?.balance ?? 0) + payload.amount) })
          .eq('id', payload.toCarryId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await caller.client.from('finance_budget_carry').insert({
          id: randomUUID(),
          household_id: householdId,
          budget_id: budget.id,
          line_id: payload.toLineId,
          balance: payload.amount,
          last_accrued_month: payload.toLastAccruedMonth,
        });
        if (error) throw new Error(error.message);
      }

      return {
        affectedIds: [payload.fromLineId, payload.toLineId],
        result: { fromLineId: payload.fromLineId, toLineId: payload.toLineId, amount: payload.amount },
      };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown finances action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitFinancesPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');
  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);
  const payload = committed.preview.payload as FinancesWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const FINANCES_PREVIEW_TOOLS = [
  'preview_add_budget_txn',
  'preview_apply_budget_carry',
  'preview_clear_budget_carry',
  'preview_transfer_budget_carry',
] as const;
