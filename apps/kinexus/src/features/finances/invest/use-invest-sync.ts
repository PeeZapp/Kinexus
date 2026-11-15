import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo } from 'react';

import {
  canEditFinanceRecords,
  canEditInvestmentItem,
  canEditTradeEntry,
  canViewInvestmentItem,
  canViewTradeEntry,
  isAsxSymbol,
  normalizeAsxSymbol,
  parseMoney,
  type FinanceInvestmentAlert,
  type FinanceInvestmentItem,
  type FinanceTradeJournalEntry,
  type InvestmentAlertKind,
  type InvestmentStatus,
  type InvestmentVisibility,
  type TradeSide,
} from '@kinexus/domain';

import { fetchShareQuotes } from '@/src/features/finances/finance-api';
import { investAlertFromRow, investItemFromRow, tradeFromRow } from '@/src/features/finances/invest/mappers';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { supabase } from '@/src/lib/supabase';

const itemsKey = (householdId: string) => ['finances', 'invest', 'items', householdId] as const;
const alertsKey = (householdId: string) => ['finances', 'invest', 'alerts', householdId] as const;
const tradesKey = (householdId: string) => ['finances', 'invest', 'trades', householdId] as const;

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export type InvestItemDraft = {
  title: string;
  symbol: string;
  status: InvestmentStatus;
  visibility: InvestmentVisibility;
  thesis: string;
  notes: string;
  tags: string;
  targetPrice: string;
  stopPrice: string;
};

export type InvestAlertDraft = {
  kind: InvestmentAlertKind;
  threshold: string;
};

export type TradeDraft = {
  itemId: string | null;
  symbol: string;
  side: TradeSide;
  qty: string;
  price: string;
  fees: string;
  tradedOn: string;
  thesis: string;
  emotions: string;
  notes: string;
  visibility: InvestmentVisibility;
};

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().replace(/\s+/g, ' ').slice(0, 32);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}

function cleanSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase().replace(/\.AX$/, '').replace(/\s+/g, '');
  return symbol ? symbol.slice(0, 32) : null;
}

function optionalPrice(raw: string, label: string): number | null {
  if (!raw.trim()) return null;
  const value = parseMoney(raw);
  if (value == null || value < 0) throw new Error(`${label} must be a number`);
  return value;
}

