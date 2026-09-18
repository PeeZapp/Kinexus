import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect } from 'react';

import type { Database } from '@kinexus/db';
import {
  formatHolderId,
  holderIdKind,
  isAsxSymbol,
  evalMoneyExpression,
  merchantKey,
  nextLinePosition,
  normalizeAsxSymbol,
  parseMoney,
  type ClassifiedStatementTxn,
  type FinanceBudgetLine,
  type ProposedBudgetLine,
  type StatementAssignment,
  type FinanceAccount,
  type FinanceAccountKind,
  type FinanceBudgetLineKind,
  type CollectibleCondition,
  type CollectibleKind,
  type CollectibleSource,
  type ShareImportResult,
} from '@kinexus/domain';

import { accountFromRow, budgetFromRow, collectibleFromRow, holdingFromRow, lineFromRow, portfolioFromRow, txnFromRow } from '@/src/features/finances/mappers';
import { fetchShareQuotes } from '@/src/features/finances/finance-api';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { supabase } from '@/src/lib/supabase';

function accountsKey(householdId: string) {
  return ['finances', 'accounts', householdId] as const;
}
function budgetKey(householdId: string) {
  return ['finances', 'budget', householdId] as const;
}
function linesKey(householdId: string) {
  return ['finances', 'lines', householdId] as const;
}
function txnsKey(householdId: string) {
  return ['finances', 'txns', householdId] as const;
}
function portfoliosKey(householdId: string) {
  return ['finances', 'portfolios', householdId] as const;
}
function holdingsKey(householdId: string) {
  return ['finances', 'holdings', householdId] as const;
}
function collectiblesKey(householdId: string) {
  return ['finances', 'collectibles', householdId] as const;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const TXN_CHUNK = 250;

async function insertTxnRows(rows: Database['public']['Tables']['finance_budget_txns']['Insert'][]): Promise<void> {
  if (!supabase || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += TXN_CHUNK) {
    const { error } = await supabase.from('finance_budget_txns').insert(rows.slice(i, i + TXN_CHUNK));
    throwIfError(error);
  }
}

async function fetchBudgetTxns(budgetId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_budget_txns')
    .select('*')
    .eq('budget_id', budgetId)
    .order('txn_date', { ascending: false });
  throwIfError(error);
  return (data ?? []).map(txnFromRow);
}

export function actionErrorMessage(err: unknown, fallback = 'Could not save that'): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}

export type AccountDraft = {
  name: string;
  kind: FinanceAccountKind;
  institution?: string;
  value?: string;
  notes?: string;
};

export type BudgetLineDraft = {
  id?: string;
  kind: FinanceBudgetLineKind;
  name: string;
  planned?: string;
};

export type BudgetEntryDraft = {
  description: string;
  amount: string;
  date?: string;
};

export type PortfolioDraft = {
  name: string;
  broker?: string;
  holderId?: string;
  postcode?: string;
  notes?: string;
};

export type HoldingDraft = {
  symbol: string;
  units?: string;
  costPerUnit?: string;
  name?: string;
};

export type CollectibleDraft = {
  name: string;
  kind: CollectibleKind;
  condition: CollectibleCondition;
  quantity?: string;
  catalogId?: string;
  source?: CollectibleSource;
  sourceUrl?: string;
  imageUrl?: string;
  purchasedValue?: string;
  marketValue?: string;
  notes?: string;
  valuedAt?: string | null;
};

async function fetchAccounts(householdId: string): Promise<FinanceAccount[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(accountFromRow);
}

async function fetchPortfolios(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_share_portfolios')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(portfolioFromRow);
}

async function fetchHoldings(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_share_holdings')
    .select('*')
    .eq('household_id', householdId)
    .order('symbol');
  if (error) throw error;
  return (data ?? []).map(holdingFromRow);
}

async function fetchCollectibles(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_collectibles')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(collectibleFromRow);
}

