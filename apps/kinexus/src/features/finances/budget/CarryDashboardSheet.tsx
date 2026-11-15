import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  carryDashboardRows,
  formatCarryBalance,
  formatMoney,
  linePathName,
  monthLabel,
  type FinanceBudgetCarry,
  type FinanceBudgetLine,
} from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

type Mode = 'list' | 'apply' | 'transfer';

export function CarryDashboardSheet({
  visible,
  lines,
  carries,
  monthStart,
  currency,
  onClose,
  onSync,
  onClear,
  onApply,
  onTransfer,
  busy,
  error,
}: {
  visible: boolean;
  lines: readonly FinanceBudgetLine[];
  carries: readonly FinanceBudgetCarry[];
  monthStart: string;
  currency: string;
  onClose: () => void;
  onSync: () => Promise<void>;
  onClear: (lineId: string) => Promise<void>;
  onApply: (lineId: string, targetLineId: string, amount?: number) => Promise<void>;
  onTransfer: (fromLineId: string, toLineId: string, amount?: number) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const rows = useMemo(() => carryDashboardRows(lines, carries), [carries, lines]);
  const expenseLines = useMemo(
    () =>
      lines
        .filter((line) => line.kind === 'expense' && !line.captureSurplus)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [lines],
  );
  const [mode, setMode] = useState<Mode>('list');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [targetLineId, setTargetLineId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const active = rows.find((row) => row.lineId === activeLineId) ?? null;

  useEffect(() => {
    if (!visible) return;
    setMode('list');
    setActiveLineId(null);
    setTargetLineId(null);
    setAmount('');
  }, [visible]);

  function moneyLabel(value: number) {
    return formatMoney(Math.abs(value), currency);
  }

  async function submitApply() {
    if (!active) return;
    const parsed = amount.trim() ? Number(amount) : undefined;
    await onApply(active.lineId, targetLineId ?? active.lineId, parsed);
    setMode('list');
    setActiveLineId(null);
  }

  async function submitTransfer() {
    if (!active || !targetLineId) return;
    const parsed = amount.trim() ? Number(amount) : undefined;
    await onTransfer(active.lineId, targetLineId, parsed);
    setMode('list');
    setActiveLineId(null);
  }

  return (
    <Sheet visible={visible} title="Budget over / under" onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.copy}>
          Closed months roll into a running balance per category. Apply it to {monthLabel(monthStart)}, move it to
          another category, or clear it.
        </Text>
        <Btn label="Refresh from closed months" variant="secondary" onPress={() => void onSync()} busy={busy} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {mode === 'list' ? (
          rows.length === 0 ? (
            <Text style={styles.empty}>No over or under to track yet.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.lineId} style={[styles.card, row.over && styles.cardOver, row.under && styles.cardUnder]}>
                <View style={styles.cardHead}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={[styles.balance, row.over && styles.balanceOver, row.under && styles.balanceUnder]}>
                    {formatCarryBalance(row.balance, moneyLabel)}
                  </Text>
                </View>
                {row.lastAccruedLabel ? <Text style={styles.meta}>Through {row.lastAccruedLabel}</Text> : null}
                <View style={styles.actions}>
                  <Pressable
                    style={styles.action}
                    onPress={() => {
                      setActiveLineId(row.lineId);
                      setTargetLineId(row.lineId);
                      setAmount(String(Math.abs(row.balance)));
                      setMode('apply');
                    }}>
                    <Text style={styles.actionLabel}>Apply</Text>
                  </Pressable>
                  <Pressable
                    style={styles.action}
                    onPress={() => {
                      setActiveLineId(row.lineId);
                      setTargetLineId(null);
                      setAmount(String(Math.abs(row.balance)));
                      setMode('transfer');
                    }}>
                    <Text style={styles.actionLabel}>Move</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => void onClear(row.lineId)} disabled={busy}>
                    <Text style={styles.actionDanger}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : null}

        {mode === 'apply' && active ? (
          <View style={styles.stack}>
            <Text style={styles.section}>
              Apply {formatCarryBalance(active.balance, moneyLabel)} to {monthLabel(monthStart)}
            </Text>
            <Text style={styles.meta}>Optional: put it on a different category.</Text>
            <View style={styles.chips}>
              {expenseLines.map((line) => {
                const selected = (targetLineId ?? active.lineId) === line.id;
                return (
                  <Pressable
                    key={line.id}
                    onPress={() => setTargetLineId(line.id)}
                    style={[styles.chip, selected && styles.chipOn]}>
                    <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{linePathName(line, lines)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Full balance" />
            <View style={styles.actions}>
              <Btn label="Cancel" variant="secondary" onPress={() => setMode('list')} />
              <Btn label="Apply" onPress={() => void submitApply()} busy={busy} />
            </View>
          </View>
        ) : null}

        {mode === 'transfer' && active ? (
          <View style={styles.stack}>
            <Text style={styles.section}>Move {formatCarryBalance(active.balance, moneyLabel)}</Text>
            <View style={styles.chips}>
              {expenseLines
                .filter((line) => line.id !== active.lineId)
                .map((line) => {
                  const selected = targetLineId === line.id;
                  return (
                    <Pressable
                      key={line.id}
                      onPress={() => setTargetLineId(line.id)}
                      style={[styles.chip, selected && styles.chipOn]}>
                      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{linePathName(line, lines)}</Text>
                    </Pressable>
                  );
                })}
            </View>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Full balance" />
            <View style={styles.actions}>
              <Btn label="Cancel" variant="secondary" onPress={() => setMode('list')} />
              <Btn label="Move" onPress={() => void submitTransfer()} busy={busy} disabled={!targetLineId} />
            </View>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: space.lg },
  error: { color: colors.danger, fontSize: 13 },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.xs,
    backgroundColor: colors.bgCard,
  },
  cardOver: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  cardUnder: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, alignItems: 'baseline' },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  balance: { color: colors.text, fontSize: 15, fontWeight: '700' },
  balanceOver: { color: colors.danger },
  balanceUnder: { color: colors.accent },
  meta: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actionDanger: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  section: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipLabel: { color: colors.textMuted, fontSize: 13 },
  chipLabelOn: { color: colors.text, fontWeight: '600' },
});
