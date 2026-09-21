import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_BUDGET_SEED,
  budgetCategoryOptions,
  cadenceAmountLabel,
  calendarMonthNumber,
  formatMoney,
  linesOfKind,
  merchantsForBudgetLine,
  parseMoney,
  txnsForBudgetLine,
  type FinanceBudgetLine,
  type FinanceBudgetLineCadence,
  type FinanceBudgetLineKind,
  type FinanceBudgetTxn,
  type StatementAssignment,
  type StatementBudgetDraft,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { BudgetImportSheet } from '@/src/features/finances/budget/BudgetImportSheet';
import { BudgetReclassifySheet } from '@/src/features/finances/budget/BudgetReclassifySheet';
import type { BudgetLineDraft } from '@/src/features/finances/use-finances-sync';
import { BudgetCadenceFields } from '@/src/features/finances/sheets';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

type PlanRow = {
  key: string;
  id?: string;
  kind: FinanceBudgetLineKind;
  name: string;
  planned: string;
  cadence: FinanceBudgetLineCadence;
  anchorMonth: number;
  parentKey?: string;
  autoApply: boolean;
  captureSurplus: boolean;
};

function newRowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowsFromLines(lines: readonly FinanceBudgetLine[]): PlanRow[] {
  return [...lines]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((line) => ({
      key: line.id,
      id: line.id,
      kind: line.kind,
      name: line.name,
      planned: line.planned ? String(line.planned) : '',
      cadence: line.cadence,
      anchorMonth: line.anchorMonth,
      parentKey: line.parentId ?? undefined,
      autoApply: line.autoApply,
      captureSurplus: line.captureSurplus,
    }));
}