export function useInvestSync() {
  const { activeHousehold, role } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const ready = Boolean(householdId && supabase && online);
  const access = useMemo(() => ({ role, userId }), [role, userId]);

  const itemsQuery = useQuery({
    queryKey: householdId ? itemsKey(householdId) : ['finances', 'invest', 'items', 'none'],
    enabled: ready,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as FinanceInvestmentItem[];
      const { data, error } = await supabase
        .from('finance_investment_items')
        .select('*')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false });
      throwIfError(error);
      return (data ?? []).map(investItemFromRow);
    },
  });

  const alertsQuery = useQuery({
    queryKey: householdId ? alertsKey(householdId) : ['finances', 'invest', 'alerts', 'none'],
    enabled: ready,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as FinanceInvestmentAlert[];
      const { data, error } = await supabase
        .from('finance_investment_alerts')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });
      throwIfError(error);
      return (data ?? []).map(investAlertFromRow);
    },
  });

  const tradesQuery = useQuery({
    queryKey: householdId ? tradesKey(householdId) : ['finances', 'invest', 'trades', 'none'],
    enabled: ready,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as FinanceTradeJournalEntry[];
      const { data, error } = await supabase
        .from('finance_trade_journal')
        .select('*')
        .eq('household_id', householdId)
        .order('traded_on', { ascending: false })
        .order('created_at', { ascending: false });
      throwIfError(error);
      return (data ?? []).map(tradeFromRow);
    },
  });

  useEffect(() => {
    if (!householdId || !online || !supabase) return;
    const client = supabase;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: alertsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: tradesKey(householdId) });
    };
    return retainPostgresChannel(client, `invest-sync:${householdId}`, (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_investment_items', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_investment_alerts', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_trade_journal', filter: `household_id=eq.${householdId}` }, invalidate),
    );
  }, [householdId, online, queryClient]);

  const items = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => canViewInvestmentItem(item, access)),
    [itemsQuery.data, access],
  );
  const visibleItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const alerts = useMemo(
    () => (alertsQuery.data ?? []).filter((alert) => visibleItemIds.has(alert.itemId)),
    [alertsQuery.data, visibleItemIds],
  );
  const trades = useMemo(
    () => (tradesQuery.data ?? []).filter((entry) => canViewTradeEntry(entry, access)),
    [tradesQuery.data, access],
  );

  const refreshPrices = useCallback(
    async (itemIds?: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const wantedIds = itemIds ? new Set(itemIds) : null;
      const targets = items.filter(
        (item) =>
          item.symbol &&
          isAsxSymbol(item.symbol) &&
          canEditInvestmentItem(item, access) &&
          (!wantedIds || wantedIds.has(item.id)),
      );
      const symbols = [...new Set(targets.map((item) => normalizeAsxSymbol(item.symbol)))];
      if (symbols.length === 0) return { updated: 0, missing: [] as string[] };
      const { quotes, missing } = await fetchShareQuotes(symbols);
      const bySymbol = new Map(quotes.map((quote) => [normalizeAsxSymbol(quote.symbol), quote]));
      const pricedAt = new Date().toISOString();
      let updated = 0;
      for (const item of targets) {
        const quote = bySymbol.get(normalizeAsxSymbol(item.symbol));
        if (!quote) continue;
        const { error } = await supabase
          .from('finance_investment_items')
          .update({ last_price: quote.price, last_price_at: pricedAt, currency: quote.currency || item.currency })
          .eq('id', item.id);
        throwIfError(error);
        updated += 1;
      }
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      return { updated, missing };
    },
    [access, householdId, items, queryClient],
  );

  /** Best-effort refresh for a single idea; never blocks a save. */
  const refreshAfterSave = useCallback(
    async (id: string, symbol: string | null) => {
      if (!symbol || !isAsxSymbol(symbol) || !householdId || !supabase) return;
      try {
        const { quotes } = await fetchShareQuotes([normalizeAsxSymbol(symbol)]);
        const quote = quotes[0];
        if (!quote) return;
        await supabase
          .from('finance_investment_items')
          .update({ last_price: quote.price, last_price_at: new Date().toISOString(), currency: quote.currency || 'AUD' })
          .eq('id', id);
        await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      } catch {
        // Idea is saved even if the quote feed is down.
      }
    },
    [householdId, queryClient],
  );

  const createItem = useCallback(
    async (draft: InvestItemDraft): Promise<string> => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!userId) throw new Error('Sign in to save ideas');
      const symbol = cleanSymbol(draft.symbol);
      const title = draft.title.trim() || symbol || '';
      if (!title) throw new Error('Add a name or symbol');
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('finance_investment_items').insert({
        id,
        household_id: householdId,
        created_by: userId,
        visibility: draft.visibility,
        symbol,
        title,
        thesis: draft.thesis.trim(),
        notes: draft.notes.trim(),
        tags: parseTags(draft.tags),
        status: draft.status,
        target_price: optionalPrice(draft.targetPrice, 'Target'),
        stop_price: optionalPrice(draft.stopPrice, 'Stop'),
        currency: activeHousehold?.currency || 'AUD',
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      await refreshAfterSave(id, symbol);
      return id;
    },
    [activeHousehold?.currency, householdId, queryClient, refreshAfterSave, userId],
  );

  const updateItem = useCallback(
    async (id: string, draft: InvestItemDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const existing = items.find((item) => item.id === id);
      const symbol = cleanSymbol(draft.symbol);
      const title = draft.title.trim() || symbol || '';
      if (!title) throw new Error('Add a name or symbol');
      const symbolChanged = (existing?.symbol ?? null) !== symbol;
      const { error } = await supabase
        .from('finance_investment_items')
        .update({
          visibility: draft.visibility,
          symbol,
          title,
          thesis: draft.thesis.trim(),
          notes: draft.notes.trim(),
          tags: parseTags(draft.tags),
          status: draft.status,
          target_price: optionalPrice(draft.targetPrice, 'Target'),
          stop_price: optionalPrice(draft.stopPrice, 'Stop'),
          ...(symbolChanged ? { last_price: null, last_price_at: null } : {}),
        })
        .eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      if (symbolChanged) await refreshAfterSave(id, symbol);
    },
    [householdId, items, queryClient, refreshAfterSave],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_investment_items').delete().eq('id', id);
      throwIfError(error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemsKey(householdId) }),
        queryClient.invalidateQueries({ queryKey: alertsKey(householdId) }),
        queryClient.invalidateQueries({ queryKey: tradesKey(householdId) }),
      ]);
    },
    [householdId, queryClient],
  );

  const createAlert = useCallback(
    async (itemId: string, draft: InvestAlertDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!userId) throw new Error('Sign in to save alerts');
      const threshold = parseMoney(draft.threshold);
      if (threshold == null || !(threshold > 0)) throw new Error('Enter a number above zero');
      const { error } = await supabase.from('finance_investment_alerts').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        item_id: itemId,
        created_by: userId,
        kind: draft.kind,
        threshold,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: alertsKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const setAlertActive = useCallback(
    async (id: string, active: boolean) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_investment_alerts').update({ active }).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: alertsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteAlert = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_investment_alerts').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: alertsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const tradeColumns = useCallback(
    (draft: TradeDraft) => {
      const linked = draft.itemId ? items.find((item) => item.id === draft.itemId) : null;
      const symbol = cleanSymbol(draft.symbol) ?? linked?.symbol ?? null;
      if (!symbol && !draft.itemId) throw new Error('Add a symbol or pick an idea');
      const qty = parseMoney(draft.qty);
      if (qty == null || !(qty > 0)) throw new Error('Quantity must be above zero');
      const price = parseMoney(draft.price);
      if (price == null || price < 0) throw new Error('Enter the trade price');
      const fees = draft.fees.trim() ? parseMoney(draft.fees) : 0;
      if (fees == null || fees < 0) throw new Error('Fees must be zero or more');
      const tradedOn = draft.tradedOn.trim() || todayIso();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradedOn) || Number.isNaN(Date.parse(tradedOn))) {
        throw new Error('Use a date like 2026-11-15');
      }
      return {
        visibility: draft.visibility,
        item_id: draft.itemId,
        symbol,
        side: draft.side,
        qty,
        price,
        fees,
        traded_on: tradedOn,
        thesis: draft.thesis.trim(),
        emotions: draft.emotions.trim(),
        notes: draft.notes.trim(),
      };
    },
    [items],
  );

  const createTrade = useCallback(
    async (draft: TradeDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!userId) throw new Error('Sign in to log trades');
      const columns = tradeColumns(draft);
      const { error } = await supabase.from('finance_trade_journal').insert({
        id: Crypto.randomUUID(),
        household_id: householdId,
        created_by: userId,
        ...columns,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: tradesKey(householdId) });
    },
    [householdId, queryClient, tradeColumns, userId],
  );

  const updateTrade = useCallback(
    async (id: string, draft: TradeDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_trade_journal').update(tradeColumns(draft)).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: tradesKey(householdId) });
    },
    [householdId, queryClient, tradeColumns],
  );

  const deleteTrade = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('finance_trade_journal').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: tradesKey(householdId) });
    },
    [householdId, queryClient],
  );

  const loading =
    ready && (itemsQuery.isLoading || alertsQuery.isLoading || tradesQuery.isLoading) &&
    !itemsQuery.data && !tradesQuery.data;
  const error = itemsQuery.error ?? alertsQuery.error ?? tradesQuery.error ?? null;

  return {
    householdId,
    role,
    userId,
    online,
    loading,
    error,
    canWrite: canEditFinanceRecords(role),
    canEditItem: (item: FinanceInvestmentItem) => canEditInvestmentItem(item, access),
    canEditTrade: (entry: FinanceTradeJournalEntry) => canEditTradeEntry(entry, access),
    items,
    alerts,
    trades,
    createItem,
    updateItem,
    deleteItem,
    refreshPrices,
    createAlert,
    setAlertActive,
    deleteAlert,
    createTrade,
    updateTrade,
    deleteTrade,
  };
}

export type InvestSync = ReturnType<typeof useInvestSync>;
