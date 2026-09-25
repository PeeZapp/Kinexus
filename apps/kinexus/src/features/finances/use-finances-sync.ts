import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef } from 'react';

import type { Database } from '@kinexus/db';
import {
  formatHolderId,
  holderIdKind,
  isAsxSymbol,
  isCryptoSymbol,
  isMetalKind,
  isMetalUnit,
  parseMetalPremium,
  parseMetalQuantity,
  parseMetalWeight,
  evalMoneyExpression,
  merchantKey,
  nextLinePosition,
  normalizeAnchorMonth,
  normalizeAsxSymbol,
  normalizeCryptoSymbol,
  normalizeBudgetCadence,
  parseMoney,
  canManageFinances,
  missingAutoApplyTxns,
  monthStartIso,
  movedBudgetLinePositions,
  looksLikeSurplusCaptureName,
  surplusAllocateActions,
  surplusCaptureLine,
  SURPLUS_ALLOCATE_DESCRIPTION,
  SURPLUS_ALLOCATE_MERCHANT_KEY,
  SURPLUS_CAPTURE_NAME,
  isBudgetSet,
  type ClassifiedStatementTxn,
  type ProposedBudgetLine,
  type StatementAssignment,
  type FinanceAccount,
  type FinanceAccountKind,
  type FinanceBudgetLine,
  type FinanceBudgetLineCadence,
  type FinanceBudgetLineKind,
  type CollectibleCondition,
  type CollectibleKind,
  type CollectibleSource,
  type MetalKind,
  type MetalUnit,
  type ShareImportResult,
} from '@kinexus/domain';

import { accountFromRow, budgetFromRow, collectibleFromRow, cryptoHoldingFromRow, holdingFromRow, lineFromRow, metalHoldingFromRow, portfolioFromRow, txnFromRow } from '@/src/features/finances/mappers';
import { fetchCryptoQuotes, fetchMetalQuotes, fetchShareQuotes } from '@/src/features/finances/finance-api';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { retainPostgresChannel } from '@/src/lib/realtime';
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
function cryptoHoldingsKey(householdId: string) {
  return ['finances', 'crypto-holdings', householdId] as const;
}
function metalHoldingsKey(householdId: string) {
  return ['finances', 'metal-holdings', householdId] as const;
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
  cadence?: FinanceBudgetLineCadence;
  anchorMonth?: number;
  parentId?: string | null;
  autoApply?: boolean;
  captureSurplus?: boolean;
};

function cadenceColumns(draft: Pick<BudgetLineDraft, 'cadence' | 'anchorMonth'>): {
  cadence: FinanceBudgetLineCadence;
  anchor_month: number;
} {
  const cadence = normalizeBudgetCadence(draft.cadence);
  return {
    cadence,
    anchor_month: cadence === 'monthly' ? 1 : normalizeAnchorMonth(draft.anchorMonth),
  };
}

function lineWriteColumns(draft: BudgetLineDraft) {
  const captureSurplus = Boolean(draft.captureSurplus) && draft.kind === 'expense' && !draft.parentId;
  return {
    ...cadenceColumns(draft),
    parent_id: captureSurplus ? null : draft.parentId ?? null,
    auto_apply: captureSurplus ? false : Boolean(draft.autoApply),
    capture_surplus: captureSurplus,
  };
}

function asLine(
  partial: Omit<FinanceBudgetLine, 'planned' | 'spent' | 'position' | 'cadence' | 'anchorMonth' | 'parentId' | 'autoApply' | 'autoAppliedMonth' | 'captureSurplus'> &
    Partial<FinanceBudgetLine>,
): FinanceBudgetLine {
  return {
    planned: 0,
    spent: 0,
    position: 0,
    cadence: 'monthly',
    anchorMonth: 1,
    parentId: null,
    autoApply: false,
    autoAppliedMonth: null,
    captureSurplus: false,
    ...partial,
  };
}

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

export type CryptoHoldingDraft = {
  symbol: string;
  units?: string;
  costPerUnit?: string;
  name?: string;
};