export function useFinancesSync() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const currency = activeHousehold?.currency || 'AUD';
  const ready = Boolean(householdId && supabase && online);

  const accountsQuery = useQuery({
    queryKey: householdId ? accountsKey(householdId) : ['finances', 'accounts', 'none'],
    enabled: ready,
    queryFn: () => fetchAccounts(householdId!),
  });

  const budgetQuery = useQuery({
    queryKey: householdId ? budgetKey(householdId) : ['finances', 'budget', 'none'],
    enabled: ready,
    queryFn: async () => {
      if (!supabase || !householdId) return null;
      const { data: id, error } = await supabase.rpc('ensure_finance_budget', {
        p_household_id: householdId,
      });
      if (error) throw error;
      const { data, error: fetchError } = await supabase.from('finance_budgets').select('*').eq('id', id).maybeSingle();
      if (fetchError) throw fetchError;
      return data ? budgetFromRow(data) : null;
    },
  });

  const linesQuery = useQuery({
    queryKey: householdId ? linesKey(householdId) : ['finances', 'lines', 'none'],
    enabled: ready && Boolean(budgetQuery.data?.id),
    queryFn: async () => {
      if (!supabase || !householdId || !budgetQuery.data) return [];
      const { data, error } = await supabase
        .from('finance_budget_lines')
        .select('*')
        .eq('budget_id', budgetQuery.data.id)
        .order('position');
      if (error) throw error;
      return (data ?? []).map(lineFromRow);
    },
  });

  const txnsQuery = useQuery({
    queryKey: householdId ? txnsKey(householdId) : ['finances', 'txns', 'none'],
    enabled: ready && Boolean(budgetQuery.data?.id),
    queryFn: async () => {
      if (!budgetQuery.data) return [];
      return fetchBudgetTxns(budgetQuery.data.id);
    },
  });

  const portfoliosQuery = useQuery({
    queryKey: householdId ? portfoliosKey(householdId) : ['finances', 'portfolios', 'none'],
    enabled: ready,
    queryFn: () => fetchPortfolios(householdId!),
  });

  const holdingsQuery = useQuery({
    queryKey: householdId ? holdingsKey(householdId) : ['finances', 'holdings', 'none'],
    enabled: ready,
    queryFn: () => fetchHoldings(householdId!),
  });

  const collectiblesQuery = useQuery({
    queryKey: householdId ? collectiblesKey(householdId) : ['finances', 'collectibles', 'none'],
    enabled: ready,
    queryFn: () => fetchCollectibles(householdId!),
  });

  useEffect(() => {
    if (!householdId || !online || !supabase) return;
    const client = supabase;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: accountsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: ['finances', 'budget', householdId] });
      void queryClient.invalidateQueries({ queryKey: ['finances', 'lines', householdId] });
      void queryClient.invalidateQueries({ queryKey: ['finances', 'txns', householdId] });
      void queryClient.invalidateQueries({ queryKey: portfoliosKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: collectiblesKey(householdId) });
    };
    const channel = client
      .channel(`finances-sync:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_accounts', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budgets', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budget_lines', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budget_txns', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_share_portfolios', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_share_holdings', filter: `household_id=eq.${householdId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_collectibles', filter: `household_id=eq.${householdId}` }, invalidate)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [householdId, online, queryClient]);

  const createAccount = useCallback(
    async (draft: AccountDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this account a name');
      const value = parseMoney(draft.value) ?? 0;
      if (value < 0) throw new Error('Value cannot be negative');
      const { error } = await supabase.from('finance_accounts').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        name,
        kind: draft.kind,
        institution: draft.institution?.trim() || null,
        value,
        notes: draft.notes?.trim() || null,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: accountsKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const updateAccount = useCallback(
    async (id: string, draft: AccountDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this account a name');
      const value = parseMoney(draft.value) ?? 0;
      if (value < 0) throw new Error('Value cannot be negative');
      const patch: Database['public']['Tables']['finance_accounts']['Update'] = {
        name,
        kind: draft.kind,
        institution: draft.institution?.trim() || null,
        value,
        notes: draft.notes?.trim() || null,
      };
      const { error } = await supabase.from('finance_accounts').update(patch).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: accountsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_accounts').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: accountsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const createLine = useCallback(
    async (draft: BudgetLineDraft) => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this line a name');
      const { error } = await supabase.from('finance_budget_lines').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        budget_id: budgetQuery.data.id,
        kind: draft.kind,
        name,
        planned: parseMoney(draft.planned) ?? 0,
        spent: 0,
        position: nextLinePosition(linesQuery.data ?? [], draft.kind),
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient],
  );

  const updateLine = useCallback(
    async (id: string, draft: BudgetLineDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this line a name');
      const { error } = await supabase
        .from('finance_budget_lines')
        .update({
          kind: draft.kind,
          name,
          planned: parseMoney(draft.planned) ?? 0,
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteLine = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const current = (linesQuery.data ?? []).find((line) => line.id === id);
      if (!current) throw new Error('That line is gone');
      const leftoverName = current.kind === 'income' ? 'Other income' : 'Other';
      const isFallback = current.name.trim().toLowerCase() === leftoverName.toLowerCase();
      const remaining = (linesQuery.data ?? []).filter((line) => line.id !== id);
      let fallback = remaining.find(
        (line) => line.kind === current.kind && line.name.trim().toLowerCase() === leftoverName.toLowerCase(),
      );
      if (isFallback) {
        const { error: ignoreError } = await supabase
          .from('finance_budget_txns')
          .update({ line_id: null, ignored: true })
          .eq('line_id', id);
        throwIfError(ignoreError);
      } else {
        if (!fallback && budgetQuery.data) {
          const fallbackId = Crypto.randomUUID();
          const position = nextLinePosition(remaining, current.kind);
          const { error: insertError } = await supabase.from('finance_budget_lines').insert({
            id: fallbackId,
            household_id: householdId,
            budget_id: budgetQuery.data.id,
            kind: current.kind,
            name: leftoverName,
            planned: 0,
            spent: 0,
            position,
          });
          throwIfError(insertError);
          fallback = {
            id: fallbackId,
            householdId,
            budgetId: budgetQuery.data.id,
            kind: current.kind,
            name: leftoverName,
            planned: 0,
            spent: 0,
            position,
          };
          remaining.push(fallback);
        }
        if (fallback) {
          const { error: moveError } = await supabase
            .from('finance_budget_txns')
            .update({ line_id: fallback.id, ignored: false })
            .eq('line_id', id);
          throwIfError(moveError);
        }
      }
      const { error } = await supabase.from('finance_budget_lines').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient],
  );

  const markBudgetSet = useCallback(
    async (budgetId: string) => {
      if (!supabase) return;
      const { error } = await supabase
        .from('finance_budgets')
        .update({ setup_completed_at: new Date().toISOString() })
        .eq('id', budgetId)
        .is('setup_completed_at', null);
      throwIfError(error);
    },
    [],
  );

  const saveBudgetPlan = useCallback(
    async (drafts: readonly BudgetLineDraft[]) => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      const budgetId = budgetQuery.data.id;
      const prepared = drafts
        .map((draft) => ({
          id: draft.id,
          kind: draft.kind,
          name: draft.name.trim(),
          planned: Math.max(0, parseMoney(draft.planned) ?? 0),
        }))
        .filter((draft) => draft.name);
      if (prepared.length === 0) throw new Error('Add at least one category');
      const existing = [...(linesQuery.data ?? [])];
      const used = new Set<string>();
      for (const draft of prepared) {
        const match =
          (draft.id ? existing.find((line) => line.id === draft.id && !used.has(line.id)) : undefined) ??
          existing.find(
            (line) =>
              !used.has(line.id) &&
              line.kind === draft.kind &&
              line.name.trim().toLowerCase() === draft.name.toLowerCase(),
          );
        if (match) {
          used.add(match.id);
          if (match.kind !== draft.kind || match.name !== draft.name || match.planned !== draft.planned) {
            const { error } = await supabase
              .from('finance_budget_lines')
              .update({ kind: draft.kind, name: draft.name, planned: draft.planned })
              .eq('id', match.id);
            throwIfError(error);
          }
          continue;
        }
        const position = nextLinePosition(existing, draft.kind);
        const id = Crypto.randomUUID();
        const { error } = await supabase.from('finance_budget_lines').insert({
          id,
          household_id: householdId,
          budget_id: budgetId,
          kind: draft.kind,
          name: draft.name,
          planned: draft.planned,
          spent: 0,
          position,
        });
        throwIfError(error);
        existing.push({
          id,
          householdId,
          budgetId,
          kind: draft.kind,
          name: draft.name,
          planned: draft.planned,
          spent: 0,
          position,
        });
        used.add(id);
      }
      for (const line of existing) {
        if (used.has(line.id)) continue;
        const { error } = await supabase.from('finance_budget_txns').update({ line_id: null, ignored: true }).eq('line_id', line.id);
        throwIfError(error);
        const { error: deleteError } = await supabase.from('finance_budget_lines').delete().eq('id', line.id);
        throwIfError(deleteError);
      }
      await markBudgetSet(budgetId);
      await queryClient.invalidateQueries({ queryKey: budgetKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, markBudgetSet, queryClient],
  );

  const createTxn = useCallback(
    async (lineId: string, draft: BudgetEntryDraft, monthStart: string) => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      const line = (linesQuery.data ?? []).find((item) => item.id === lineId);
      if (!line) throw new Error('That category is gone');
      const description = draft.description.trim();
      if (!description) throw new Error('Say what this is for');
      const amount = evalMoneyExpression(draft.amount);
      if (amount == null || amount <= 0) throw new Error('Enter an amount');
      const date = (draft.date?.trim() || monthStart).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date');
      const signed = line.kind === 'income' ? amount : -amount;
      const { error } = await supabase.from('finance_budget_txns').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        budget_id: budgetQuery.data.id,
        line_id: line.id,
        txn_date: date,
        description: description.slice(0, 240),
        merchant_key: merchantKey(description).slice(0, 80) || 'UNKNOWN',
        amount: signed,
        ignored: false,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient],
  );

  const deleteTxn = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_budget_txns').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const clearBudget = useCallback(
    async () => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      const budgetId = budgetQuery.data.id;
      const { error: txnError } = await supabase.from('finance_budget_txns').delete().eq('budget_id', budgetId);
      throwIfError(txnError);
      const { error: deleteError } = await supabase.from('finance_budget_lines').delete().eq('budget_id', budgetId);
      throwIfError(deleteError);
      const { error: setupError } = await supabase
        .from('finance_budgets')
        .update({ setup_completed_at: null })
        .eq('id', budgetId);
      throwIfError(setupError);
      await queryClient.invalidateQueries({ queryKey: budgetKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, queryClient],
  );

  const applyStatementBudget = useCallback(
    async (input: { lines: ProposedBudgetLine[]; transactions: readonly ClassifiedStatementTxn[]; setPlanned: boolean }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (input.lines.length === 0) throw new Error('Nothing to apply from that statement');
      const { data: budgetId, error: ensureError } = await supabase.rpc('ensure_finance_budget', {
        p_household_id: householdId,
      });
      throwIfError(ensureError);
      if (!budgetId) throw new Error('Could not open the household budget');
      const { data: existingRows, error: fetchError } = await supabase
        .from('finance_budget_lines')
        .select('*')
        .eq('budget_id', budgetId)
        .order('position');
      throwIfError(fetchError);
      const existing = (existingRows ?? []).map(lineFromRow);
      for (const proposed of input.lines) {
        const name = proposed.name.trim();
        if (!name) continue;
        const match = existing.find(
          (line) => line.kind === proposed.kind && line.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (match) {
          const patch: Database['public']['Tables']['finance_budget_lines']['Update'] = { spent: proposed.spent };
          if (input.setPlanned) patch.planned = proposed.spent;
          const { error } = await supabase.from('finance_budget_lines').update(patch).eq('id', match.id);
          throwIfError(error);
          continue;
        }
        const position = nextLinePosition(existing, proposed.kind);
        const id = Crypto.randomUUID();
        const { error } = await supabase.from('finance_budget_lines').insert({
          id,
          household_id: householdId,
          budget_id: budgetId,
          kind: proposed.kind,
          name,
          planned: input.setPlanned ? proposed.spent : 0,
          spent: proposed.spent,
          position,
        });
        throwIfError(error);
        existing.push({
          id,
          householdId,
          budgetId,
          kind: proposed.kind,
          name,
          planned: input.setPlanned ? proposed.spent : 0,
          spent: proposed.spent,
          position,
        });
      }
      const { error: clearError } = await supabase.from('finance_budget_txns').delete().eq('budget_id', budgetId);
      throwIfError(clearError);
      const rows: Database['public']['Tables']['finance_budget_txns']['Insert'][] = [];
      for (const txn of input.transactions) {
        if (!txn.assignment) continue;
        const match =
          txn.assignment.ignore
            ? null
            : existing.find(
                (line) =>
                  line.kind === txn.assignment?.kind &&
                  line.name.trim().toLowerCase() === txn.assignment.name.trim().toLowerCase(),
              );
        rows.push({
          id: Crypto.randomUUID(),
          household_id: householdId,
          budget_id: budgetId,
          line_id: match?.id ?? null,
          txn_date: txn.date,
          description: txn.description.slice(0, 240),
          merchant_key: txn.merchantKey.slice(0, 80) || 'UNKNOWN',
          amount: txn.amount,
          ignored: Boolean(txn.assignment.ignore),
        });
      }
      await insertTxnRows(rows);
      await markBudgetSet(budgetId);
      await queryClient.invalidateQueries({ queryKey: budgetKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [householdId, markBudgetSet, queryClient],
  );

  const reclassifyTxns = useCallback(
    async (input: { assignment: StatementAssignment; txnIds: readonly string[] }) => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      if (input.txnIds.length === 0) throw new Error('Pick a transaction');
      const lines = [...(linesQuery.data ?? [])];
      let lineId: string | null = null;
      let ignored = false;
      if (input.assignment.ignore) {
        ignored = true;
      } else {
        const name = input.assignment.name.trim();
        if (!name) throw new Error('Give this a category');
        let match = lines.find(
          (line) => line.kind === input.assignment.kind && line.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!match) {
          const id = Crypto.randomUUID();
          const position = nextLinePosition(lines, input.assignment.kind);
          const { error } = await supabase.from('finance_budget_lines').insert({
            id,
            household_id: householdId,
            budget_id: budgetQuery.data.id,
            kind: input.assignment.kind,
            name,
            planned: 0,
            spent: 0,
            position,
          });
          throwIfError(error);
          match = {
            id,
            householdId,
            budgetId: budgetQuery.data.id,
            kind: input.assignment.kind,
            name,
            planned: 0,
            spent: 0,
            position,
          };
          lines.push(match);
        }
        lineId = match.id;
      }
      for (let i = 0; i < input.txnIds.length; i += TXN_CHUNK) {
        const { error } = await supabase
          .from('finance_budget_txns')
          .update({ line_id: lineId, ignored })
          .in('id', input.txnIds.slice(i, i + TXN_CHUNK) as string[]);
        throwIfError(error);
      }
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient],
  );

  const createPortfolio = useCallback(
    async (draft: PortfolioDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this portfolio a name');
      const holderId = formatHolderId(draft.holderId);
      const { error } = await supabase.from('finance_share_portfolios').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        name,
        broker: draft.broker?.trim() || null,
        holder_kind: holderIdKind(holderId),
        holder_id: holderId,
        postcode: draft.postcode?.trim() || null,
        notes: draft.notes?.trim() || null,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: portfoliosKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const updatePortfolio = useCallback(
    async (id: string, draft: PortfolioDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this portfolio a name');
      const holderId = formatHolderId(draft.holderId);
      const { error } = await supabase
        .from('finance_share_portfolios')
        .update({
          name,
          broker: draft.broker?.trim() || null,
          holder_kind: holderIdKind(holderId),
          holder_id: holderId,
          postcode: draft.postcode?.trim() || null,
          notes: draft.notes?.trim() || null,
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: portfoliosKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deletePortfolio = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_share_portfolios').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: portfoliosKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const createHolding = useCallback(
    async (portfolioId: string, draft: HoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const symbol = normalizeAsxSymbol(draft.symbol);
      if (!isAsxSymbol(symbol)) throw new Error('Use an ASX code such as CBA or VAS');
      const units = parseMoney(draft.units) ?? 0;
      const { error } = await supabase.from('finance_share_holdings').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        portfolio_id: portfolioId,
        symbol,
        name: draft.name?.trim() || null,
        units,
        cost_per_unit: parseMoney(draft.costPerUnit),
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const updateHolding = useCallback(
    async (id: string, draft: HoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const symbol = normalizeAsxSymbol(draft.symbol);
      if (!isAsxSymbol(symbol)) throw new Error('Use an ASX code such as CBA or VAS');
      const { error } = await supabase
        .from('finance_share_holdings')
        .update({
          symbol,
          name: draft.name?.trim() || null,
          units: parseMoney(draft.units) ?? 0,
          cost_per_unit: parseMoney(draft.costPerUnit),
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteHolding = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_share_holdings').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const refreshQuotes = useCallback(
    async (symbols?: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const holdings = holdingsQuery.data ?? [];
      const wanted = [...new Set((symbols ?? holdings.map((item) => item.symbol)).map(normalizeAsxSymbol).filter(Boolean))];
      if (wanted.length === 0) return { updated: 0, missing: [] as string[] };
      const { quotes, missing } = await fetchShareQuotes(wanted);
      const pricedAt = new Date().toISOString();
      for (const quote of quotes) {
        const { error } = await supabase
          .from('finance_share_holdings')
          .update({
            last_price: quote.price,
            priced_at: pricedAt,
            ...(quote.name ? { name: quote.name } : {}),
          })
          .eq('household_id', householdId)
          .eq('symbol', quote.symbol);
        throwIfError(error);
      }
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
      return { updated: quotes.length, missing };
    },
    [holdingsQuery.data, householdId, queryClient],
  );

  const importHoldings = useCallback(
    async (portfolioId: string | null, parsed: ShareImportResult) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (parsed.holdings.length === 0) throw new Error('No holdings found in that file');
      let targetId = portfolioId;
      let portfolio = targetId ? (portfoliosQuery.data ?? []).find((item) => item.id === targetId) ?? null : null;
      if (!targetId || !portfolio) {
        targetId = Crypto.randomUUID();
        const holderId = parsed.holderId;
        const name = parsed.format === 'chess' ? 'CHESS' : 'ASX';
        const { error: createError } = await supabase.from('finance_share_portfolios').insert({
          id: targetId,
          household_id: householdId,
          created_by: userId,
          name,
          holder_kind: parsed.holderKind,
          holder_id: holderId,
        });
        throwIfError(createError);
      }
      if (!targetId) throw new Error('Choose a portfolio first');
      const pricedAt = new Date().toISOString();
      const rows: Database['public']['Tables']['finance_share_holdings']['Insert'][] = parsed.holdings.map((holding) => {
        const row: Database['public']['Tables']['finance_share_holdings']['Insert'] = {
          household_id: householdId,
          portfolio_id: targetId,
          symbol: holding.symbol,
          units: holding.units,
        };
        if (holding.name) row.name = holding.name;
        if (holding.costPerUnit != null) row.cost_per_unit = holding.costPerUnit;
        if (holding.lastPrice != null) {
          row.last_price = holding.lastPrice;
          row.priced_at = pricedAt;
        }
        return row;
      });
      const { error } = await supabase.from('finance_share_holdings').upsert(rows, {
        onConflict: 'portfolio_id,symbol',
        defaultToNull: false,
      });
      throwIfError(error);
      if (parsed.holderId && portfolio && !portfolio.holderId) {
        const { error: holderError } = await supabase
          .from('finance_share_portfolios')
          .update({
            holder_id: parsed.holderId,
            holder_kind: parsed.holderKind,
          })
          .eq('id', targetId);
        throwIfError(holderError);
      }
      await queryClient.invalidateQueries({ queryKey: portfoliosKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: holdingsKey(householdId) });
      try {
        await refreshQuotes(parsed.holdings.map((holding) => holding.symbol));
      } catch {
        // Import is saved even if the quote feed is down.
      }
      return targetId;
    },
    [householdId, portfoliosQuery.data, queryClient, refreshQuotes, userId],
  );

  const createCollectible = useCallback(
    async (draft: CollectibleDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this collectible a name');
      const quantity = Math.max(1, Math.floor(parseMoney(draft.quantity) ?? 1));
      const { error } = await supabase.from('finance_collectibles').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        name,
        kind: draft.kind,
        condition: draft.condition,
        quantity,
        catalog_id: draft.catalogId?.trim() || null,
        source: draft.source ?? 'manual',
        source_url: draft.sourceUrl?.trim() || null,
        image_url: draft.imageUrl?.trim() || null,
        purchased_value: parseMoney(draft.purchasedValue),
        market_value: parseMoney(draft.marketValue) ?? 0,
        notes: draft.notes?.trim() || null,
        valued_at: draft.valuedAt ?? (draft.catalogId?.trim() ? new Date().toISOString() : null),
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: collectiblesKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const updateCollectible = useCallback(
    async (id: string, draft: CollectibleDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const name = draft.name.trim();
      if (!name) throw new Error('Give this collectible a name');
      const patch: Database['public']['Tables']['finance_collectibles']['Update'] = {
        name,
        kind: draft.kind,
        condition: draft.condition,
        quantity: Math.max(1, Math.floor(parseMoney(draft.quantity) ?? 1)),
        catalog_id: draft.catalogId?.trim() || null,
        source: draft.source ?? 'manual',
        source_url: draft.sourceUrl?.trim() || null,
        image_url: draft.imageUrl?.trim() || null,
        purchased_value: parseMoney(draft.purchasedValue),
        market_value: parseMoney(draft.marketValue) ?? 0,
        notes: draft.notes?.trim() || null,
        valued_at: draft.valuedAt === undefined ? undefined : draft.valuedAt,
      };
      const { error } = await supabase.from('finance_collectibles').update(patch).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: collectiblesKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteCollectible = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_collectibles').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: collectiblesKey(householdId) });
    },
    [householdId, queryClient],
  );

  return {
    currency,
    online,
    accounts: accountsQuery.data ?? [],
    budget: budgetQuery.data ?? null,
    lines: linesQuery.data ?? [],
    txns: txnsQuery.data ?? [],
    portfolios: portfoliosQuery.data ?? [],
    holdings: holdingsQuery.data ?? [],
    collectibles: collectiblesQuery.data ?? [],
    loading:
      accountsQuery.isLoading ||
      budgetQuery.isLoading ||
      (Boolean(budgetQuery.data) && linesQuery.isLoading) ||
      (Boolean(budgetQuery.data) && txnsQuery.isLoading) ||
      portfoliosQuery.isLoading ||
      holdingsQuery.isLoading ||
      collectiblesQuery.isLoading,
    error:
      accountsQuery.error ??
      budgetQuery.error ??
      linesQuery.error ??
      txnsQuery.error ??
      portfoliosQuery.error ??
      holdingsQuery.error ??
      collectiblesQuery.error,
    createAccount,
    updateAccount,
    deleteAccount,
    createLine,
    updateLine,
    deleteLine,
    saveBudgetPlan,
    createTxn,
    deleteTxn,
    clearBudget,
    applyStatementBudget,
    reclassifyTxns,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    createHolding,
    updateHolding,
    deleteHolding,
    importHoldings,
    refreshQuotes,
    createCollectible,
    updateCollectible,
    deleteCollectible,
  };
}
