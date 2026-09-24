import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  canManageFinances,
  cryptoHoldingMarketValue,
  cryptoPortfolioTotals,
  formatMoney,
  type FinanceCryptoHolding,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import { CryptoHoldingSheet } from '@/src/features/finances/sheets';
import {
  actionErrorMessage,
  useFinancesSync,
  type CryptoHoldingDraft,
} from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function CryptoScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCryptoHolding | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const totals = useMemo(() => cryptoPortfolioTotals(finances.cryptoHoldings), [finances.cryptoHoldings]);
  const sorted = useMemo(
    () =>
      [...finances.cryptoHoldings].sort((a, b) => {
        const valueDiff = cryptoHoldingMarketValue(b) - cryptoHoldingMarketValue(a);
        if (valueDiff !== 0) return valueDiff;
        return a.symbol.localeCompare(b.symbol);
      }),
    [finances.cryptoHoldings],
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

  if (finances.loading && finances.cryptoHoldings.length === 0) {
    return <LoadingState label="Loading crypto…" />;
  }

  return (
    <>
      <FinancesChrome
        desktop={desktop}
        kicker="Coins"
        title="Crypto">
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Crypto value</Text>
          <Text style={styles.summaryValue}>{formatMoney(totals.marketValue, finances.currency)}</Text>
          <Text style={styles.meta}>
            Cost {formatMoney(totals.cost, finances.currency)}
            {totals.cost > 0 ? ` · ${totals.gain >= 0 ? '+' : ''}${formatMoney(totals.gain, finances.currency)}` : ''}
          </Text>
        </View>
        {canManage ? (
          <View style={styles.actions}>
            <Btn
              label="Add holding"
              onPress={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
              disabled={!finances.online}
            />
            {finances.cryptoHoldings.length > 0 ? (
              <Btn
                label={busy ? 'Refreshing…' : 'Refresh prices'}
                variant="secondary"
                onPress={() => void run(() => finances.refreshCryptoQuotes())}
                disabled={!finances.online || busy}
              />
            ) : null}
          </View>
        ) : null}
        {sorted.length === 0 ? (
          <EmptyState
            title="No crypto yet"
            body={
              canManage
                ? 'Add coins like BTC or ETH with how much you hold and your average cost.'
                : 'Ask a household admin to add the family’s crypto holdings.'
            }>
            {canManage ? (
              <Btn
                label="Add holding"
                onPress={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}
                disabled={!finances.online}
              />
            ) : null}
          </EmptyState>
        ) : (
          <View style={styles.card}>
            {sorted.map((holding, index) => (
              <Pressable
                key={holding.id}
                onPress={() => {
                  if (!canManage) return;
                  setEditing(holding);
                  setSheetOpen(true);
                }}
                style={[styles.row, index === 0 && styles.rowFirst]}>
                <View style={styles.rowCopy}>
                  <Text style={styles.symbol}>{holding.symbol}</Text>
                  <Text style={styles.meta}>
                    {holding.name || 'Crypto'} · {holding.units} units
                  </Text>
                </View>
                <View style={styles.rowValue}>
                  <Text style={styles.value}>{formatMoney(cryptoHoldingMarketValue(holding), finances.currency)}</Text>
                  <Text style={styles.meta}>
                    {holding.lastPrice != null
                      ? formatMoney(holding.lastPrice, finances.currency)
                      : 'Unpriced'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </FinancesChrome>
      <CryptoHoldingSheet
        visible={sheetOpen}
        holding={editing}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setSheetOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: CryptoHoldingDraft) => {
          const ok = await run(async () => {
            if (editing) await finances.updateCryptoHolding(editing.id, draft);
            else await finances.createCryptoHolding(draft);
            try {
              await finances.refreshCryptoQuotes([draft.symbol]);
            } catch {
              // Holding is saved even if the quote feed is down.
            }
          });
          if (ok) setSheetOpen(false);
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteCryptoHolding(editing.id));
                if (ok) setSheetOpen(false);
              }
            : undefined
        }
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
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowFirst: { borderTopWidth: 0 },
  rowCopy: { flex: 1, minWidth: 0 },
  symbol: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowValue: { alignItems: 'flex-end' },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