function seedRows(): PlanRow[] {
  return DEFAULT_BUDGET_SEED.map((item) => ({
    key: `${item.kind}:${item.name}`,
    kind: item.kind,
    name: item.name,
    planned: '',
    cadence: 'monthly' as const,
    anchorMonth: calendarMonthNumber(),
    autoApply: false,
    captureSurplus: Boolean(item.captureSurplus),
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
  const signature = lines.map((line) => `${line.id}:${line.kind}:${line.name}:${line.planned}:${line.cadence}:${line.anchorMonth}:${line.parentId ?? ''}:${line.autoApply ? 1 : 0}:${line.captureSurplus ? 1 : 0}`).join('|');
  const income = rows.filter((row) => row.kind === 'income' && !row.parentKey);
  const expenses = rows.filter((row) => row.kind === 'expense' && !row.parentKey);
  const plannedTotal = useMemo(() => {
    const parentsWithChildren = new Set(rows.map((row) => row.parentKey).filter(Boolean));
    let incomePlanned = 0;
    let expensePlanned = 0;
    let lumpyCount = 0;
    for (const row of rows) {
      if (parentsWithChildren.has(row.key)) continue;
      const planned = Math.max(0, parseMoney(row.planned) ?? 0);
      if (row.captureSurplus) continue;
      if (row.cadence !== 'monthly') {
        lumpyCount += 1;
        continue;
      }
      if (row.kind === 'income') incomePlanned += planned;
      else expensePlanned += planned;
    }
    return { incomePlanned, expensePlanned, leftover: incomePlanned - expensePlanned, lumpyCount };
  }, [rows]);

  useEffect(() => {
    if (!visible) return;
    setRows(lines.length > 0 ? rowsFromLines(lines) : seedRows());
    setImportOpen(false);
    setClassifying([]);
    setLocalError(null);
  }, [lines.length, signature, visible]);

  function updateRow(key: string, patch: Partial<PlanRow>) {
    setRows((current) =>
      current.map((row) => {
        if (patch.captureSurplus && row.key !== key) return { ...row, captureSurplus: false };
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (next.captureSurplus) {
          next.autoApply = false;
          next.parentKey = undefined;
          next.kind = 'expense';
        }
        return next;
      }),
    );
  }

  function addRow(kind: FinanceBudgetLineKind) {
    setRows((current) => [
      ...current,
      { key: `${kind}:${Date.now()}`, kind, name: '', planned: '', cadence: 'monthly', anchorMonth: calendarMonthNumber(), autoApply: false, captureSurplus: false },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key && row.parentKey !== key));
  }

  function addSubRow(parent: PlanRow) {
    setRows((current) => [
      ...current,
      {
        key: `${parent.key}:sub:${Date.now()}`,
        kind: parent.kind,
        name: '',
        planned: '',
        cadence: parent.cadence,
        anchorMonth: parent.anchorMonth,
        parentKey: parent.key,
        autoApply: false,
        captureSurplus: false,
      },
    ]);
  }

  function moveRow(key: string, direction: -1 | 1) {
    setRows((current) => {
      const target = current.find((row) => row.key === key);
      if (!target) return current;
      const siblings = current
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.kind === target.kind && row.parentKey === target.parentKey);
      const from = siblings.findIndex(({ row }) => row.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= siblings.length) return current;
      const next = current.slice();
      const a = siblings[from]!.index;
      const b = siblings[to]!.index;
      const swap = next[a]!;
      next[a] = next[b]!;
      next[b] = swap;
      return next;
    });
  }

  async function save() {
    const idByKey = new Map(rows.map((row) => [row.key, row.id ?? newRowId()]));
    const drafts = rows
      .map((row) => ({
        id: idByKey.get(row.key),
        kind: row.kind,
        name: row.name.trim(),
        planned: row.planned,
        cadence: row.cadence,
        anchorMonth: row.anchorMonth,
        parentId: row.parentKey ? idByKey.get(row.parentKey) ?? null : null,
        autoApply: row.autoApply,
        captureSurplus: row.captureSurplus,
      }))
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
            Set the household’s typical month. Mark insurance, rates, and utilities as every second month, quarterly, or
            yearly so the full amount lands in the month it is due. Leftover after actual spending is allocated to
            Savings & Investments. On the budget page you can also show periodical bills as monthly amounts. Upload a
            bank statement to fill monthly categories from what you usually spend, then reclassify anything that landed
            in the wrong place.
          </Text>
          <View style={styles.wrap}>
            <Btn label="Upload transactions" onPress={() => setImportOpen(true)} disabled={busy} />
            <Btn label="Add expense" variant="secondary" onPress={() => addRow('expense')} disabled={busy} />
            <Btn label="Add income" variant="secondary" onPress={() => addRow('income')} disabled={busy} />
          </View>
          <View style={styles.summary}>
            <Text style={styles.meta}>Income {formatMoney(plannedTotal.incomePlanned, currency)}</Text>
            <Text style={styles.meta}>Expenses {formatMoney(plannedTotal.expensePlanned, currency)}</Text>
            <Text style={styles.meta}>Typical leftover {formatMoney(plannedTotal.leftover, currency)}</Text>
            {plannedTotal.lumpyCount > 0 ? (
              <Text style={styles.meta}>
                {plannedTotal.lumpyCount} {plannedTotal.lumpyCount === 1 ? 'bill' : 'bills'} land in specific months
              </Text>
            ) : null}
          </View>
          <PlanGroup
            title="Income"
            rows={income}
            allRows={rows}
            onChange={updateRow}
            onRemove={removeRow}
            onAddSub={addSubRow}
            onMove={moveRow}
            disabled={busy}
          />
          <PlanGroup
            title="Expenses"
            rows={expenses}
            allRows={rows}
            onChange={updateRow}
            onRemove={removeRow}
            onAddSub={addSubRow}
            onMove={moveRow}
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
  allRows,
  onChange,
  onRemove,
  onAddSub,
  onMove,
  disabled,
}: {
  title: string;
  rows: PlanRow[];
  allRows: PlanRow[];
  onChange: (key: string, patch: Partial<PlanRow>) => void;
  onRemove: (key: string) => void;
  onAddSub: (row: PlanRow) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {rows.map((row, index) => {
        const children = allRows.filter((item) => item.parentKey === row.key);
        return (
          <View key={row.key} style={styles.row}>
            <PlanRowFields
              row={row}
              onChange={onChange}
              onRemove={onRemove}
              onMove={onMove}
              canMoveUp={index > 0}
              canMoveDown={index < rows.length - 1}
              disabled={disabled}
            />
            <Pressable onPress={() => onAddSub(row)} disabled={disabled} hitSlop={8}>
              <Text style={styles.link}>Add subcategory</Text>
            </Pressable>
            {children.map((child, childIndex) => (
              <View key={child.key} style={styles.subRow}>
                <PlanRowFields
                  row={child}
                  onChange={onChange}
                  onRemove={onRemove}
                  onMove={onMove}
                  canMoveUp={childIndex > 0}
                  canMoveDown={childIndex < children.length - 1}
                  disabled={disabled}
                  nested
                />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function PlanRowFields({
  row,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  disabled,
  nested,
}: {
  row: PlanRow;
  onChange: (key: string, patch: Partial<PlanRow>) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  nested?: boolean;
}) {
  return (
    <>
      <View style={styles.rowFields}>
        <Field
          label={nested ? 'Subcategory' : 'Category'}
          value={row.name}
          onChangeText={(name) => onChange(row.key, { name })}
          placeholder={nested ? 'Netflix' : row.kind === 'income' ? 'Salary' : 'Groceries & food'}
          autoCapitalize="words"
          editable={!disabled}
        />
        <Field
          label={cadenceAmountLabel(row.cadence)}
          value={row.planned}
          onChangeText={(planned) => onChange(row.key, { planned })}
          placeholder="0"
          keyboardType="decimal-pad"
          editable={!disabled}
        />
      </View>
      <BudgetCadenceFields
        cadence={row.cadence}
        anchorMonth={row.anchorMonth}
        readOnly={disabled}
        onChange={(cadence, anchorMonth) => onChange(row.key, { cadence, anchorMonth })}
      />
      {row.kind === 'expense' && !nested ? (
        <View style={styles.wrap}>
          <Pill
            label="Leftover stays unassigned"
            active={!row.captureSurplus}
            onPress={disabled ? undefined : () => onChange(row.key, { captureSurplus: false })}
          />
          <Pill
            label="Leftover goes here"
            active={row.captureSurplus}
            onPress={disabled ? undefined : () => onChange(row.key, { captureSurplus: true })}
          />
        </View>
      ) : null}
      {row.captureSurplus ? (
        <Text style={styles.hint}>Whatever is left after actual spending this month is allocated here.</Text>
      ) : (
        <View style={styles.wrap}>
          <Pill label="Direct debit off" active={!row.autoApply} onPress={disabled ? undefined : () => onChange(row.key, { autoApply: false })} />
          <Pill label="Direct debit on" active={row.autoApply} onPress={disabled ? undefined : () => onChange(row.key, { autoApply: true })} />
        </View>
      )}
      <View style={styles.rowMeta}>
        <Pill label={row.kind === 'income' ? 'Income' : nested ? 'Subcategory' : 'Expense'} active />
        <View style={styles.rowMove}>
          <Pressable onPress={() => onMove(row.key, -1)} disabled={disabled || !canMoveUp} hitSlop={8}>
            <Text style={[styles.link, (disabled || !canMoveUp) && styles.moveDisabled]}>Up</Text>
          </Pressable>
          <Pressable onPress={() => onMove(row.key, 1)} disabled={disabled || !canMoveDown} hitSlop={8}>
            <Text style={[styles.link, (disabled || !canMoveDown) && styles.moveDisabled]}>Down</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(row.key)} disabled={disabled} hitSlop={8}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </>
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
  subRow: { gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, marginTop: 8 },
  rowFields: { gap: 8 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowMove: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveDisabled: { color: colors.textDim },
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
