import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  formatMoney,
  investmentStatusLabel,
  tradeJournalSummary,
  type FinanceInvestmentAlert,
  type FinanceTradeJournalEntry,
  type InvestmentAlertKind,
} from '@kinexus/domain';

import { BackLink, Btn, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { FinancesChrome, StatCard } from '@/src/features/finances/FinancesShared';
import {
  ItemSheet,
  SectionLabel,
  SelectTile,
  TileGrid,
  TradeSheet,
  alertKindLabel,
  alertSummary,
  formatPct,
  investStyles,
  pctTo,
  visibilityLabel,
} from '@/src/features/finances/invest/invest-ui';
import { useInvestSync, type InvestAlertDraft, type InvestItemDraft, type TradeDraft } from '@/src/features/finances/invest/use-invest-sync';
import { actionErrorMessage } from '@/src/features/finances/use-finances-sync';
import { Sheet } from '@/src/features/meals/meals-kit';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

const LIST_HREF = '/finances/invest' as Href;
const ALERT_KINDS: InvestmentAlertKind[] = ['above', 'below', 'pct_move'];

function shortDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function InvestDetailScreen({ itemId }: { itemId: string }) {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const invest = useInvestSync();
  const desktop = mode === 'desktop';
  const [itemOpen, setItemOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<FinanceTradeJournalEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const item = invest.items.find((entry) => entry.id === itemId) ?? null;
  const alerts = useMemo(() => invest.alerts.filter((alert) => alert.itemId === itemId), [invest.alerts, itemId]);
  const trades = useMemo(() => invest.trades.filter((entry) => entry.itemId === itemId), [invest.trades, itemId]);
  const summary = useMemo(() => tradeJournalSummary(trades), [trades]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(LIST_HREF);
  }

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

  if (invest.loading && !item) return <LoadingState label="Loading idea…" />;

  if (!item) {
    return (
      <FinancesChrome desktop={desktop} kicker="Watchlist" title="Idea">
        <BackLink label="Watchlist" onPress={goBack} />
        {!desktop ? <Text style={styles.pageTitle}>Idea</Text> : null}
        <EmptyState title="Idea not found" body="It may have been removed or made private.">
          <Btn label="Back to watchlist" onPress={() => router.replace(LIST_HREF)} />
        </EmptyState>
      </FinancesChrome>
    );
  }

  const editable = invest.canEditItem(item);
  const canDelete = editable && (item.createdBy === invest.userId || invest.role === 'owner' || invest.role === 'admin');
  const toTarget = pctTo(item.targetPrice, item.lastPrice);
  const toStop = pctTo(item.stopPrice, item.lastPrice);
  const pnl = summary.realizedPnl;

  return (
    <>
      <FinancesChrome desktop={desktop} kicker={investmentStatusLabel(item.status)} title={item.symbol ?? item.title}>
        <BackLink label="Watchlist" onPress={goBack} />
        {!desktop ? <Text style={styles.pageTitle}>{item.symbol ?? item.title}</Text> : null}
        {item.symbol ? <Text style={styles.name}>{item.title}</Text> : null}
        <ErrorText message={invest.error ? actionErrorMessage(invest.error) : actionError} />
        {editable ? (
          <View style={investStyles.actions}>
            <Btn label="Edit" onPress={() => { setActionError(null); setItemOpen(true); }} disabled={!invest.online} />
            {item.symbol ? (
              <Btn
                label={busy ? 'Refreshing…' : 'Refresh price'}
                variant="secondary"
                onPress={() => void run(() => invest.refreshPrices([item.id]))}
                disabled={!invest.online || busy}
              />
            ) : null}
            <Btn
              label="Log trade"
              variant="secondary"
              onPress={() => { setActionError(null); setEditingTrade(null); setTradeOpen(true); }}
              disabled={!invest.online}
            />
          </View>
        ) : null}
        <View style={styles.stats}>
          <StatCard
            label="Last"
            value={item.lastPrice != null ? formatMoney(item.lastPrice, item.currency) : '—'}
            hint={item.lastPriceAt ? shortDate(item.lastPriceAt) : undefined}
          />
          <StatCard
            label="Target"
            value={item.targetPrice != null ? formatMoney(item.targetPrice, item.currency) : '—'}
            hint={toTarget != null ? formatPct(toTarget) : undefined}
          />
          <StatCard
            label="Stop"
            value={item.stopPrice != null ? formatMoney(item.stopPrice, item.currency) : '—'}
            hint={toStop != null ? formatPct(toStop) : undefined}
          />
        </View>
        {item.thesis ? (
          <View style={investStyles.card}>
            <SectionLabel>Thesis</SectionLabel>
            <Text style={investStyles.body}>{item.thesis}</Text>
          </View>
        ) : null}
        {item.tags.length > 0 || item.visibility === 'private' ? (
          <View style={investStyles.card}>
            <SectionLabel>Tags</SectionLabel>
            <View style={styles.tags}>
              {item.visibility === 'private' ? <Pill label={visibilityLabel('private')} active /> : null}
              {item.tags.map((tag) => (
                <Pill key={tag} label={tag} />
              ))}
            </View>
          </View>
        ) : null}
        {item.notes ? (
          <View style={investStyles.card}>
            <SectionLabel>Notes</SectionLabel>
            <Text style={investStyles.body}>{item.notes}</Text>
          </View>
        ) : null}
        <View style={investStyles.card}>
          <View style={styles.cardHead}>
            <Text style={[investStyles.cardTitle, styles.flex]}>Alerts</Text>
            {editable ? (
              <Btn label="Add alert" variant="secondary" onPress={() => { setActionError(null); setAlertOpen(true); }} disabled={!invest.online} />
            ) : null}
          </View>
          {alerts.length === 0 ? (
            <Text style={investStyles.meta}>No alerts</Text>
          ) : (
            alerts.map((alert, index) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                currency={item.currency}
                first={index === 0}
                editable={editable && invest.online}
                busy={busy}
                onToggle={(active) => void run(() => invest.setAlertActive(alert.id, active))}
                onRemove={() => void run(() => invest.deleteAlert(alert.id))}
              />
            ))
          )}
        </View>
        <View style={investStyles.card}>
          <View style={styles.cardHead}>
            <Text style={[investStyles.cardTitle, styles.flex]}>Trades</Text>
            {pnl != null ? (
              <Text style={[investStyles.value, pnl >= 0 ? investStyles.gain : investStyles.loss]}>
                {pnl >= 0 ? '+' : ''}
                {formatMoney(pnl, item.currency)}
              </Text>
            ) : null}
          </View>
          {trades.length === 0 ? (
            <Text style={investStyles.meta}>No trades logged</Text>
          ) : (
            trades.map((entry, index) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => { setActionError(null); setEditingTrade(entry); setTradeOpen(true); }}
                style={({ pressed }) => [investStyles.rowItem, index === 0 && styles.rowFirst, pressed && styles.pressed]}>
                <View style={investStyles.rowCopy}>
                  <Text style={investStyles.symbol}>
                    <Text style={entry.side === 'buy' ? investStyles.gain : styles.sell}>{entry.side === 'buy' ? 'Buy' : 'Sell'}</Text>
                    {` ${entry.qty} @ ${formatMoney(entry.price, item.currency)}`}
                  </Text>
                  <Text style={investStyles.meta}>{shortDate(entry.tradedOn)}</Text>
                </View>
                <Text style={investStyles.value}>{formatMoney(entry.qty * entry.price, item.currency)}</Text>
              </Pressable>
            ))
          )}
        </View>
      </FinancesChrome>
      <ItemSheet
        visible={itemOpen}
        item={item}
        busy={busy}
        error={actionError}
        readOnly={!editable}
        onClose={() => { setItemOpen(false); setActionError(null); }}
        onSave={async (draft: InvestItemDraft) => {
          const ok = await run(() => invest.updateItem(item.id, draft));
          if (ok) setItemOpen(false);
        }}
        onDelete={
          canDelete
            ? async () => {
                const ok = await run(() => invest.deleteItem(item.id));
                if (ok) {
                  setItemOpen(false);
                  router.replace(LIST_HREF);
                }
              }
            : undefined
        }
      />
      <AlertSheet
        visible={alertOpen}
        busy={busy}
        error={actionError}
        onClose={() => { setAlertOpen(false); setActionError(null); }}
        onSave={async (draft) => {
          const ok = await run(() => invest.createAlert(item.id, draft));
          if (ok) setAlertOpen(false);
        }}
      />
      <TradeSheet
        visible={tradeOpen}
        entry={editingTrade}
        items={invest.items}
        lockedItemId={item.id}
        busy={busy}
        error={actionError}
        readOnly={editingTrade ? !invest.canEditTrade(editingTrade) : !invest.canWrite}
        onClose={() => { setTradeOpen(false); setActionError(null); }}
        onSave={async (draft: TradeDraft) => {
          const ok = await run(() => (editingTrade ? invest.updateTrade(editingTrade.id, draft) : invest.createTrade(draft)));
          if (ok) setTradeOpen(false);
        }}
        onDelete={
          editingTrade && invest.canEditTrade(editingTrade)
            ? async () => {
                const ok = await run(() => invest.deleteTrade(editingTrade.id));
                if (ok) setTradeOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

function AlertRow({
  alert,
  currency,
  first,
  editable,
  busy,
  onToggle,
  onRemove,
}: {
  alert: FinanceInvestmentAlert;
  currency: string;
  first: boolean;
  editable: boolean;
  busy: boolean;
  onToggle: (active: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <View style={[investStyles.rowItem, first && styles.rowFirst]}>
      <View style={investStyles.rowCopy}>
        <Text style={[investStyles.symbol, !alert.active && styles.off]}>{alertSummary(alert.kind, alert.threshold, currency)}</Text>
        {alert.lastTriggeredAt ? <Text style={investStyles.meta}>Last fired {shortDate(alert.lastTriggeredAt)}</Text> : null}
      </View>
      {editable ? (
        <>
          <Switch
            value={alert.active}
            onValueChange={onToggle}
            disabled={busy}
            trackColor={{ false: colors.bgHover, true: colors.accentMuted }}
            thumbColor={alert.active ? colors.accent : colors.textMuted}
          />
          <Btn label="Remove" variant="ghost" onPress={onRemove} disabled={busy} />
        </>
      ) : null}
    </View>
  );
}

function AlertSheet({
  visible,
  busy,
  error,
  onClose,
  onSave,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: InvestAlertDraft) => Promise<void>;
}) {
  const [kind, setKind] = useState<InvestmentAlertKind>('above');
  const [threshold, setThreshold] = useState('');

  useEffect(() => {
    if (!visible) return;
    setKind('above');
    setThreshold('');
  }, [visible]);

  return (
    <Sheet visible={visible} title="New alert" onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.stack}>
          <SectionLabel>Trigger</SectionLabel>
          <TileGrid>
            {ALERT_KINDS.map((option) => (
              <SelectTile key={option} label={alertKindLabel(option)} active={kind === option} onPress={() => setKind(option)} />
            ))}
          </TileGrid>
        </View>
        <Field
          label={kind === 'pct_move' ? 'Percent' : 'Price'}
          value={threshold}
          onChangeText={setThreshold}
          placeholder={kind === 'pct_move' ? '5' : '0.00'}
          keyboardType="decimal-pad"
        />
        <ErrorText message={error} />
        <Btn label="Add alert" busy={busy} disabled={!threshold.trim()} onPress={() => void onSave({ kind, threshold })} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  pageTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  name: { color: colors.textMuted, fontSize: 15, marginTop: -8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowFirst: { borderTopWidth: 0, paddingTop: 4 },
  pressed: { opacity: 0.8 },
  sell: { color: colors.warning },
  off: { color: colors.textDim },
});
