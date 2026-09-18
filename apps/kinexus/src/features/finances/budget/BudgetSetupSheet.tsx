import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_BUDGET_SEED,
  budgetCategoryOptions,
  formatMoney,
  linesOfKind,
  merchantsForBudgetLine,
  parseMoney,
  txnsForBudgetLine,
  type FinanceBudgetLine,
  type FinanceBudgetLineKind,
  type FinanceBudgetTxn,
  type StatementAssignment,
  type StatementBudgetDraft,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { BudgetImportSheet } from '@/src/features/finances/budget/BudgetImportSheet';
import { BudgetReclassifySheet } from '@/src/features/finances/budget/BudgetReclassifySheet';
import type { BudgetLineDraft } from '@/src/features/finances/use-finances-sync';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

type PlanRow = {
  key: string;
  id?: string;
  kind: FinanceBudgetLineKind;
  name: string;
  planned: string;
};

function rowsFromLines(lines: readonly FinanceBudgetLine[]): PlanRow[] {
  return [...lines]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((line) => ({
      key: line.id,
      id: line.id,
      kind: line.kind,
      name: line.name,
      planned: line.planned ? String(line.planned) : '',
    }));
}

function seedRows(): PlanRow[] {
  return DEFAULT_BUDGET_SEED.map((item) => ({
    key: `${item.kind}:${item.name}`,
    kind: item.kind,
    name: item.name,
    planned: '',
  }));
}

