import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  canManageFinances,
  formatMoney,
  metalHoldingMarketValue,
  metalHoldingSizeLabel,
  metalKindLabel,
  metalPortfolioTotals,
  metalPremiumLabel,
  metalPremiumMultiplier,
  metalSpotPerUnit,
  metalUnitLabel,
  type FinanceMetalHolding,
  type MetalValueBasis,
} from '@kinexus/domain';

import { Btn, ErrorText, Pill } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import { MetalHoldingSheet } from '@/src/features/finances/sheets';
import {
  actionErrorMessage,
  useFinancesSync,
  type MetalHoldingDraft,
} from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function MetalsScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceMetalHolding | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [basis, setBasis] = useState<MetalValueBasis>('premium');

  const totals = useMemo(
    () => metalPortfolioTotals(finances.metalHoldings, basis),
    [basis, finances.metalHoldings],
  );
  const sorted = useMemo(
    () =>
      [...finances.metalHoldings].sort((a, b) => {
        const valueDiff = metalHoldingMarketValue(b, basis) - metalHoldingMarketValue(a, basis);
        if (valueDiff !== 0) return valueDiff;
        return metalKindLabel(a.metal).localeCompare(metalKindLabel(b.metal));
      }),
    [basis, finances.metalHoldings],
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

  if (finances.loading && finances.metalHoldings.length === 0) {
    return <LoadingState label="Loading metals…" />;
  }

  return (
    <>
      <FinancesChrome desktop={desktop} kicker="Bullion" title="Metals">
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryLabel}>{basis === 'spot' ? 'Value at spot' : 'Value with premiums'}</Text>
            {finances.metalHoldings.length > 0 ? (
              <View style={styles.toggle}>
                <Pill label="Spot" active={basis === 'spot'} onPress={() => setBasis('spot')} />
                <Pill label="Premium" active={basis === 'premium'} onPress={() => setBasis('premium')} />
              </View>
            ) : null}
          </View>
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
            {finances.metalHoldings.length > 0 ? (
              <Btn
                label={busy ? 'Refreshing…' : 'Refresh prices'}
                variant="secondary"
                onPress={() => void run(() => finances.refreshMetalQuotes())}
                disabled={!finances.online || busy}
              />
            ) : null}
          </View>
        ) : null}
        {sorted.length === 0 ? (
          <EmptyState
            title="No metals yet"
            body={
              canManage
                ? 'Add a coin or bar by the piece, then say how many you have. Prices refresh from the latest troy-ounce quote.'
                : 'Ask a household admin to add the family’s metal holdings.'
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
                  <Text style={styles.symbol}>{holding.name || metalKindLabel(holding.metal)}</Text>
                  <Text style={styles.meta}>
                    {holding.name ? `${metalKindLabel(holding.metal)} · ` : ''}
                    {metalHoldingSizeLabel(holding)}
                    {metalPremiumLabel(holding.premiumPercent) ? ` · ${metalPremiumLabel(holding.premiumPercent)}` : ''}
                  </Text>
                </View>
                <View style={styles.rowValue}>
                  <Text style={styles.value}>{formatMoney(metalHoldingMarketValue(holding, basis), finances.currency)}</Text>
                  <Text style={styles.meta}>
                    {holding.lastPrice != null
                      ? `${formatMoney(
                          metalSpotPerUnit(
                            holding.lastPrice * (basis === 'spot' ? 1 : metalPremiumMultiplier(holding.premiumPercent)),
                            holding.unit,
                          ),
                          finances.currency,
                        )} / ${metalUnitLabel(holding.unit)}`
                      : 'Unpriced'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </FinancesChrome>
      <MetalHoldingSheet
        visible={sheetOpen}
        holding={editing}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setSheetOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: MetalHoldingDraft) => {
          const ok = await run(async () => {
            if (editing) await finances.updateMetalHolding(editing.id, draft);
            else await finances.createMetalHolding(draft);
            try {
              await finances.refreshMetalQuotes([draft.metal]);
            } catch {
              // Holding is saved even if the quote feed is down.
            }
          });
          if (ok) setSheetOpen(false);
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteMetalHolding(editing.id));
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
  summaryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toggle: { flexDirection: 'row', gap: 8 },
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
