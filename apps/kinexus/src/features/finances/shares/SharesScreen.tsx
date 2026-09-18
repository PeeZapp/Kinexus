import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { canManageFinances, formatMoney, holderIdLabel, holdingMarketValue, holdingsForPortfolio, portfolioTotals, type FinanceShareHolding, type FinanceSharePortfolio } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import { HoldingSheet, ImportHoldingsSheet, PortfolioSheet } from '@/src/features/finances/sheets';
import {
  actionErrorMessage,
  useFinancesSync,
  type HoldingDraft,
  type PortfolioDraft,
} from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function SharesScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<FinanceSharePortfolio | null>(null);
  const [editingHolding, setEditingHolding] = useState<FinanceShareHolding | null>(null);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const totals = useMemo(() => portfolioTotals(finances.holdings), [finances.holdings]);
  const selectedId = activePortfolioId && finances.portfolios.some((item) => item.id === activePortfolioId)
    ? activePortfolioId
    : finances.portfolios[0]?.id ?? null;
  const selected = finances.portfolios.find((item) => item.id === selectedId) ?? null;
  const selectedHoldings = useMemo(
    () => (selected ? holdingsForPortfolio(selected.id, finances.holdings) : []),
    [finances.holdings, selected],
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

  if (finances.loading && finances.portfolios.length === 0 && finances.holdings.length === 0) {
    return <LoadingState label="Loading shares…" />;
  }

  return (
    <>
      <FinancesChrome
        desktop={desktop}
        kicker="ASX"
        title="Shares"
        subtitle="Track listed holdings by ASX code. Import a CommSec CSV or CHESS statement, then refresh prices. A HIN is stored on the portfolio — it cannot pull holdings on its own.">
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Portfolio value</Text>
          <Text style={styles.summaryValue}>{formatMoney(totals.marketValue, finances.currency)}</Text>
          <Text style={styles.meta}>
            Cost {formatMoney(totals.cost, finances.currency)}
            {totals.cost > 0 ? ` · ${totals.gain >= 0 ? '+' : ''}${formatMoney(totals.gain, finances.currency)}` : ''}
          </Text>
        </View>
        {canManage ? (
          <View style={styles.actions}>
            <Btn
              label="Import CSV / CHESS"
              onPress={() => setImportOpen(true)}
              disabled={!finances.online}
            />
            <Btn
              label="Add portfolio"
              variant="secondary"
              onPress={() => { setEditingPortfolio(null); setPortfolioOpen(true); }}
              disabled={!finances.online}
            />
            {selected ? (
              <Btn
                label="Add holding"
                variant="secondary"
                onPress={() => {
                  setEditingHolding(null);
                  setHoldingOpen(true);
                }}
                disabled={!finances.online}
              />
            ) : null}
            {finances.holdings.length > 0 ? (
              <Btn
                label={busy ? 'Refreshing…' : 'Refresh prices'}
                variant="secondary"
                onPress={() => void run(() => finances.refreshQuotes())}
                disabled={!finances.online || busy}
              />
            ) : null}
          </View>
        ) : null}
        {finances.portfolios.length === 0 ? (
          <EmptyState
            title="No share portfolios yet"
            body={
              canManage
                ? 'Import a CommSec CSV or CHESS statement. A portfolio is created for you if you do not have one yet.'
                : 'Ask a household admin to add the family’s share portfolios.'
            }>
            {canManage ? (
              <Btn label="Import CSV / CHESS" onPress={() => setImportOpen(true)} disabled={!finances.online} />
            ) : null}
          </EmptyState>
        ) : (
          <>
            <View style={styles.pills}>
              {finances.portfolios.map((portfolio) => (
                <Pressable
                  key={portfolio.id}
                  onPress={() => setActivePortfolioId(portfolio.id)}
                  style={[styles.pill, selectedId === portfolio.id && styles.pillActive]}>
                  <Text style={[styles.pillLabel, selectedId === portfolio.id && styles.pillLabelActive]}>{portfolio.name}</Text>
                </Pressable>
              ))}
            </View>
            {selected ? (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{selected.name}</Text>
                    <Text style={styles.meta}>
                      {selected.broker ? `${selected.broker} · ` : ''}
                      {selected.holderId
                        ? `${holderIdLabel(selected.holderKind)} ${selected.holderId}`
                        : 'No HIN saved'}
                    </Text>
                  </View>
                  {canManage ? (
                    <Btn
                      label="Settings"
                      variant="ghost"
                      onPress={() => {
                        setEditingPortfolio(selected);
                        setPortfolioOpen(true);
                      }}
                    />
                  ) : null}
                </View>
                {selectedHoldings.length === 0 ? (
                  <Text style={styles.meta}>No holdings yet. Import a CSV or CHESS statement, or add an ASX code.</Text>
                ) : (
                  selectedHoldings.map((holding) => (
                    <Pressable key={holding.id} onPress={() => { setEditingHolding(holding); setHoldingOpen(true); }} style={styles.row}>
                      <View style={styles.rowCopy}>
                        <Text style={styles.symbol}>{holding.symbol}</Text>
                        <Text style={styles.meta}>{holding.name || 'ASX'} · {holding.units} units</Text>
                      </View>
                      <View style={styles.rowValue}>
                        <Text style={styles.value}>{formatMoney(holdingMarketValue(holding), finances.currency)}</Text>
                        <Text style={styles.meta}>
                          {holding.lastPrice != null
                            ? formatMoney(holding.lastPrice, finances.currency)
                            : 'Unpriced'}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </>
        )}
      </FinancesChrome>
      <PortfolioSheet
        visible={portfolioOpen}
        portfolio={editingPortfolio}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => { setPortfolioOpen(false); setActionError(null); }}
        onSave={async (draft: PortfolioDraft) => {
          const ok = await run(() =>
            editingPortfolio ? finances.updatePortfolio(editingPortfolio.id, draft) : finances.createPortfolio(draft),
          );
          if (ok) setPortfolioOpen(false);
        }}
        onDelete={
          editingPortfolio
            ? async () => {
                const ok = await run(() => finances.deletePortfolio(editingPortfolio.id));
                if (ok) setPortfolioOpen(false);
              }
            : undefined
        }
      />
      <HoldingSheet
        visible={holdingOpen}
        holding={editingHolding}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => { setHoldingOpen(false); setActionError(null); }}
        onSave={async (draft: HoldingDraft) => {
          if (!selected) return;
          const ok = await run(async () => {
            if (editingHolding) await finances.updateHolding(editingHolding.id, draft);
            else await finances.createHolding(selected.id, draft);
            try {
              await finances.refreshQuotes([draft.symbol]);
            } catch {
              // Holding is saved even if the quote feed is down.
            }
          });
          if (ok) setHoldingOpen(false);
        }}
        onDelete={
          editingHolding
            ? async () => {
                const ok = await run(() => finances.deleteHolding(editingHolding.id));
                if (ok) setHoldingOpen(false);
              }
            : undefined
        }
      />
      <ImportHoldingsSheet
        visible={importOpen}
        portfolioName={selected?.name ?? 'a new portfolio'}
        hasHolderId={Boolean(selected?.holderId)}
        currency={finances.currency}
        busy={busy}
        error={actionError}
        onClose={() => { setImportOpen(false); setActionError(null); }}
        onImport={async (parsed) => {
          const ok = await run(async () => {
            const id = await finances.importHoldings(selected?.id ?? null, parsed);
            if (id) setActivePortfolioId(id);
          });
          if (ok) setImportOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 4,
  },
  summaryLabel: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  summaryValue: { color: colors.text, fontSize: 28, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  pillActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillLabel: { color: colors.textMuted, fontWeight: '700' },
  pillLabelActive: { color: colors.accent },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  symbol: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowValue: { alignItems: 'flex-end' },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
