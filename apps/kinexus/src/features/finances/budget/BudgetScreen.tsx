import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  budgetLineGroups,
  budgetTotals,
  canManageFinances,
  cadenceDueLabel,
  cadenceDueMonths,
  cadenceLabel,
  defaultTxnDateForMonth,
  deferredPeriodicalLines,
  formatMoney,
  isBudgetSet,
  linePathName,
  lineProgress,
  linesForMonth,
  MONTH_SHORT_NAMES,
  monthLabel,
  monthStartIso,
  monthSummaries,
  rollupLine,
  shiftMonth,
  spendStatus,
  surplusCaptureLine,
  txnsForBudgetLine,
  txnsInMonth,
  visibleLinesForMonth,
  type BudgetLineGroup,
  type FinanceBudgetLine,
  type FinanceBudgetLineKind,
  type FinanceBudgetTxn,
  type SpendStatus,
} from '@kinexus/domain';

import { Btn, ErrorText, Pill } from '@/src/features/household/ui';
import { FinancesChrome, MoneyBar } from '@/src/features/finances/FinancesShared';
import { BudgetEntrySheet, BudgetLineSheet } from '@/src/features/finances/sheets';
import { BudgetSetupSheet } from '@/src/features/finances/budget/BudgetSetupSheet';
import { actionErrorMessage, useFinancesSync, type BudgetLineDraft } from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const SPREAD_KEY = 'kinexus.budget.spreadPeriodical';

