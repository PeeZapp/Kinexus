import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canEditInvestmentItem,
  canEditTradeEntry,
  isInvestmentStatus,
  isTradeSide,
  type InvestmentStatus,
  type InvestmentVisibility,
  type TradeSide,
} from '@kinexus/domain';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { getInvestmentItem, INVESTMENT_NOT_FOUND, mapTrade, TRADE_NOT_FOUND } from './invest-reads.js';
import {
  asHouseholdRole,
  assertCanEnterAmounts,
  assertCanViewFinances,
  resolveCallerHousehold,
} from './shared.js';

export type InvestWriteAction =
  | {
      action: 'add_investment_idea';
      title: string;
      symbol: string | null;
      thesis: string;
      notes: string;
      tags: string[];
      status: InvestmentStatus;
      visibility: InvestmentVisibility;
      targetPrice: number | null;
      stopPrice: number | null;
    }
  | {
      action: 'update_investment_idea';
      itemId: string;
      patch: Record<string, unknown>;
    }
  | { action: 'remove_investment_idea'; itemId: string; title: string }
  | {
      action: 'add_trade';
      symbol: string | null;
      itemId: string | null;
      side: TradeSide;
      qty: number;
      price: number;
      fees: number;
      tradedOn: string;
      thesis: string;
      emotions: string;
      notes: string;
      visibility: InvestmentVisibility;
    }
  | {
      action: 'update_trade';
      entryId: string;
      patch: Record<string, unknown>;
    }
  | { action: 'remove_trade'; entryId: string };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | { kind: 'blocked'; summary: string; message: string };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: InvestWriteAction,
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

export async function previewAddInvestmentIdea(
  caller: McpCaller,
  input: {
    title: string;
    symbol?: string | null;
    thesis?: string;
    notes?: string;
    tags?: string[];
    status?: string;
    visibility?: string;
    targetPrice?: number | null;
    stopPrice?: number | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanEnterAmounts(role);
  const title = input.title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!title) return { kind: 'blocked', summary: 'Could not add idea', message: 'Give the idea a title' };
  const status = input.status && isInvestmentStatus(input.status) ? input.status : 'watching';
  const visibility: InvestmentVisibility = input.visibility === 'private' ? 'private' : 'household';

  return savePreview(
    caller,
    householdId,
    'preview_add_investment_idea',
    {
      action: 'add_investment_idea',
      title,
      symbol: input.symbol?.trim().toUpperCase() || null,
      thesis: (input.thesis ?? '').slice(0, 4000),
      notes: (input.notes ?? '').slice(0, 4000),
      tags: [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))],
      status,
      visibility,
      targetPrice: input.targetPrice ?? null,
      stopPrice: input.stopPrice ?? null,
    },
    `Add investment idea "${title}"`,
    ['Insert finance_investment_items row'],
  );
}

export async function previewUpdateInvestmentIdea(
  caller: McpCaller,
  input: {
    itemId: string;
    title?: string;
    symbol?: string | null;
    thesis?: string;
    notes?: string;
    tags?: string[];
    status?: string;
    visibility?: string;
    targetPrice?: number | null;
    stopPrice?: number | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanViewFinances(role);
  const { item } = await getInvestmentItem(caller.client, caller.userId, input.itemId);
  if (!canEditInvestmentItem(item, { role: asHouseholdRole(role), userId: caller.userId })) {
    return { kind: 'blocked', summary: 'Cannot edit', message: 'You cannot change this idea' };
  }
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) return { kind: 'blocked', summary: 'Could not update', message: 'Give the idea a title' };
    patch.title = title;
  }
  if (input.symbol !== undefined) patch.symbol = input.symbol?.trim().toUpperCase() || null;
  if (input.thesis !== undefined) patch.thesis = input.thesis.slice(0, 4000);
  if (input.notes !== undefined) patch.notes = input.notes.slice(0, 4000);
  if (input.tags !== undefined) patch.tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];
  if (input.status !== undefined) {
    if (!isInvestmentStatus(input.status)) {
      return { kind: 'blocked', summary: 'Invalid status', message: 'status must be watching|idea|holding|closed' };
    }
    patch.status = input.status;
  }
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility === 'private' ? 'private' : 'household';
  }
  if (input.targetPrice !== undefined) patch.target_price = input.targetPrice;
  if (input.stopPrice !== undefined) patch.stop_price = input.stopPrice;
  if (Object.keys(patch).length === 0) {
    return { kind: 'blocked', summary: 'Nothing to update', message: 'Provide at least one field' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_update_investment_idea',
    { action: 'update_investment_idea', itemId: item.id, patch },
    `Update investment idea "${item.title}"`,
    [`Patch finance_investment_items ${item.id}`],
  );
}