export type MetalHoldingDraft = {
  metal: MetalKind;
  weight?: string;
  quantity?: string;
  unit: MetalUnit;
  costPerUnit?: string;
  premiumPercent?: string;
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

async function fetchCryptoHoldings(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_crypto_holdings')
    .select('*')
    .eq('household_id', householdId)
    .order('symbol');
  if (error) throw error;
  return (data ?? []).map(cryptoHoldingFromRow);
}

async function fetchMetalHoldings(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('finance_metal_holdings')
    .select('*')
    .eq('household_id', householdId)
    .order('metal');
  if (error) throw error;
  return (data ?? []).map(metalHoldingFromRow);
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
  const { activeHousehold, role } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const currency = activeHousehold?.currency || 'AUD';
  const ready = Boolean(householdId && supabase && online);
  const autoApplyBusy = useRef(false);

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

  const cryptoHoldingsQuery = useQuery({
    queryKey: householdId ? cryptoHoldingsKey(householdId) : ['finances', 'crypto-holdings', 'none'],
    enabled: ready,
    queryFn: () => fetchCryptoHoldings(householdId!),
  });

  const metalHoldingsQuery = useQuery({
    queryKey: householdId ? metalHoldingsKey(householdId) : ['finances', 'metal-holdings', 'none'],
    enabled: ready,
    queryFn: () => fetchMetalHoldings(householdId!),
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
      void queryClient.invalidateQueries({ queryKey: cryptoHoldingsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: metalHoldingsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: collectiblesKey(householdId) });
    };
    return retainPostgresChannel(client, `finances-sync:${householdId}`, (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_accounts', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budgets', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budget_lines', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budget_txns', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_share_portfolios', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_share_holdings', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_crypto_holdings', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_metal_holdings', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_collectibles', filter: `household_id=eq.${householdId}` }, invalidate),
    );
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
      const lines = linesQuery.data ?? [];
      const parent = draft.parentId ? lines.find((item) => item.id === draft.parentId) : null;
      if (draft.parentId && !parent) throw new Error('That category is gone');
      if (parent?.parentId) throw new Error('Subcategories cannot have their own subcategories');
      const kind = parent?.kind ?? draft.kind;
      const columns = lineWriteColumns({ ...draft, kind, parentId: parent?.id ?? null });
      if (columns.capture_surplus) {
        const currentCapture = lines.find((item) => item.captureSurplus);
        if (currentCapture) {
          const { error: clearError } = await supabase
            .from('finance_budget_lines')
            .update({ capture_surplus: false })
            .eq('id', currentCapture.id);
          throwIfError(clearError);
        }
      }
      const { error } = await supabase.from('finance_budget_lines').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        budget_id: budgetQuery.data.id,
        kind,
        name,
        planned: parseMoney(draft.planned) ?? 0,
        spent: 0,
        position: nextLinePosition(lines, kind),
        ...columns,
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
      const lines = linesQuery.data ?? [];
      const current = lines.find((item) => item.id === id);
      if (!current) throw new Error('That line is gone');
      const parent = draft.parentId ? lines.find((item) => item.id === draft.parentId) : null;
      if (draft.parentId && !parent) throw new Error('That category is gone');
      if (parent?.parentId) throw new Error('Subcategories cannot have their own subcategories');
      if (parent && lines.some((item) => item.parentId === id)) {
        throw new Error('Move or remove subcategories before nesting this one');
      }
      const kind = parent?.kind ?? draft.kind;
      const columns = lineWriteColumns({ ...draft, kind, parentId: parent?.id ?? null });
      if (columns.capture_surplus) {
        const currentCapture = lines.find((item) => item.captureSurplus && item.id !== id);
        if (currentCapture) {
          const { error: clearError } = await supabase
            .from('finance_budget_lines')
            .update({ capture_surplus: false })
            .eq('id', currentCapture.id);
          throwIfError(clearError);
        }
      }
      const { error } = await supabase
        .from('finance_budget_lines')
        .update({
          kind,
          name,
          planned: parseMoney(draft.planned) ?? 0,
          ...columns,
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
    },
    [householdId, linesQuery.data, queryClient],
  );

  const deleteLine = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const lines = linesQuery.data ?? [];
      const current = lines.find((line) => line.id === id);
      if (!current) throw new Error('That line is gone');
      const removing = [current, ...lines.filter((line) => line.parentId === id)];
      const leftoverName = current.kind === 'income' ? 'Other income' : 'Other';
      const isFallback = current.name.trim().toLowerCase() === leftoverName.toLowerCase() && !current.parentId;
      const remaining = lines.filter((line) => !removing.some((item) => item.id === line.id));
      for (const item of removing) {
        const { error: surplusError } = await supabase
          .from('finance_budget_txns')
          .delete()
          .eq('line_id', item.id)
          .eq('merchant_key', SURPLUS_ALLOCATE_MERCHANT_KEY);
        throwIfError(surplusError);
      }
      let fallback = remaining.find(
        (line) => line.kind === current.kind && !line.parentId && line.name.trim().toLowerCase() === leftoverName.toLowerCase(),
      );
      if (isFallback) {
        for (const item of removing) {
          const { error: ignoreError } = await supabase
            .from('finance_budget_txns')
            .update({ line_id: null, ignored: true })
            .eq('line_id', item.id);
          throwIfError(ignoreError);
        }
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
            cadence: 'monthly',
            anchor_month: 1,
            parent_id: null,
            auto_apply: false,
            capture_surplus: false,
          });
          throwIfError(insertError);
          fallback = asLine({
            id: fallbackId,
            householdId,
            budgetId: budgetQuery.data.id,
            kind: current.kind,
            name: leftoverName,
            position,
          });
          remaining.push(fallback);
        }
        if (fallback) {
          for (const item of removing) {
            const { error: moveError } = await supabase
              .from('finance_budget_txns')
              .update({ line_id: fallback.id, ignored: false })
              .eq('line_id', item.id);
            throwIfError(moveError);
          }
        }
      }
      for (const item of removing.filter((line) => line.parentId === id)) {
        const { error } = await supabase.from('finance_budget_lines').delete().eq('id', item.id);
        throwIfError(error);
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

  const moveLine = useCallback(
    async (id: string, direction: -1 | 1, amongIds?: readonly string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const patches = movedBudgetLinePositions(linesQuery.data ?? [], id, direction, amongIds);
      if (patches.length === 0) return;
      queryClient.setQueryData(linesKey(householdId), (current: FinanceBudgetLine[] | undefined) => {
        if (!current) return current;
        const next = new Map(patches.map((patch) => [patch.id, patch.position]));
        return current.map((line) => (next.has(line.id) ? { ...line, position: next.get(line.id)! } : line));
      });
      try {
        for (const patch of patches) {
          const { error } = await supabase.from('finance_budget_lines').update({ position: patch.position }).eq('id', patch.id);
          throwIfError(error);
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      }
    },
    [householdId, linesQuery.data, queryClient],
  );

  const saveBudgetPlan = useCallback(
    async (drafts: readonly BudgetLineDraft[]) => {
      if (!householdId || !supabase || !budgetQuery.data) throw new Error('Not ready');
      const budgetId = budgetQuery.data.id;
      const named = drafts
        .map((draft) => {
          const cadence = cadenceColumns(draft);
          return {
            id: draft.id,
            kind: draft.kind,
            name: draft.name.trim(),
            planned: Math.max(0, parseMoney(draft.planned) ?? 0),
            cadence: cadence.cadence,
            anchorMonth: cadence.anchor_month,
            parentId: draft.parentId ?? null,
            autoApply: Boolean(draft.autoApply),
            captureSurplus: Boolean(draft.captureSurplus) && draft.kind === 'expense' && !draft.parentId,
          };
        })
        .filter((draft) => draft.name);
      const captureIndex = [...named].reverse().findIndex((draft) => draft.captureSurplus);
      const keepCapture = captureIndex < 0 ? -1 : named.length - 1 - captureIndex;
      const exclusive = named.map((draft, index) => {
        const captureSurplus = index === keepCapture;
        return {
          ...draft,
          captureSurplus,
          autoApply: captureSurplus ? false : draft.autoApply,
          parentId: captureSurplus ? null : draft.parentId,
        };
      });
      const counts = new Map<string, number>();
      const prepared = exclusive.map((draft) => {
        const key = `${draft.kind}:${draft.parentId ?? ''}`;
        const position = counts.get(key) ?? 0;
        counts.set(key, position + 1);
        return { ...draft, position };
      });
      prepared.sort(
        (a, b) =>
          Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) ||
          Number(a.captureSurplus) - Number(b.captureSurplus),
      );
      if (prepared.length === 0) throw new Error('Add at least one category');
      const existing = [...(linesQuery.data ?? [])];
      const currentCapture = existing.find((line) => line.captureSurplus);
      if (currentCapture) {
        const { error: clearError } = await supabase
          .from('finance_budget_lines')
          .update({ capture_surplus: false })
          .eq('id', currentCapture.id);
        throwIfError(clearError);
        currentCapture.captureSurplus = false;
      }
      const used = new Set<string>();
      for (const draft of prepared) {
        const match =
          (draft.id ? existing.find((line) => line.id === draft.id && !used.has(line.id)) : undefined) ??
          existing.find(
            (line) =>
              !used.has(line.id) &&
              line.kind === draft.kind &&
              line.parentId === draft.parentId &&
              line.name.trim().toLowerCase() === draft.name.toLowerCase(),
          );
        if (match) {
          used.add(match.id);
          if (
            match.kind !== draft.kind ||
            match.name !== draft.name ||
            match.planned !== draft.planned ||
            match.cadence !== draft.cadence ||
            match.anchorMonth !== draft.anchorMonth ||
            match.parentId !== draft.parentId ||
            match.autoApply !== draft.autoApply ||
            match.captureSurplus !== draft.captureSurplus ||
            match.position !== draft.position
          ) {
            const { error } = await supabase
              .from('finance_budget_lines')
              .update({
                kind: draft.kind,
                name: draft.name,
                planned: draft.planned,
                cadence: draft.cadence,
                anchor_month: draft.anchorMonth,
                parent_id: draft.parentId,
                auto_apply: draft.autoApply,
                capture_surplus: draft.captureSurplus,
                position: draft.position,
              })
              .eq('id', match.id);
            throwIfError(error);
            match.kind = draft.kind;
            match.name = draft.name;
            match.planned = draft.planned;
            match.cadence = draft.cadence;
            match.anchorMonth = draft.anchorMonth;
            match.parentId = draft.parentId;
            match.autoApply = draft.autoApply;
            match.captureSurplus = draft.captureSurplus;
            match.position = draft.position;
          }
          continue;
        }
        const id = draft.id ?? Crypto.randomUUID();
        const { error } = await supabase.from('finance_budget_lines').insert({
          id,
          household_id: householdId,
          budget_id: budgetId,
          kind: draft.kind,
          name: draft.name,
          planned: draft.planned,
          spent: 0,
          position: draft.position,
          cadence: draft.cadence,
          anchor_month: draft.anchorMonth,
          parent_id: draft.parentId,
          auto_apply: draft.autoApply,
          capture_surplus: draft.captureSurplus,
        });
        throwIfError(error);
        existing.push(
          asLine({
            id,
            householdId,
            budgetId,
            kind: draft.kind,
            name: draft.name,
            planned: draft.planned,
            position: draft.position,
            cadence: draft.cadence,
            anchorMonth: draft.anchorMonth,
            parentId: draft.parentId,
            autoApply: draft.autoApply,
            captureSurplus: draft.captureSurplus,
          }),
        );
        used.add(id);
      }
      const unused = existing.filter((line) => !used.has(line.id));
      for (const line of [...unused.filter((item) => item.parentId), ...unused.filter((item) => !item.parentId)]) {
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
        source: 'manual',
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
          cadence: 'monthly',
          anchor_month: 1,
        });
        throwIfError(error);
        existing.push(
          asLine({
            id,
            householdId,
            budgetId,
            kind: proposed.kind,
            name,
            planned: input.setPlanned ? proposed.spent : 0,
            spent: proposed.spent,
            position,
          }),
        );
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
          source: 'import',
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
            cadence: 'monthly',
            anchor_month: 1,
          });
          throwIfError(error);
          match = asLine({
            id,
            householdId,
            budgetId: budgetQuery.data.id,
            kind: input.assignment.kind,
            name,
            position,
          });
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

  const createCryptoHolding = useCallback(
    async (draft: CryptoHoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const symbol = normalizeCryptoSymbol(draft.symbol);
      if (!isCryptoSymbol(symbol)) throw new Error('Use a crypto code like BTC or ETH');
      const units = parseMoney(draft.units) ?? 0;
      if (units < 0) throw new Error('Units cannot be negative');
      const { error } = await supabase.from('finance_crypto_holdings').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        symbol,
        name: draft.name?.trim() || null,
        units,
        cost_per_unit: parseMoney(draft.costPerUnit),
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: cryptoHoldingsKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const updateCryptoHolding = useCallback(
    async (id: string, draft: CryptoHoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const symbol = normalizeCryptoSymbol(draft.symbol);
      if (!isCryptoSymbol(symbol)) throw new Error('Use a crypto code like BTC or ETH');
      const units = parseMoney(draft.units) ?? 0;
      if (units < 0) throw new Error('Units cannot be negative');
      const { error } = await supabase
        .from('finance_crypto_holdings')
        .update({
          symbol,
          name: draft.name?.trim() || null,
          units,
          cost_per_unit: parseMoney(draft.costPerUnit),
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: cryptoHoldingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteCryptoHolding = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_crypto_holdings').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: cryptoHoldingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const refreshCryptoQuotes = useCallback(
    async (symbols?: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const holdings = cryptoHoldingsQuery.data ?? [];
      const wanted = [
        ...new Set((symbols ?? holdings.map((item) => item.symbol)).map(normalizeCryptoSymbol).filter(Boolean)),
      ];
      if (wanted.length === 0) return { updated: 0, missing: [] as string[] };
      const { quotes, missing } = await fetchCryptoQuotes(wanted, currency);
      const pricedAt = new Date().toISOString();
      for (const quote of quotes) {
        const { error } = await supabase
          .from('finance_crypto_holdings')
          .update({
            last_price: quote.price,
            priced_at: pricedAt,
            ...(quote.name ? { name: quote.name } : {}),
          })
          .eq('household_id', householdId)
          .eq('symbol', quote.symbol);
        throwIfError(error);
      }
      await queryClient.invalidateQueries({ queryKey: cryptoHoldingsKey(householdId) });
      return { updated: quotes.length, missing };
    },
    [cryptoHoldingsQuery.data, currency, householdId, queryClient],
  );

  const createMetalHolding = useCallback(
    async (draft: MetalHoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!isMetalKind(draft.metal)) throw new Error('Choose gold, silver, platinum, or palladium');
      if (!isMetalUnit(draft.unit)) throw new Error('Choose troy ounces, grams, or kilograms');
      const weight = parseMetalWeight(draft.weight);
      if (weight == null || weight <= 0) throw new Error('Enter a weight greater than zero');
      const quantity = parseMetalQuantity(draft.quantity);
      if (quantity == null) throw new Error('Enter how many you have, at least 1');
      const premiumPercent = parseMetalPremium(draft.premiumPercent);
      if (premiumPercent == null) throw new Error('Premium cannot be below -100%');
      const { error } = await supabase.from('finance_metal_holdings').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        metal: draft.metal,
        name: draft.name?.trim() || null,
        weight,
        unit: draft.unit,
        quantity,
        cost_per_unit: parseMoney(draft.costPerUnit),
        premium_percent: premiumPercent,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: metalHoldingsKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const updateMetalHolding = useCallback(
    async (id: string, draft: MetalHoldingDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!isMetalKind(draft.metal)) throw new Error('Choose gold, silver, platinum, or palladium');
      if (!isMetalUnit(draft.unit)) throw new Error('Choose troy ounces, grams, or kilograms');
      const weight = parseMetalWeight(draft.weight);
      if (weight == null || weight <= 0) throw new Error('Enter a weight greater than zero');
      const quantity = parseMetalQuantity(draft.quantity);
      if (quantity == null) throw new Error('Enter how many you have, at least 1');
      const premiumPercent = parseMetalPremium(draft.premiumPercent);
      if (premiumPercent == null) throw new Error('Premium cannot be below -100%');
      const { error } = await supabase
        .from('finance_metal_holdings')
        .update({
          metal: draft.metal,
          name: draft.name?.trim() || null,
          weight,
          unit: draft.unit,
          quantity,
          cost_per_unit: parseMoney(draft.costPerUnit),
          premium_percent: premiumPercent,
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: metalHoldingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteMetalHolding = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_metal_holdings').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: metalHoldingsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const refreshMetalQuotes = useCallback(
    async (metals?: MetalKind[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const holdings = metalHoldingsQuery.data ?? [];
      const wanted = [...new Set((metals ?? holdings.map((item) => item.metal)).filter(isMetalKind))];
      if (wanted.length === 0) return { updated: 0, missing: [] as string[] };
      const { quotes, missing } = await fetchMetalQuotes(wanted, currency);
      const pricedAt = new Date().toISOString();
      for (const quote of quotes) {
        const { error } = await supabase
          .from('finance_metal_holdings')
          .update({
            last_price: quote.price,
            priced_at: pricedAt,
          })
          .eq('household_id', householdId)
          .eq('metal', quote.metal);
        throwIfError(error);
      }
      await queryClient.invalidateQueries({ queryKey: metalHoldingsKey(householdId) });
      return { updated: quotes.length, missing };
    },
    [currency, householdId, metalHoldingsQuery.data, queryClient],
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

  const applyAutoDebits = useCallback(
    async (monthStart: string = monthStartIso()) => {
      if (!householdId || !supabase || !budgetQuery.data) return;
      if (!canManageFinances(role)) return;
      const lines = linesQuery.data ?? [];
      const txns = txnsQuery.data ?? [];
      const drafts = missingAutoApplyTxns(lines, txns, monthStart);
      if (drafts.length === 0) return;
      for (const draft of drafts) {
        const line = lines.find((item) => item.id === draft.lineId);
        if (!line) continue;
        const signed = line.kind === 'income' ? draft.amount : -draft.amount;
        const { error } = await supabase.from('finance_budget_txns').insert({
          id: Crypto.randomUUID(),
          household_id: householdId,
          budget_id: budgetQuery.data.id,
          line_id: line.id,
          txn_date: draft.date,
          description: draft.description,
          merchant_key: draft.merchantKey,
          amount: signed,
          ignored: false,
          source: 'auto',
        });
        if (error && error.code === '23505') continue;
        throwIfError(error);
        const { error: stampError } = await supabase
          .from('finance_budget_lines')
          .update({ auto_applied_month: monthStart })
          .eq('id', line.id);
        throwIfError(stampError);
      }
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient, role, txnsQuery.data],
  );

  const applySurplusCapture = useCallback(
    async () => {
      if (!householdId || !supabase || !budgetQuery.data) return;
      if (!canManageFinances(role)) return;
      let lines = [...(linesQuery.data ?? [])];
      const txns = txnsQuery.data ?? [];
      if (!isBudgetSet(lines, txns, budgetQuery.data.setupCompletedAt)) return;
      let sink = surplusCaptureLine(lines);
      if (!sink) {
        const named = lines.find(
          (line) => line.kind === 'expense' && !line.parentId && looksLikeSurplusCaptureName(line.name),
        );
        if (named) {
          const { error } = await supabase
            .from('finance_budget_lines')
            .update({ capture_surplus: true, auto_apply: false, parent_id: null })
            .eq('id', named.id);
          throwIfError(error);
          sink = { ...named, captureSurplus: true, autoApply: false, parentId: null };
          lines = lines.map((line) => (line.id === named.id ? sink! : { ...line, captureSurplus: false }));
        } else {
          const id = Crypto.randomUUID();
          const position = nextLinePosition(lines, 'expense');
          const { error } = await supabase.from('finance_budget_lines').insert({
            id,
            household_id: householdId,
            budget_id: budgetQuery.data.id,
            kind: 'expense',
            name: SURPLUS_CAPTURE_NAME,
            planned: 0,
            spent: 0,
            position,
            cadence: 'monthly',
            anchor_month: 1,
            parent_id: null,
            auto_apply: false,
            capture_surplus: true,
          });
          throwIfError(error);
          sink = asLine({
            id,
            householdId,
            budgetId: budgetQuery.data.id,
            kind: 'expense',
            name: SURPLUS_CAPTURE_NAME,
            position,
            captureSurplus: true,
          });
          lines = [...lines, sink];
        }
      }
      const actions = surplusAllocateActions(lines, txns);
      if (actions.length === 0) return;
      for (const action of actions) {
        if (action.action === 'insert') {
          const { error } = await supabase.from('finance_budget_txns').insert({
            id: Crypto.randomUUID(),
            household_id: householdId,
            budget_id: budgetQuery.data.id,
            line_id: action.lineId,
            txn_date: action.monthStart,
            description: SURPLUS_ALLOCATE_DESCRIPTION,
            merchant_key: SURPLUS_ALLOCATE_MERCHANT_KEY,
            amount: -action.amount,
            ignored: false,
            source: 'auto',
          });
          if (error && error.code === '23505') continue;
          throwIfError(error);
          continue;
        }
        if (action.action === 'update' && action.txnId) {
          const { error } = await supabase
            .from('finance_budget_txns')
            .update({
              amount: -action.amount,
              description: SURPLUS_ALLOCATE_DESCRIPTION,
              merchant_key: SURPLUS_ALLOCATE_MERCHANT_KEY,
              ignored: false,
              source: 'auto',
            })
            .eq('id', action.txnId);
          throwIfError(error);
          continue;
        }
        if (action.action === 'delete' && action.txnId) {
          const { error } = await supabase.from('finance_budget_txns').delete().eq('id', action.txnId);
          throwIfError(error);
        }
      }
      await queryClient.invalidateQueries({ queryKey: linesKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: txnsKey(householdId) });
    },
    [budgetQuery.data, householdId, linesQuery.data, queryClient, role, txnsQuery.data],
  );

  useEffect(() => {
    if (!ready || !canManageFinances(role) || autoApplyBusy.current) return;
    if (!linesQuery.data || !txnsQuery.data || !budgetQuery.data) return;
    const lines = linesQuery.data;
    const txns = txnsQuery.data;
    if (!isBudgetSet(lines, txns, budgetQuery.data.setupCompletedAt)) return;
    const needsDebit = missingAutoApplyTxns(lines, txns, monthStartIso()).length > 0;
    const needsSurplus = !surplusCaptureLine(lines) || surplusAllocateActions(lines, txns).length > 0;
    if (!needsDebit && !needsSurplus) return;
    autoApplyBusy.current = true;
    void (async () => {
      await applyAutoDebits();
      await applySurplusCapture();
    })()
      .catch(() => undefined)
      .finally(() => {
        autoApplyBusy.current = false;
      });
  }, [applyAutoDebits, applySurplusCapture, budgetQuery.data, linesQuery.data, ready, role, txnsQuery.data]);

  return {
    currency,
    online,
    accounts: accountsQuery.data ?? [],
    budget: budgetQuery.data ?? null,
    lines: linesQuery.data ?? [],
    txns: txnsQuery.data ?? [],
    portfolios: portfoliosQuery.data ?? [],
    holdings: holdingsQuery.data ?? [],
    cryptoHoldings: cryptoHoldingsQuery.data ?? [],
    metalHoldings: metalHoldingsQuery.data ?? [],
    collectibles: collectiblesQuery.data ?? [],
    loading:
      accountsQuery.isLoading ||
      budgetQuery.isLoading ||
      (Boolean(budgetQuery.data) && linesQuery.isLoading) ||
      (Boolean(budgetQuery.data) && txnsQuery.isLoading) ||
      portfoliosQuery.isLoading ||
      holdingsQuery.isLoading ||
      cryptoHoldingsQuery.isLoading ||
      metalHoldingsQuery.isLoading ||
      collectiblesQuery.isLoading,
    error:
      accountsQuery.error ??
      budgetQuery.error ??
      linesQuery.error ??
      txnsQuery.error ??
      portfoliosQuery.error ??
      holdingsQuery.error ??
      cryptoHoldingsQuery.error ??
      metalHoldingsQuery.error ??
      collectiblesQuery.error,
    createAccount,
    updateAccount,
    deleteAccount,
    createLine,
    updateLine,
    deleteLine,
    moveLine,
    saveBudgetPlan,
    createTxn,
    deleteTxn,
    clearBudget,
    applyAutoDebits,
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
    createCryptoHolding,
    updateCryptoHolding,
    deleteCryptoHolding,
    refreshCryptoQuotes,
    createMetalHolding,
    updateMetalHolding,
    deleteMetalHolding,
    refreshMetalQuotes,
    createCollectible,
    updateCollectible,
    deleteCollectible,
  };
}
