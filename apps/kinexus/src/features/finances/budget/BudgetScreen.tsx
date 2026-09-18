import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  budgetTotals,
  canManageFinances,
  defaultTxnDateForMonth,
  formatMoney,
  isBudgetSet,
  lineProgress,
  linesForMonth,
  linesOfKind,
  monthLabel,
  monthStartIso,
  monthSummaries,
  shiftMonth,
  spendStatus,
  txnsForBudgetLine,
  txnsInMonth,
  type FinanceBudgetLine,
  type FinanceBudgetLineKind,
  type FinanceBudgetTxn,
  type SpendStatus,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome, MoneyBar } from '@/src/features/finances/FinancesShared';
import { BudgetEntrySheet, BudgetLineSheet } from '@/src/features/finances/sheets';
import { BudgetSetupSheet } from '@/src/features/finances/budget/BudgetSetupSheet';
import { actionErrorMessage, useFinancesSync, type BudgetLineDraft } from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function BudgetScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [setupOpen, setSetupOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceBudgetLine | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [addingTo, setAddingTo] = useState<FinanceBudgetLine | null>(null);
  const [defaultKind, setDefaultKind] = useState<FinanceBudgetLineKind>('expense');
  const [monthStart, setMonthStart] = useState(() => monthStartIso());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const budgetReady = isBudgetSet(finances.lines, finances.txns, finances.budget?.setupCompletedAt);
  const monthLines = useMemo(
    () => linesForMonth(finances.lines, finances.txns, monthStart),
    [finances.lines, finances.txns, monthStart],
  );
  const monthTxns = useMemo(() => txnsInMonth(finances.txns, monthStart), [finances.txns, monthStart]);
  const totals = useMemo(() => budgetTotals(monthLines), [monthLines]);
  const monthStatus = useMemo(
    () => spendStatus(totals.expensePlanned, totals.expenseSpent),
    [totals.expensePlanned, totals.expenseSpent],
  );
  const income = useMemo(() => linesOfKind(monthLines, 'income'), [monthLines]);
  const expenses = useMemo(() => linesOfKind(monthLines, 'expense'), [monthLines]);
  const history = useMemo(() => {
    const items = monthSummaries(finances.lines, finances.txns);
    if (items.some((item) => item.monthStart === monthStart)) return items;
    return [...items, {
      monthStart,
      label: monthLabel(monthStart),
      incomePlanned: totals.incomePlanned,
      incomeSpent: totals.incomeSpent,
      expensePlanned: totals.expensePlanned,
      expenseSpent: totals.expenseSpent,
      leftoverPlanned: totals.leftoverPlanned,
      leftoverActual: totals.leftoverActual,
      over: monthStatus.over,
      overBy: monthStatus.overBy,
      left: monthStatus.left,
    }].sort((a, b) => a.monthStart.localeCompare(b.monthStart));
  }, [finances.lines, finances.txns, monthStart, monthStatus, totals]);

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

  async function confirmClearBudget() {
    const message = 'This removes categories, planned amounts, and every monthly entry.';
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Clear the whole budget?\n\n${message}`)
        : await new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
              if (settled) return;
              settled = true;
              resolve(value);
            };
            Alert.alert(
              'Clear budget?',
              message,
              [
                { text: 'Keep', style: 'cancel', onPress: () => settle(false) },
                { text: 'Clear', style: 'destructive', onPress: () => settle(true) },
              ],
              { cancelable: true, onDismiss: () => settle(false) },
            );
          });
    if (!confirmed) return;
    setSetupOpen(false);
    await run(() => finances.clearBudget());
  }

  if (finances.loading && finances.lines.length === 0 && finances.txns.length === 0) {
    return <LoadingState label="Loading budget…" />;
  }

  return (
    <>
      <FinancesChrome
        desktop={desktop}
        kicker={budgetReady ? monthLabel(monthStart) : 'Household'}
        title="Budget"
        subtitle={
          budgetReady
            ? 'Each category keeps a set monthly amount. Add this month’s spend as you go, or look back at months that ran over.'
            : 'Set the household budget once. Upload transactions to fill it, or add categories and amounts yourself.'
        }>
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        {!budgetReady ? (
          <EmptyState
            title="No budget yet"
            body="Set income and spending categories for a typical month. Upload a year of bank transactions to fill them from your averages, or enter amounts yourself.">
            {canManage ? (
              <Btn label="Set budget" onPress={() => setSetupOpen(true)} disabled={!finances.online} />
            ) : (
              <Text style={styles.meta}>Ask a household admin to set the budget.</Text>
            )}
          </EmptyState>
        ) : (
          <>
            <MonthNav
              monthStart={monthStart}
              history={history}
              currency={finances.currency}
              onPrev={() => setMonthStart((value) => shiftMonth(value, -1))}
              onNext={() => setMonthStart((value) => shiftMonth(value, 1))}
              onSelect={setMonthStart}
            />
            <MonthStatus
              status={monthStatus}
              incomeSet={totals.incomePlanned}
              incomeIn={totals.incomeSpent}
              currency={finances.currency}
            />
            {canManage ? (
              <View style={styles.actions}>
                <Btn
                  label="Add item"
                  onPress={() => {
                    setAddingTo(null);
                    setEntryOpen(true);
                  }}
                  disabled={!finances.online}
                />
                <Btn label="Edit plan" variant="secondary" onPress={() => setSetupOpen(true)} disabled={!finances.online} />
                <Btn
                  label="Add category"
                  variant="secondary"
                  onPress={() => {
                    setEditing(null);
                    setDefaultKind('expense');
                    setLineOpen(true);
                  }}
                  disabled={!finances.online}
                />
                <Btn
                  label="Clear budget"
                  variant="danger"
                  onPress={() => void confirmClearBudget()}
                  disabled={!finances.online || busy}
                />
              </View>
            ) : null}
            <LineGroup
              title="Income"
              lines={income}
              txns={monthTxns}
              currency={finances.currency}
              canManage={canManage}
              onEdit={(line) => {
                setEditing(line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onAdd={(line) => {
                setAddingTo(line);
                setEntryOpen(true);
              }}
              onDeleteTxn={(id) => void run(() => finances.deleteTxn(id))}
            />
            <LineGroup
              title="Expenses"
              lines={expenses}
              txns={monthTxns}
              currency={finances.currency}
              canManage={canManage}
              onEdit={(line) => {
                setEditing(line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onAdd={(line) => {
                setAddingTo(line);
                setEntryOpen(true);
              }}
              onDeleteTxn={(id) => void run(() => finances.deleteTxn(id))}
            />
          </>
        )}
      </FinancesChrome>
      <BudgetSetupSheet
        visible={setupOpen}
        lines={finances.lines}
        txns={finances.txns}
        currency={finances.currency}
        busy={busy}
        error={actionError}
        onClose={() => {
          setSetupOpen(false);
          setActionError(null);
        }}
        onSave={async (drafts) => {
          const ok = await run(() => finances.saveBudgetPlan(drafts));
          if (ok) setSetupOpen(false);
        }}
        onApplyStatement={async (draft, setPlanned) => {
          await run(() =>
            finances.applyStatementBudget({
              lines: draft.lines,
              transactions: draft.transactions,
              setPlanned,
            }),
          );
        }}
        onReclassify={async (assignment, txnIds) => {
          if (txnIds.length === 0) return;
          await run(() => finances.reclassifyTxns({ assignment, txnIds }));
        }}
      />
      <BudgetLineSheet
        visible={lineOpen}
        line={editing}
        defaultKind={defaultKind}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setLineOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: BudgetLineDraft) => {
          const ok = await run(() => (editing ? finances.updateLine(editing.id, draft) : finances.createLine(draft)));
          if (ok) setLineOpen(false);
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteLine(editing.id));
                if (ok) setLineOpen(false);
              }
            : undefined
        }
      />
      <BudgetEntrySheet
        visible={entryOpen}
        lines={finances.lines}
        selectedLineId={addingTo?.id ?? null}
        monthLabel={monthLabel(monthStart)}
        currency={finances.currency}
        busy={busy}
        error={actionError}
        onClose={() => {
          setEntryOpen(false);
          setAddingTo(null);
          setActionError(null);
        }}
        onSave={async (draft, line) => {
          const ok = await run(() =>
            finances.createTxn(line.id, { ...draft, date: defaultTxnDateForMonth(monthStart) }, monthStart),
          );
          if (ok) {
            setEntryOpen(false);
            setAddingTo(null);
          }
        }}
      />
    </>
  );
}

function MonthNav({
  monthStart,
  history,
  currency,
  onPrev,
  onNext,
  onSelect,
}: {
  monthStart: string;
  history: ReturnType<typeof monthSummaries>;
  currency: string;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (monthStart: string) => void;
}) {
  return (
    <View style={styles.monthNav}>
      <View style={styles.monthHead}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.monthBtn}>
          <Text style={styles.monthBtnLabel}>Prev</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel(monthStart)}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.monthBtn}>
          <Text style={styles.monthBtnLabel}>Next</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.history}>
        {history.map((item) => {
          const active = item.monthStart === monthStart;
          return (
            <Pressable
              key={item.monthStart}
              onPress={() => onSelect(item.monthStart)}
              style={[styles.historyChip, active && styles.historyChipOn, item.over && styles.historyChipOver]}>
              <Text style={[styles.historyLabel, active && styles.historyLabelOn]}>{item.label}</Text>
              <Text style={[styles.historyMeta, item.over && styles.historyOver]}>
                {item.over ? `${formatMoney(item.overBy, currency)} over` : 'On track'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MonthStatus({
  status,
  incomeSet,
  incomeIn,
  currency,
}: {
  status: SpendStatus;
  incomeSet: number;
  incomeIn: number;
  currency: string;
}) {
  return (
    <View style={[styles.statusCard, status.over && styles.statusCardOver]}>
      <View style={styles.figures}>
        <Figure label="Budget" value={formatMoney(status.budget, currency)} />
        <Figure label="Spent" value={formatMoney(status.spent, currency)} />
        <Figure
          label={status.over ? 'Over by' : 'Left'}
          value={formatMoney(status.over ? status.overBy : status.left, currency)}
          danger={status.over}
        />
      </View>
      <MoneyBar progress={status.budget > 0 ? status.spent / status.budget : status.spent > 0 ? 1 : 0} over={status.over} />
      <Text style={[styles.statusCopy, status.over && styles.statusCopyOver]}>
        {status.over
          ? `Spent ${formatMoney(status.spent, currency)} of the ${formatMoney(status.budget, currency)} budget — ${formatMoney(status.overBy, currency)} over this month.`
          : `Spent ${formatMoney(status.spent, currency)} of the ${formatMoney(status.budget, currency)} budget — ${formatMoney(status.left, currency)} left this month.`}
      </Text>
      <Text style={styles.meta}>
        Income {formatMoney(incomeIn, currency)} in of {formatMoney(incomeSet, currency)} set
      </Text>
    </View>
  );
}

function Figure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, danger && styles.figureDanger]}>{value}</Text>
    </View>
  );
}

function LineGroup({
  title,
  lines,
  txns,
  currency,
  canManage,
  onEdit,
  onAdd,
  onDeleteTxn,
}: {
  title: string;
  lines: FinanceBudgetLine[];
  txns: FinanceBudgetTxn[];
  currency: string;
  canManage: boolean;
  onEdit: (line: FinanceBudgetLine) => void;
  onAdd: (line: FinanceBudgetLine) => void;
  onDeleteTxn: (id: string) => void;
}) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {lines.map((line) => (
        <BudgetLineCard
          key={line.id}
          line={line}
          txns={txns}
          currency={currency}
          canManage={canManage}
          onEdit={() => onEdit(line)}
          onAdd={() => onAdd(line)}
          onDeleteTxn={onDeleteTxn}
        />
      ))}
    </View>
  );
}

function BudgetLineCard({
  line,
  txns,
  currency,
  canManage,
  onEdit,
  onAdd,
  onDeleteTxn,
}: {
  line: FinanceBudgetLine;
  txns: FinanceBudgetTxn[];
  currency: string;
  canManage: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onDeleteTxn: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => txnsForBudgetLine(txns, line.id), [line.id, txns]);
  const status = spendStatus(line.planned, line.spent);
  return (
    <View style={styles.line}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.lineHead}>
        <View style={styles.previewCopy}>
          <Text style={styles.lineName}>{line.name}</Text>
          <View style={styles.lineFigures}>
            <Figure label="Budget" value={formatMoney(status.budget, currency)} />
            <Figure label="Spent" value={formatMoney(status.spent, currency)} />
            <Figure
              label={line.kind === 'income' ? (status.over ? 'Over set' : 'To go') : status.over ? 'Over by' : 'Left'}
              value={formatMoney(status.over ? status.overBy : status.left, currency)}
              danger={line.kind === 'expense' && status.over}
            />
          </View>
          <Text style={styles.lineMeta}>
            {entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : 'No entries'}
            {open ? ' · hide' : ' · show'}
          </Text>
        </View>
      </Pressable>
      <MoneyBar progress={lineProgress(line)} over={status.over && line.kind === 'expense'} />
      {canManage ? (
        <View style={styles.lineActions}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              onEdit();
            }}
            hitSlop={8}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              onAdd();
            }}
            hitSlop={8}>
            <Text style={styles.edit}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      {open ? (
        entries.length === 0 ? (
          <Text style={styles.lineMeta}>No entries this month.</Text>
        ) : (
          <View style={styles.entries}>
            {entries.map((txn) => (
              <View key={txn.id} style={styles.txnRow}>
                <Text style={styles.txnDate}>{formatTxnDate(txn.date)}</Text>
                <Text style={styles.txnDesc} numberOfLines={2}>
                  {txn.description}
                </Text>
                <Text style={styles.txnAmount}>{formatMoney(Math.abs(txn.amount), currency)}</Text>
                {canManage ? (
                  <Pressable onPress={() => onDeleteTxn(txn.id)} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function formatTxnDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
  },
  statusCardOver: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  figure: { flex: 1, minWidth: 96, gap: 2 },
  figureLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  figureValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  figureDanger: { color: colors.danger },
  statusCopy: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  statusCopyOver: { color: colors.danger },
  meta: { color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthNav: { gap: 10 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  monthTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  monthBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthBtnLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  history: { gap: 8, paddingRight: 8 },
  historyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 110,
  },
  historyChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  historyChipOver: { borderColor: colors.danger },
  historyLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  historyLabelOn: { color: colors.accent },
  historyMeta: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  historyOver: { color: colors.danger },
  group: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 10,
  },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  line: { gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  lineHead: { gap: 8 },
  previewCopy: { gap: 8 },
  lineName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lineFigures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  lineMeta: { color: colors.textDim, fontSize: 12 },
  lineActions: { flexDirection: 'row', gap: 16 },
  edit: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  entries: { gap: 4 },
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  txnDate: { color: colors.textDim, fontSize: 12, width: 64 },
  txnDesc: { color: colors.text, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 18 },
  txnAmount: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
