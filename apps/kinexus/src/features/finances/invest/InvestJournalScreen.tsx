import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TRADE_SIDES, formatMoney, tradeJournalSummary, type FinanceTradeJournalEntry, type TradeSide } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome, StatCard } from '@/src/features/finances/FinancesShared';
import { TradeSheet, ideaLabel, investStyles, tradeLabel } from '@/src/features/finances/invest/invest-ui';
import { useInvestSync, type TradeDraft } from '@/src/features/finances/invest/use-invest-sync';
import { actionErrorMessage } from '@/src/features/finances/use-finances-sync';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const SIDE_LABEL: Record<TradeSide, string> = { buy: 'Buy', sell: 'Sell' };

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function InvestJournalScreen() {
  const { mode } = useExperienceMode();
  const { activeHousehold } = useHousehold();
  const invest = useInvestSync();
  const desktop = mode === 'desktop';
  const currency = activeHousehold?.currency || 'AUD';
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTradeJournalEntry | null>(null);
  const [side, setSide] = useState<TradeSide | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(invest.items.map((item) => [item.id, item])), [invest.items]);
  const labelFor = (entry: FinanceTradeJournalEntry) => tradeLabel(entry, entry.itemId ? itemsById.get(entry.itemId) : null);

  const symbols = useMemo(
    () => [...new Set(invest.trades.map((entry) => labelFor(entry)))].sort((a, b) => a.localeCompare(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invest.trades, itemsById],
  );

  const visible = useMemo(
    () =>
      invest.trades.filter(
        (entry) => (!side || entry.side === side) && (!symbol || labelFor(entry) === symbol),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invest.trades, side, symbol, itemsById],
  );

  // P/L needs buys and sells together, so the side filter only narrows the list.
  const summary = useMemo(
    () => tradeJournalSummary(invest.trades.filter((entry) => !symbol || labelFor(entry) === symbol)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invest.trades, symbol, itemsById],
  );

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(actionErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openSheet(entry: FinanceTradeJournalEntry | null) {
    setActionError(null);
    setEditing(entry);
    setSheetOpen(true);
  }

  if (invest.loading && invest.trades.length === 0) return <LoadingState label="Loading journal…" />;

  const pnl = summary.realizedPnl;

  return (
    <>
      <FinancesChrome desktop={desktop} kicker="Trades" title="Journal">
        <ErrorText message={invest.error ? actionErrorMessage(invest.error) : actionError} />
        {invest.canWrite ? (
          <View style={investStyles.actions}>
            <Btn label="Log trade" onPress={() => openSheet(null)} disabled={!invest.online} />
          </View>
        ) : null}
        {invest.trades.length === 0 ? (
          <EmptyState
            title="No trades yet"
            body={invest.canWrite ? 'Log a buy or sell to track P/L.' : 'Ask a household adult to log trades.'}>
            {invest.canWrite ? <Btn label="Log trade" onPress={() => openSheet(null)} disabled={!invest.online} /> : null}
          </EmptyState>
        ) : (
          <>
            <View style={styles.stats}>
              <StatCard
                label="Realized P/L"
                value={pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${formatMoney(pnl, currency)}`}
              />
              <StatCard label="Bought" value={formatMoney(summary.buys, currency)} />
              <StatCard label="Sold" value={formatMoney(summary.sells, currency)} />
              <StatCard label="Fees" value={formatMoney(summary.fees, currency)} />
            </View>
            <FilterBar>
              <FilterDropdown<TradeSide | null>
                id="side"
                label="Side"
                value={side}
                valueLabel={side ? SIDE_LABEL[side] : 'All'}
                open={openMenu === 'side'}
                options={[{ value: null, label: 'All' }, ...TRADE_SIDES.map((value) => ({ value, label: SIDE_LABEL[value] }))]}
                onToggle={toggleMenu}
                onSelect={pick(setSide)}
              />
              {symbols.length > 1 ? (
                <FilterDropdown<string | null>
                  id="symbol"
                  label="Symbol"
                  value={symbol}
                  valueLabel={symbol ?? 'All'}
                  open={openMenu === 'symbol'}
                  options={[{ value: null, label: 'All' }, ...symbols.map((value) => ({ value, label: value }))]}
                  onToggle={toggleMenu}
                  onSelect={pick(setSymbol)}
                />
              ) : null}
            </FilterBar>
            <View style={investStyles.card}>
              {visible.length === 0 ? (
                <Text style={investStyles.meta}>Nothing matches these filters.</Text>
              ) : (
                visible.map((entry, index) => {
                  const idea = entry.itemId ? itemsById.get(entry.itemId) : null;
                  return (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      onPress={() => openSheet(entry)}
                      style={({ pressed }) => [investStyles.rowItem, index === 0 && styles.rowFirst, pressed && styles.pressed]}>
                      <View style={investStyles.rowCopy}>
                        <View style={styles.titleLine}>
                          <Text style={[styles.side, entry.side === 'buy' ? investStyles.gain : styles.sell]}>
                            {SIDE_LABEL[entry.side]}
                          </Text>
                          <Text style={investStyles.symbol} numberOfLines={1}>
                            {labelFor(entry)}
                          </Text>
                          {entry.visibility === 'private' ? <Text style={styles.private}>Private</Text> : null}
                        </View>
                        <Text style={investStyles.meta} numberOfLines={1}>
                          {shortDate(entry.tradedOn)} · {entry.qty} @ {formatMoney(entry.price, currency)}
                          {idea && entry.symbol && idea.symbol !== entry.symbol ? ` · ${ideaLabel(idea)}` : ''}
                        </Text>
                        {entry.thesis ? (
                          <Text style={styles.thesis} numberOfLines={2}>
                            {entry.thesis}
                          </Text>
                        ) : null}
                      </View>
                      <View style={investStyles.rowValue}>
                        <Text style={investStyles.value}>{formatMoney(entry.qty * entry.price, currency)}</Text>
                        {entry.fees > 0 ? (
                          <Text style={investStyles.meta}>Fees {formatMoney(entry.fees, currency)}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
        )}
      </FinancesChrome>
      <TradeSheet
        visible={sheetOpen}
        entry={editing}
        items={invest.items}
        busy={busy}
        error={actionError}
        readOnly={editing ? !invest.canEditTrade(editing) : !invest.canWrite}
        onClose={() => {
          setSheetOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: TradeDraft) => {
          const ok = await run(() => (editing ? invest.updateTrade(editing.id, draft) : invest.createTrade(draft)));
          if (ok) setSheetOpen(false);
        }}
        onDelete={
          editing && invest.canEditTrade(editing)
            ? async () => {
                const ok = await run(() => invest.deleteTrade(editing.id));
                if (ok) setSheetOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowFirst: { borderTopWidth: 0, paddingTop: 4 },
  pressed: { opacity: 0.8 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  side: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  sell: { color: colors.warning },
  private: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  thesis: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