export async function previewRemoveInvestmentIdea(
  caller: McpCaller,
  input: { itemId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanViewFinances(role);
  const { item } = await getInvestmentItem(caller.client, caller.userId, input.itemId);
  if (!canEditInvestmentItem(item, { role: asHouseholdRole(role), userId: caller.userId })) {
    return { kind: 'blocked', summary: 'Cannot remove', message: 'You cannot delete this idea' };
  }
  return savePreview(
    caller,
    householdId,
    'preview_remove_investment_idea',
    { action: 'remove_investment_idea', itemId: item.id, title: item.title },
    `Remove investment idea "${item.title}"`,
    [`Delete finance_investment_items ${item.id}`],
  );
}

export async function previewAddTrade(
  caller: McpCaller,
  input: {
    symbol?: string | null;
    itemId?: string | null;
    side: string;
    qty: number;
    price: number;
    fees?: number;
    tradedOn: string;
    thesis?: string;
    emotions?: string;
    notes?: string;
    visibility?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanEnterAmounts(role);
  if (!isTradeSide(input.side)) {
    return { kind: 'blocked', summary: 'Invalid side', message: 'side must be buy or sell' };
  }
  if (!(input.qty > 0) || !(input.price >= 0)) {
    return { kind: 'blocked', summary: 'Invalid trade', message: 'qty must be > 0 and price >= 0' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tradedOn)) {
    return { kind: 'blocked', summary: 'Invalid date', message: 'tradedOn must be YYYY-MM-DD' };
  }
  const symbol = input.symbol?.trim().toUpperCase() || null;
  const itemId = input.itemId ?? null;
  if (!symbol && !itemId) {
    return { kind: 'blocked', summary: 'Missing symbol', message: 'Provide symbol and/or itemId' };
  }
  if (itemId) await getInvestmentItem(caller.client, caller.userId, itemId);

  return savePreview(
    caller,
    householdId,
    'preview_add_trade',
    {
      action: 'add_trade',
      symbol,
      itemId,
      side: input.side,
      qty: input.qty,
      price: input.price,
      fees: Math.max(0, input.fees ?? 0),
      tradedOn: input.tradedOn,
      thesis: (input.thesis ?? '').slice(0, 4000),
      emotions: (input.emotions ?? '').slice(0, 1000),
      notes: (input.notes ?? '').slice(0, 4000),
      visibility: input.visibility === 'private' ? 'private' : 'household',
    },
    `Log ${input.side} ${input.qty} @ ${input.price}`,
    ['Insert finance_trade_journal row'],
  );
}

export async function previewUpdateTrade(
  caller: McpCaller,
  input: {
    entryId: string;
    symbol?: string | null;
    side?: string;
    qty?: number;
    price?: number;
    fees?: number;
    tradedOn?: string;
    thesis?: string;
    emotions?: string;
    notes?: string;
    visibility?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanViewFinances(role);
  const { data, error } = await caller.client
    .from('finance_trade_journal')
    .select('*')
    .eq('id', input.entryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(TRADE_NOT_FOUND);
  const entry = mapTrade(data as Record<string, unknown>);
  if (entry.householdId !== householdId) throw new Error(TRADE_NOT_FOUND);
  if (!canEditTradeEntry(entry, { role: asHouseholdRole(role), userId: caller.userId })) {
    return { kind: 'blocked', summary: 'Cannot edit', message: 'You cannot change this trade' };
  }
  const patch: Record<string, unknown> = {};
  if (input.symbol !== undefined) patch.symbol = input.symbol?.trim().toUpperCase() || null;
  if (input.side !== undefined) {
    if (!isTradeSide(input.side)) {
      return { kind: 'blocked', summary: 'Invalid side', message: 'side must be buy or sell' };
    }
    patch.side = input.side;
  }
  if (input.qty !== undefined) {
    if (!(input.qty > 0)) return { kind: 'blocked', summary: 'Invalid qty', message: 'qty must be > 0' };
    patch.qty = input.qty;
  }
  if (input.price !== undefined) {
    if (!(input.price >= 0)) return { kind: 'blocked', summary: 'Invalid price', message: 'price must be >= 0' };
    patch.price = input.price;
  }
  if (input.fees !== undefined) patch.fees = Math.max(0, input.fees);
  if (input.tradedOn !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tradedOn)) {
      return { kind: 'blocked', summary: 'Invalid date', message: 'tradedOn must be YYYY-MM-DD' };
    }
    patch.traded_on = input.tradedOn;
  }
  if (input.thesis !== undefined) patch.thesis = input.thesis.slice(0, 4000);
  if (input.emotions !== undefined) patch.emotions = input.emotions.slice(0, 1000);
  if (input.notes !== undefined) patch.notes = input.notes.slice(0, 4000);
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility === 'private' ? 'private' : 'household';
  }
  if (Object.keys(patch).length === 0) {
    return { kind: 'blocked', summary: 'Nothing to update', message: 'Provide at least one field' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_update_trade',
    { action: 'update_trade', entryId: entry.id, patch },
    `Update trade ${entry.id}`,
    [`Patch finance_trade_journal ${entry.id}`],
  );
}

export async function previewRemoveTrade(
  caller: McpCaller,
  input: { entryId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanViewFinances(role);
  const { data, error } = await caller.client
    .from('finance_trade_journal')
    .select('*')
    .eq('id', input.entryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(TRADE_NOT_FOUND);
  const entry = mapTrade(data as Record<string, unknown>);
  if (entry.householdId !== householdId) throw new Error(TRADE_NOT_FOUND);
  if (!canEditTradeEntry(entry, { role: asHouseholdRole(role), userId: caller.userId })) {
    return { kind: 'blocked', summary: 'Cannot remove', message: 'You cannot delete this trade' };
  }
  return savePreview(
    caller,
    householdId,
    'preview_remove_trade',
    { action: 'remove_trade', entryId: entry.id },
    `Remove trade ${entry.id}`,
    [`Delete finance_trade_journal ${entry.id}`],
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
  payload: InvestWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  switch (payload.action) {
    case 'add_investment_idea': {
      const id = randomUUID();
      const { error } = await caller.client.from('finance_investment_items').insert({
        id,
        household_id: householdId,
        created_by: caller.userId,
        title: payload.title,
        symbol: payload.symbol,
        thesis: payload.thesis,
        notes: payload.notes,
        tags: payload.tags,
        status: payload.status,
        visibility: payload.visibility,
        target_price: payload.targetPrice,
        stop_price: payload.stopPrice,
      });
      if (error) throw new Error(error.message);
      return { affectedIds: [id], result: { itemId: id } };
    }
    case 'update_investment_idea': {
      const { error } = await caller.client
        .from('finance_investment_items')
        .update(payload.patch)
        .eq('id', payload.itemId)
        .eq('household_id', householdId);
      if (error) throw new Error(error.message);
      return { affectedIds: [payload.itemId], result: { itemId: payload.itemId } };
    }
    case 'remove_investment_idea': {
      const { data, error } = await caller.client
        .from('finance_investment_items')
        .delete()
        .eq('id', payload.itemId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(INVESTMENT_NOT_FOUND);
      return { affectedIds: [payload.itemId], result: { deleted: payload.itemId } };
    }
    case 'add_trade': {
      const id = randomUUID();
      const { error } = await caller.client.from('finance_trade_journal').insert({
        id,
        household_id: householdId,
        created_by: caller.userId,
        symbol: payload.symbol,
        item_id: payload.itemId,
        side: payload.side,
        qty: payload.qty,
        price: payload.price,
        fees: payload.fees,
        traded_on: payload.tradedOn,
        thesis: payload.thesis,
        emotions: payload.emotions,
        notes: payload.notes,
        visibility: payload.visibility,
      });
      if (error) throw new Error(error.message);
      return { affectedIds: [id], result: { entryId: id } };
    }
    case 'update_trade': {
      const { error } = await caller.client
        .from('finance_trade_journal')
        .update(payload.patch)
        .eq('id', payload.entryId)
        .eq('household_id', householdId);
      if (error) throw new Error(error.message);
      return { affectedIds: [payload.entryId], result: { entryId: payload.entryId } };
    }
    case 'remove_trade': {
      const { data, error } = await caller.client
        .from('finance_trade_journal')
        .delete()
        .eq('id', payload.entryId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(TRADE_NOT_FOUND);
      return { affectedIds: [payload.entryId], result: { deleted: payload.entryId } };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown invest action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitInvestPreview(
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
  const payload = committed.preview.payload as InvestWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const INVEST_PREVIEW_TOOLS = [
  'preview_add_investment_idea',
  'preview_update_investment_idea',
  'preview_remove_investment_idea',
  'preview_add_trade',
  'preview_update_trade',
  'preview_remove_trade',
] as const;