export function BudgetSetupSheet({
  visible,
  lines,
  txns,
  currency,
  busy,
  error,
  onClose,
  onSave,
  onApplyStatement,
  onReclassify,
}: {
  visible: boolean;
  lines: readonly FinanceBudgetLine[];
  txns: readonly FinanceBudgetTxn[];
  currency: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (drafts: BudgetLineDraft[]) => Promise<void>;
  onApplyStatement: (draft: StatementBudgetDraft, setPlanned: boolean) => Promise<void>;
  onReclassify: (assignment: StatementAssignment, txnIds: readonly string[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<PlanRow[]>(seedRows);
  const [importOpen, setImportOpen] = useState(false);
  const [classifying, setClassifying] = useState<FinanceBudgetTxn[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const signature = lines.map((line) => `${line.id}:${line.kind}:${line.name}:${line.planned}`).join('|');
  const income = rows.filter((row) => row.kind === 'income');
  const expenses = rows.filter((row) => row.kind === 'expense');
  const plannedTotal = useMemo(() => {
    let incomePlanned = 0;
    let expensePlanned = 0;
    for (const row of rows) {
      const planned = Math.max(0, parseMoney(row.planned) ?? 0);
      if (row.kind === 'income') incomePlanned += planned;
      else expensePlanned += planned;
    }
    return { incomePlanned, expensePlanned, leftover: incomePlanned - expensePlanned };
  }, [rows]);

  useEffect(() => {
    if (!visible) return;
    setRows(lines.length > 0 ? rowsFromLines(lines) : seedRows());
    setImportOpen(false);
    setClassifying([]);
    setLocalError(null);
  }, [lines.length, signature, visible]);

  function updateRow(key: string, patch: Partial<PlanRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow(kind: FinanceBudgetLineKind) {
    setRows((current) => [
      ...current,
      { key: `${kind}:${Date.now()}`, kind, name: '', planned: '' },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function save() {
    const drafts = rows
      .map((row) => ({ id: row.id, kind: row.kind, name: row.name.trim(), planned: row.planned }))
      .filter((row) => row.name);
    if (drafts.length === 0) {
      setLocalError('Add at least one category');
      return;
    }
    if (txns.length === 0 && drafts.every((row) => (parseMoney(row.planned) ?? 0) <= 0)) {
      setLocalError('Enter amounts, or upload a statement to fill them');
      return;
    }
    setLocalError(null);
    await onSave(drafts);
  }

  return (
    <>
      <Sheet visible={visible} title="Set budget" onClose={onClose} wide>
        <View style={styles.stack}>
          <Text style={styles.hint}>
            Set the household’s typical month. Upload a bank statement to fill categories from what you usually spend,
            then reclassify anything that landed in the wrong place. Or type categories and amounts yourself.
          </Text>
          <View style={styles.wrap}>
            <Btn label="Upload transactions" onPress={() => setImportOpen(true)} disabled={busy} />
            <Btn label="Add expense" variant="secondary" onPress={() => addRow('expense')} disabled={busy} />
            <Btn label="Add income" variant="secondary" onPress={() => addRow('income')} disabled={busy} />
          </View>
          <View style={styles.summary}>
            <Text style={styles.meta}>Income {formatMoney(plannedTotal.incomePlanned, currency)}</Text>
            <Text style={styles.meta}>Expenses {formatMoney(plannedTotal.expensePlanned, currency)}</Text>
            <Text style={styles.meta}>Leftover {formatMoney(plannedTotal.leftover, currency)}</Text>
          </View>
          <PlanGroup
            title="Income"
            rows={income}
            onChange={updateRow}
            onRemove={removeRow}
            disabled={busy}
          />
          <PlanGroup
            title="Expenses"
            rows={expenses}
            onChange={updateRow}
            onRemove={removeRow}
            disabled={busy}
          />
          {txns.length > 0 ? (
            <ImportedReview
              lines={lines}
              txns={txns}
              currency={currency}
              onReclassify={setClassifying}
            />
          ) : null}
          {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}
          <Btn label="Save budget" onPress={() => void save()} busy={busy} />
        </View>
      </Sheet>
      <BudgetImportSheet
        visible={importOpen}
        existingLines={rows.map((row) => ({ kind: row.kind, name: row.name.trim() })).filter((row) => row.name)}
        currency={currency}
        plannedIsEmpty={rows.every((row) => (parseMoney(row.planned) ?? 0) <= 0)}
        busy={busy}
        error={error}
        onClose={() => setImportOpen(false)}
        onApply={async (draft, setPlanned) => {
          await onApplyStatement(draft, setPlanned);
          setImportOpen(false);
        }}
      />
      <BudgetReclassifySheet
        visible={classifying.length > 0}
        txns={classifying}
        merchantIds={classifying[0] ? txns.filter((txn) => txn.merchantKey === classifying[0]?.merchantKey).map((txn) => txn.id) : []}
        categories={budgetCategoryOptions(lines)}
        currency={currency}
        busy={busy}
        error={error}
        onClose={() => setClassifying([])}
        onSave={async (assignment, txnIds) => {
          if (txnIds.length === 0) return;
          await onReclassify(assignment, txnIds);
          setClassifying([]);
        }}
      />
    </>
  );
}

function PlanGroup({
  title,
  rows,
  onChange,
  onRemove,
  disabled,
}: {
  title: string;
  rows: PlanRow[];
  onChange: (key: string, patch: Partial<PlanRow>) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowFields}>
            <Field
              label="Category"
              value={row.name}
              onChangeText={(name) => onChange(row.key, { name })}
              placeholder={row.kind === 'income' ? 'Salary' : 'Groceries & food'}
              autoCapitalize="words"
              editable={!disabled}
            />
            <Field
              label="Amount"
              value={row.planned}
              onChangeText={(planned) => onChange(row.key, { planned })}
              placeholder="0"
              keyboardType="decimal-pad"
              editable={!disabled}
            />
          </View>
          <View style={styles.rowMeta}>
            <Pill label={row.kind === 'income' ? 'Income' : 'Expense'} active />
            <Pressable onPress={() => onRemove(row.key)} disabled={disabled} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function ImportedReview({
  lines,
  txns,
  currency,
  onReclassify,
}: {
  lines: readonly FinanceBudgetLine[];
  txns: readonly FinanceBudgetTxn[];
  currency: string;
  onReclassify: (txns: FinanceBudgetTxn[]) => void;
}) {
  const income = linesOfKind(lines, 'income');
  const expenses = linesOfKind(lines, 'expense');
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>Imported transactions</Text>
      <Text style={styles.hint}>Click a category, select what looks wrong, and reclassify it.</Text>
      {[...income, ...expenses].map((line) => (
        <SetupLineTxns key={line.id} line={line} txns={txns} currency={currency} onReclassify={onReclassify} />
      ))}
    </View>
  );
}

function SetupLineTxns({
  line,
  txns,
  currency,
  onReclassify,
}: {
  line: FinanceBudgetLine;
  txns: readonly FinanceBudgetTxn[];
  currency: string;
  onReclassify: (txns: FinanceBudgetTxn[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const merchants = useMemo(() => merchantsForBudgetLine(txns, line.id), [line.id, txns]);
  const count = txnsForBudgetLine(txns, line.id).length;
  if (count === 0) return null;
  const visible = merchants.flatMap((merchant) => merchant.transactions);
  const picked = visible.filter((txn) => selected.has(txn.id));
  return (
    <View style={styles.preview}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.previewHead}>
        <Text style={styles.previewName}>{line.name}</Text>
        <Text style={styles.meta}>
          {count} · {formatMoney(line.planned, currency)} · {open ? 'hide' : 'show'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.picker}>
          <View style={styles.pickBar}>
            <Pressable
              onPress={() =>
                setSelected((current) =>
                  visible.every((txn) => current.has(txn.id)) ? new Set() : new Set(visible.map((txn) => txn.id)),
                )
              }
              hitSlop={8}>
              <Text style={styles.link}>{picked.length === visible.length ? 'Clear all' : 'Select all'}</Text>
            </Pressable>
            <Btn
              label={picked.length > 0 ? `Reclassify ${picked.length}` : 'Reclassify selected'}
              onPress={() => onReclassify(picked)}
              disabled={picked.length === 0}
            />
          </View>
          {merchants.map((merchant) => (
            <View key={merchant.merchantKey} style={styles.merchantBlock}>
              <Text style={styles.merchantHead}>
                {merchant.merchantKey} · {formatMoney(merchant.total, currency)}
              </Text>
              {merchant.transactions.map((txn) => {
                const on = selected.has(txn.id);
                return (
                  <Pressable
                    key={txn.id}
                    onPress={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(txn.id)) next.delete(txn.id);
                        else next.add(txn.id);
                        return next;
                      })
                    }
                    style={styles.txnRow}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.txnDesc} numberOfLines={2}>
                      {txn.description}
                    </Text>
                    <Text style={styles.txnAmount}>{formatMoney(Math.abs(txn.amount), currency)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  meta: { color: colors.textMuted, fontSize: 13 },
  group: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 10,
  },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  row: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rowFields: { gap: 8 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  preview: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  previewName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  picker: { gap: 8 },
  pickBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  merchantBlock: { gap: 4 },
  merchantHead: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  txnDesc: { color: colors.text, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 18 },
  txnAmount: { color: colors.text, fontSize: 12, fontWeight: '700' },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOn: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  checkMark: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
