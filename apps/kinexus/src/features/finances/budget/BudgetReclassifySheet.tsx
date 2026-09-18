import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  budgetCategoryOptions,
  formatMoney,
  type BudgetCategoryOption,
  type FinanceBudgetTxn,
  type StatementAssignment,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

export function BudgetReclassifySheet({
  visible,
  txns,
  merchantIds,
  categories,
  currency,
  busy,
  error,
  onClose,
  onSave,
}: {
  visible: boolean;
  txns: readonly FinanceBudgetTxn[];
  merchantIds?: readonly string[];
  categories: readonly BudgetCategoryOption[];
  currency: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (assignment: StatementAssignment, txnIds: readonly string[]) => Promise<void>;
}) {
  const [customName, setCustomName] = useState('');
  const [scope, setScope] = useState<'selected' | 'merchant'>('selected');
  const sample = txns[0] ?? null;
  const mixed = txns.some((txn) => txn.amount >= 0) && txns.some((txn) => txn.amount < 0);
  const kind = txns.every((txn) => txn.amount >= 0) ? 'income' : 'expense';
  const options = budgetCategoryOptions(mixed ? categories : categories.filter((item) => item.kind === kind));
  const fallback = kind === 'income' ? 'Other income' : 'Other';
  const total = useMemo(() => txns.reduce((sum, txn) => sum + Math.abs(txn.amount), 0), [txns]);
  const sameMerchant = Boolean(sample && txns.every((txn) => txn.merchantKey === sample.merchantKey));
  const extraMerchant = (merchantIds?.length ?? 0) > txns.length && sameMerchant && txns.length === 1;

  useEffect(() => {
    if (!visible) return;
    setCustomName('');
    setScope('selected');
  }, [sample?.id, txns.length, visible]);

  if (!sample) return null;

  function apply(assignment: StatementAssignment) {
    const ids = scope === 'merchant' && merchantIds && merchantIds.length > 0 ? merchantIds : txns.map((txn) => txn.id);
    void onSave(assignment, ids);
  }

  return (
    <Sheet visible={visible} title={txns.length > 1 ? `Reclassify ${txns.length}` : 'Reclassify'} onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.card}>
          {txns.length === 1 ? (
            <>
              <Text style={styles.merchant}>{sample.merchantKey}</Text>
              <Text style={styles.sample}>{sample.description}</Text>
              <Text style={styles.meta}>
                {formatTxnDate(sample.date)} · {formatMoney(Math.abs(sample.amount), currency)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.merchant}>{txns.length} transactions</Text>
              <Text style={styles.sample}>
                {sameMerchant ? sample.merchantKey : `${new Set(txns.map((txn) => txn.merchantKey)).size} merchants`}
              </Text>
              <Text style={styles.meta}>{formatMoney(total, currency)} total</Text>
              {txns.slice(0, 4).map((txn) => (
                <Text key={txn.id} style={styles.meta} numberOfLines={1}>
                  {formatTxnDate(txn.date)} · {txn.description}
                </Text>
              ))}
              {txns.length > 4 ? <Text style={styles.meta}>+{txns.length - 4} more</Text> : null}
            </>
          )}
        </View>
        {extraMerchant ? (
          <View style={styles.wrap}>
            <Pill label="This transaction" active={scope === 'selected'} onPress={() => setScope('selected')} />
            <Pill
              label={`All ${merchantIds?.length ?? 0} from ${sample.merchantKey}`}
              active={scope === 'merchant'}
              onPress={() => setScope('merchant')}
            />
          </View>
        ) : null}
        <Text style={styles.label}>{mixed ? 'Move to' : kind === 'income' ? 'Which income is this?' : 'Which expense is this?'}</Text>
        <View style={styles.wrap}>
          {options.map((item) => (
            <Pill key={`${item.kind}:${item.name}`} label={item.name} onPress={() => apply({ kind: item.kind, name: item.name })} />
          ))}
        </View>
        <Field
          label="Or a new category"
          value={customName}
          onChangeText={setCustomName}
          placeholder="Coffee, sport, pets…"
          autoCapitalize="words"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.wrap}>
          <Btn
            label="Use this name"
            variant="secondary"
            onPress={() => apply({ kind, name: customName.trim() })}
            disabled={!customName.trim() || busy}
            busy={busy}
          />
          <Btn label={`Skip as ${fallback}`} variant="ghost" onPress={() => apply({ kind, name: fallback })} disabled={busy} />
          <Btn label="Ignore / transfer" variant="ghost" onPress={() => apply({ ignore: true })} disabled={busy} />
        </View>
        <Pressable onPress={onClose} disabled={busy}>
          <Text style={styles.meta}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

export function formatTxnDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  error: { color: colors.danger, fontSize: 13 },
  card: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 6,
  },
  merchant: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sample: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.textDim, fontSize: 12 },
});