function readSpreadPeriodical(): boolean {
  try {
    return globalThis.localStorage?.getItem(SPREAD_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSpreadPeriodical(value: boolean) {
  try {
    globalThis.localStorage?.setItem(SPREAD_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

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
  const [parentForNew, setParentForNew] = useState<FinanceBudgetLine | null>(null);
  const [monthStart, setMonthStart] = useState(() => monthStartIso());
  const [spreadPeriodical, setSpreadPeriodical] = useState(readSpreadPeriodical);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const monthView = useMemo(() => ({ spreadPeriodical }), [spreadPeriodical]);
  const budgetReady = isBudgetSet(finances.lines, finances.txns, finances.budget?.setupCompletedAt);
  const monthLines = useMemo(
    () => linesForMonth(finances.lines, finances.txns, monthStart, monthView),
    [finances.lines, finances.txns, monthStart, monthView],
  );
  const monthTxns = useMemo(() => txnsInMonth(finances.txns, monthStart), [finances.txns, monthStart]);
  const totals = useMemo(() => budgetTotals(monthLines), [monthLines]);
  const monthStatus = useMemo(
    () => spendStatus(totals.expensePlanned, totals.expenseSpent),
    [totals.expensePlanned, totals.expenseSpent],
  );
  const visibleLines = useMemo(
    () => visibleLinesForMonth(monthLines, monthStart, monthView),
    [monthLines, monthStart, monthView],
  );
  const income = useMemo(
    () => budgetLineGroups(visibleLines.filter((line) => line.kind === 'income')),
    [visibleLines],
  );
  const expenses = useMemo(
    () => budgetLineGroups(visibleLines.filter((line) => line.kind === 'expense')),
    [visibleLines],
  );
  const periodical = useMemo(
    () => deferredPeriodicalLines(finances.lines, monthLines, monthStart, monthView),
    [finances.lines, monthLines, monthStart, monthView],
  );
  const surplusSink = useMemo(() => surplusCaptureLine(visibleLines) ?? surplusCaptureLine(finances.lines), [finances.lines, visibleLines]);
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
            ? spreadPeriodical
              ? 'Periodical bills are shown as monthly amounts in their categories.'
              : 'Monthly costs apply every month. Every-second-month, quarterly, and yearly bills only show when they are due — open Periodical expenses for the rest.'
            : 'Set the household budget once. Mark bills that only come due some months, or upload transactions to fill the rest.'
        }>
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        {!budgetReady ? (
          <EmptyState
            title="No budget yet"
            body="Set income and spending for a typical month, and mark utilities, insurance, or rates as every second month, quarterly, or yearly so they land in the month they are due.">
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
              incomePlanned={totals.incomePlanned}
              expensePlanned={totals.expensePlanned}
              leftoverPlanned={totals.leftoverPlanned}
              status={monthStatus}
              currency={finances.currency}
              surplusSinkName={surplusSink?.name ?? null}
            />
            <SpreadToggle
              value={spreadPeriodical}
              onChange={(value) => {
                setSpreadPeriodical(value);
                writeSpreadPeriodical(value);
              }}
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
                    setParentForNew(null);
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
              groups={income}
              monthLines={monthLines}
              txns={monthTxns}
              currency={finances.currency}
              canManage={canManage}
              spreadPeriodical={spreadPeriodical}
              onEdit={(line) => {
                setParentForNew(null);
                setEditing(finances.lines.find((item) => item.id === line.id) ?? line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onAdd={(line) => {
                setAddingTo(line);
                setEntryOpen(true);
              }}
              onAddSub={(line) => {
                setEditing(null);
                setParentForNew(finances.lines.find((item) => item.id === line.id) ?? line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onMove={(line, direction, amongIds) => void run(() => finances.moveLine(line.id, direction, amongIds))}
              onDeleteTxn={(id) => void run(() => finances.deleteTxn(id))}
            />
            <LineGroup
              title="Expenses"
              groups={expenses}
              monthLines={monthLines}
              txns={monthTxns}
              currency={finances.currency}
              canManage={canManage}
              spreadPeriodical={spreadPeriodical}
              onEdit={(line) => {
                setParentForNew(null);
                setEditing(finances.lines.find((item) => item.id === line.id) ?? line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onAdd={(line) => {
                setAddingTo(line);
                setEntryOpen(true);
              }}
              onAddSub={(line) => {
                setEditing(null);
                setParentForNew(finances.lines.find((item) => item.id === line.id) ?? line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
              onMove={(line, direction, amongIds) => void run(() => finances.moveLine(line.id, direction, amongIds))}
              onDeleteTxn={(id) => void run(() => finances.deleteTxn(id))}
            />
            <PeriodicalSection
              lines={periodical}
              allLines={finances.lines}
              monthStart={monthStart}
              currency={finances.currency}
              canManage={canManage}
              onEdit={(line) => {
                setParentForNew(null);
                setEditing(line);
                setDefaultKind(line.kind);
                setLineOpen(true);
              }}
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
        lines={finances.lines}
        defaultKind={defaultKind}
        forcedParentId={parentForNew?.id ?? null}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setLineOpen(false);
          setParentForNew(null);
          setActionError(null);
        }}
        onSave={async (draft: BudgetLineDraft) => {
          const ok = await run(() => (editing ? finances.updateLine(editing.id, draft) : finances.createLine(draft)));
          if (ok) {
            setLineOpen(false);
            setParentForNew(null);
          }
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteLine(editing.id));
                if (ok) {
                  setLineOpen(false);
                  setParentForNew(null);
                }
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

function SpreadToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleCard}>
      <Text style={styles.toggleTitle}>Periodical bills</Text>
      <View style={styles.toggleRow}>
        <Pill label="As they fall due" active={!value} onPress={() => onChange(false)} />
        <Pill label="As monthly amounts" active={value} onPress={() => onChange(true)} />
      </View>
      <Text style={styles.meta}>
        {value
          ? 'Every-second-month, quarterly, and yearly bills are divided into a monthly amount and shown in their categories.'
          : 'Only bills due this month sit in the list. The rest are under Periodical expenses.'}
      </Text>
    </View>
  );
}

function MonthStatus({
  incomePlanned,
  expensePlanned,
  leftoverPlanned,
  status,
  currency,
  surplusSinkName,
}: {
  incomePlanned: number;
  expensePlanned: number;
  leftoverPlanned: number;
  status: SpendStatus;
  currency: string;
  surplusSinkName?: string | null;
}) {
  const deficit = leftoverPlanned < 0;
  const surplus = leftoverPlanned > 0;
  const leftoverLabel = deficit ? 'Deficit' : leftoverPlanned === 0 ? 'Balanced' : 'Surplus';
  return (
    <View style={[styles.statusCard, deficit && styles.statusCardOver, surplus && styles.statusCardGood]}>
      <View style={styles.figures}>
        <Figure label="Income" value={formatMoney(incomePlanned, currency)} />
        <Figure label="Budgeted" value={formatMoney(expensePlanned, currency)} />
        <Figure
          label={leftoverLabel}
          value={formatMoney(Math.abs(leftoverPlanned), currency)}
          danger={deficit}
          good={surplus}
        />
      </View>
      <Text style={[styles.statusCopy, deficit && styles.statusCopyOver, surplus && styles.statusCopyGood]}>
        {deficit
          ? `${formatMoney(incomePlanned, currency)} income · ${formatMoney(expensePlanned, currency)} budgeted · ${formatMoney(Math.abs(leftoverPlanned), currency)} short this month.`
          : leftoverPlanned === 0
            ? `${formatMoney(incomePlanned, currency)} income matches ${formatMoney(expensePlanned, currency)} budgeted this month.`
            : `${formatMoney(incomePlanned, currency)} income · ${formatMoney(expensePlanned, currency)} budgeted · ${formatMoney(leftoverPlanned, currency)} surplus this month.`}
      </Text>
      {surplusSinkName ? (
        <Text style={styles.meta}>
          {deficit
            ? `Nothing extra is allocated to ${surplusSinkName} until spending is under income.`
            : leftoverPlanned === 0
              ? `Leftover after spending is allocated to ${surplusSinkName}.`
              : `Leftover after actual spending is allocated to ${surplusSinkName}.`}
        </Text>
      ) : null}
      <MoneyBar progress={status.budget > 0 ? status.spent / status.budget : status.spent > 0 ? 1 : 0} over={status.over} />
      <Text style={[styles.meta, status.over && styles.statusCopyOver]}>
        {status.over
          ? `Spent ${formatMoney(status.spent, currency)} so far — ${formatMoney(status.overBy, currency)} over the month’s budget.`
          : `Spent ${formatMoney(status.spent, currency)} so far · ${formatMoney(status.left, currency)} of the month’s budget left.`}
      </Text>
    </View>
  );
}

function Figure({ label, value, danger, good }: { label: string; value: string; danger?: boolean; good?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, danger && styles.figureDanger, good && styles.figureGood]}>{value}</Text>
    </View>
  );
}

function LineGroup({
  title,
  groups,
  monthLines,
  txns,
  currency,
  canManage,
  spreadPeriodical,
  onEdit,
  onAdd,
  onAddSub,
  onMove,
  onDeleteTxn,
}: {
  title: string;
  groups: BudgetLineGroup[];
  monthLines: FinanceBudgetLine[];
  txns: FinanceBudgetTxn[];
  currency: string;
  canManage: boolean;
  spreadPeriodical: boolean;
  onEdit: (line: FinanceBudgetLine) => void;
  onAdd: (line: FinanceBudgetLine) => void;
  onAddSub: (line: FinanceBudgetLine) => void;
  onMove: (line: FinanceBudgetLine, direction: -1 | 1, amongIds: readonly string[]) => void;
  onDeleteTxn: (id: string) => void;
}) {
  if (groups.length === 0) return null;
  const parentIds = groups.map((group) => group.parent.id);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {groups.map((group, index) => (
        <BudgetCategoryBlock
          key={group.parent.id}
          group={group}
          monthLines={monthLines}
          txns={txns}
          currency={currency}
          canManage={canManage}
          spreadPeriodical={spreadPeriodical}
          canMoveUp={index > 0}
          canMoveDown={index < groups.length - 1}
          onEdit={onEdit}
          onAdd={onAdd}
          onAddSub={onAddSub}
          onMove={onMove}
          onMoveParent={(direction) => onMove(group.parent, direction, parentIds)}
          onDeleteTxn={onDeleteTxn}
        />
      ))}
    </View>
  );
}

function BudgetCategoryBlock({
  group,
  monthLines,
  txns,
  currency,
  canManage,
  spreadPeriodical,
  canMoveUp,
  canMoveDown,
  onEdit,
  onAdd,
  onAddSub,
  onMove,
  onMoveParent,
  onDeleteTxn,
}: {
  group: BudgetLineGroup;
  monthLines: FinanceBudgetLine[];
  txns: FinanceBudgetTxn[];
  currency: string;
  canManage: boolean;
  spreadPeriodical: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: (line: FinanceBudgetLine) => void;
  onAdd: (line: FinanceBudgetLine) => void;
  onAddSub: (line: FinanceBudgetLine) => void;
  onMove: (line: FinanceBudgetLine, direction: -1 | 1, amongIds: readonly string[]) => void;
  onMoveParent: (direction: -1 | 1) => void;
  onDeleteTxn: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const childCount = group.children.length;
  const childIds = group.children.map((child) => child.id);
  return (
    <View style={styles.lineBlock}>
      <BudgetLineCard
        line={group.parent}
        monthLines={monthLines}
        txns={txns}
        currency={currency}
        canManage={canManage}
        spreadPeriodical={spreadPeriodical}
        childCount={childCount}
        groupOpen={childCount > 0 ? expanded : undefined}
        onToggleGroup={childCount > 0 ? () => setExpanded((value) => !value) : undefined}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMoveParent}
        onEdit={() => onEdit(group.parent)}
        onAdd={() => onAdd(group.parent)}
        onAddSub={group.parent.parentId ? undefined : () => onAddSub(group.parent)}
        onDeleteTxn={onDeleteTxn}
      />
      {childCount > 0 && expanded
        ? group.children.map((child, index) => (
            <View key={child.id} style={styles.subLine}>
              <BudgetLineCard
                line={child}
                monthLines={monthLines}
                txns={txns}
                currency={currency}
                canManage={canManage}
                spreadPeriodical={spreadPeriodical}
                nested
                canMoveUp={index > 0}
                canMoveDown={index < group.children.length - 1}
                onMove={(direction) => onMove(child, direction, childIds)}
                onEdit={() => onEdit(child)}
                onAdd={() => onAdd(child)}
                onDeleteTxn={onDeleteTxn}
              />
            </View>
          ))
        : null}
    </View>
  );
}

function BudgetLineCard({
  line,
  monthLines,
  txns,
  currency,
  canManage,
  spreadPeriodical,
  nested,
  childCount = 0,
  groupOpen,
  onToggleGroup,
  canMoveUp,
  canMoveDown,
  onMove,
  onEdit,
  onAdd,
  onAddSub,
  onDeleteTxn,
}: {
  line: FinanceBudgetLine;
  monthLines: FinanceBudgetLine[];
  txns: FinanceBudgetTxn[];
  currency: string;
  canManage: boolean;
  spreadPeriodical: boolean;
  nested?: boolean;
  childCount?: number;
  groupOpen?: boolean;
  onToggleGroup?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: -1 | 1) => void;
  onEdit: () => void;
  onAdd: () => void;
  onAddSub?: () => void;
  onDeleteTxn: (id: string) => void;
}) {
  const [entriesOpen, setEntriesOpen] = useState(false);
  const grouped = childCount > 0;
  const open = grouped ? Boolean(groupOpen) : entriesOpen;
  const entries = useMemo(() => txnsForBudgetLine(txns, line.id), [line.id, txns]);
  const rolled = useMemo(() => rollupLine(line, monthLines), [line, monthLines]);
  const status = spendStatus(rolled.planned, rolled.spent);
  const capture = Boolean(line.captureSurplus);
  const meta = grouped
    ? `${childCount} ${childCount === 1 ? 'subcategory' : 'subcategories'} · ${open ? 'hide' : 'show'}`
    : `${entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : 'No entries'}${open ? ' · hide' : ' · show'}`;
  return (
    <View style={[styles.line, nested && styles.lineNested]}>
      <Pressable
        onPress={() => (grouped ? onToggleGroup?.() : setEntriesOpen((value) => !value))}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.lineHead}>
        <View style={styles.lineHeadRow}>
          <View style={styles.previewCopy}>
            <Text style={[styles.lineName, nested && styles.subName]}>{line.name}</Text>
            <View style={styles.lineFigures}>
              <Figure label={capture ? 'Target' : 'Budget'} value={formatMoney(status.budget, currency)} />
              <Figure label={capture ? 'Allocated' : 'Spent'} value={formatMoney(status.spent, currency)} good={capture && status.spent > 0} />
              <Figure
                label={
                  capture
                    ? status.over
                      ? 'Above target'
                      : status.budget > 0
                        ? 'To target'
                        : 'Leftover'
                    : line.kind === 'income'
                      ? status.over
                        ? 'Over set'
                        : 'To go'
                      : status.over
                        ? 'Over by'
                        : 'Left'
                }
                value={formatMoney(status.over ? status.overBy : status.left, currency)}
                danger={!capture && line.kind === 'expense' && status.over}
                good={capture && status.over}
              />
            </View>
            <Text style={styles.lineMeta}>
              {capture ? 'Leftover after spending is allocated here · ' : line.autoApply ? 'Direct debit · ' : ''}
              {line.cadence === 'monthly'
                ? ''
                : spreadPeriodical
                  ? `${cadenceLabel(line.cadence)} · as monthly · `
                  : `${cadenceLabel(line.cadence)} · due ${cadenceDueLabel(line.cadence, line.anchorMonth)} · `}
              {meta}
            </Text>
          </View>
          {grouped ? <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text> : null}
        </View>
      </Pressable>
      <MoneyBar progress={lineProgress(rolled)} over={!capture && status.over && line.kind === 'expense'} />
      {canManage ? (
        <View style={styles.lineActions}>
          {onMove ? (
            <>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  onMove(-1);
                }}
                disabled={!canMoveUp}
                hitSlop={8}>
                <Text style={[styles.edit, !canMoveUp && styles.moveDisabled]}>Up</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  onMove(1);
                }}
                disabled={!canMoveDown}
                hitSlop={8}>
                <Text style={[styles.edit, !canMoveDown && styles.moveDisabled]}>Down</Text>
              </Pressable>
            </>
          ) : null}
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
          {onAddSub ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.();
                onAddSub();
              }}
              hitSlop={8}>
              <Text style={styles.edit}>Add subcategory</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {open && !grouped ? (
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
      {open && grouped && entries.length > 0 ? (
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
      ) : null}
    </View>
  );
}

function PeriodicalSection({
  lines,
  allLines,
  monthStart,
  currency,
  canManage,
  onEdit,
}: {
  lines: FinanceBudgetLine[];
  allLines: readonly FinanceBudgetLine[];
  monthStart: string;
  currency: string;
  canManage: boolean;
  onEdit: (line: FinanceBudgetLine) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentMonth = Number(monthStart.slice(5, 7));
  if (lines.length === 0) return null;
  return (
    <View style={styles.group}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.periodicalHead}>
        <View style={styles.previewCopy}>
          <Text style={styles.groupTitle}>Periodical expenses</Text>
          <Text style={styles.meta}>
            {open ? 'Hide' : 'Show'} {lines.length} {lines.length === 1 ? 'bill' : 'bills'} that don’t fall in {monthLabel(monthStart)}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open
        ? lines.map((line) => {
            const due = cadenceDueMonths(line.cadence, line.anchorMonth);
            return (
              <View key={line.id} style={styles.periodicalRow}>
                <Text style={styles.lineName}>{linePathName(line, allLines)}</Text>
                <Text style={styles.lineMeta}>
                  {line.kind === 'income' ? 'Income · ' : ''}
                  {cadenceLabel(line.cadence)} · {formatMoney(line.planned, currency)}
                  {line.autoApply ? ' · Direct debit' : ''}
                </Text>
                <View style={styles.monthChips}>
                  {due.map((month) => (
                    <View key={month} style={[styles.monthChip, month === currentMonth && styles.monthChipOn]}>
                      <Text style={[styles.monthChipLabel, month === currentMonth && styles.monthChipLabelOn]}>
                        {MONTH_SHORT_NAMES[month - 1]}
                      </Text>
                    </View>
                  ))}
                </View>
                {canManage ? (
                  <Pressable onPress={() => onEdit(line)} hitSlop={8}>
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        : null}
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
  statusCardGood: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  figure: { flex: 1, minWidth: 96, gap: 2 },
  figureLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  figureValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  figureDanger: { color: colors.danger },
  figureGood: { color: colors.accent },
  statusCopy: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  statusCopyOver: { color: colors.danger },
  statusCopyGood: { color: colors.accent },
  meta: { color: colors.textMuted, fontSize: 13 },
  toggleCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 10,
  },
  toggleTitle: { color: colors.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  lineBlock: { gap: 0 },
  line: { gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  lineNested: { borderTopWidth: 0, paddingTop: 4 },
  subLine: { paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: colors.border, marginLeft: 4 },
  subName: { fontSize: 15, fontWeight: '700' },
  lineHead: { gap: 8 },
  lineHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  previewCopy: { gap: 8 },
  lineName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lineFigures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  lineMeta: { color: colors.textDim, fontSize: 12 },
  lineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  edit: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  moveDisabled: { color: colors.textDim },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  entries: { gap: 4 },
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  txnDate: { color: colors.textDim, fontSize: 12, width: 64 },
  txnDesc: { color: colors.text, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 18 },
  txnAmount: { color: colors.text, fontSize: 12, fontWeight: '700' },
  periodicalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chevron: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  periodicalRow: { gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  monthChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  monthChipLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  monthChipLabelOn: { color: colors.accent },
});
