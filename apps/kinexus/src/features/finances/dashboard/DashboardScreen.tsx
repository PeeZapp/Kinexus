import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  accountsOfClass,
  budgetTotals,
  canManageFinances,
  collectiblesTotal,
  formatMoney,
  linesForMonth,
  monthStartIso,
  netWorth,
  portfolioTotals,
  withCollectibles,
  withListedShares,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome, MoneyBar, StatCard } from '@/src/features/finances/FinancesShared';
import { actionErrorMessage, useFinancesSync } from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function DashboardScreen() {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { role, activeHousehold } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const summary = useMemo(
    () =>
      withCollectibles(
        withListedShares(netWorth(finances.accounts), portfolioTotals(finances.holdings).marketValue),
        collectiblesTotal(finances.collectibles),
      ),
    [finances.accounts, finances.collectibles, finances.holdings],
  );
  const monthLines = useMemo(
    () => linesForMonth(finances.lines, finances.txns, monthStartIso()),
    [finances.lines, finances.txns],
  );
  const budget = useMemo(() => budgetTotals(monthLines), [monthLines]);
  const assetMax = Math.max(...summary.groups.filter((group) => group.class === 'asset').map((group) => group.total), 1);

  if (finances.loading && finances.accounts.length === 0 && finances.lines.length === 0) {
    return <LoadingState label="Opening Money…" />;
  }

  return (
    <FinancesChrome
      desktop={desktop}
      kicker={activeHousehold?.name ?? 'Family'}
      title="Dashboard"
      subtitle="What the household owns, what it owes, listed shares, and the monthly budget.">
      <ErrorText message={finances.error ? actionErrorMessage(finances.error) : null} />
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Family net worth</Text>
        <Text style={styles.heroValue}>{formatMoney(summary.netWorth, finances.currency)}</Text>
        <Text style={styles.heroHint}>
          {formatMoney(summary.assets, finances.currency)} owned · {formatMoney(summary.liabilities, finances.currency)} owed
        </Text>
      </View>
      <View style={styles.row}>
        <StatCard
          label="Assets"
          value={formatMoney(summary.assets, finances.currency)}
          hint={`${accountsOfClass(finances.accounts, 'asset').length} accounts`}
        />
        <StatCard
          label="Debts"
          value={formatMoney(summary.liabilities, finances.currency)}
          hint={`${accountsOfClass(finances.accounts, 'liability').length} accounts`}
        />
        <StatCard
          label="Monthly leftover"
          value={formatMoney(budget.leftoverPlanned, finances.currency)}
          hint={`Planned income ${formatMoney(budget.incomePlanned, finances.currency)}`}
        />
      </View>
      {summary.groups.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          body={
            canManage
              ? 'Add the house, offset account, super, cars, and any loans. The dashboard totals them for the whole family.'
              : 'Ask a household admin to add the family’s accounts.'
          }>
          {canManage ? <Btn label="Add an account" onPress={() => router.push('/finances/assets')} /> : null}
          {canManage ? <Btn label="Add shares" variant="secondary" onPress={() => router.push('/finances/shares')} /> : null}
        </EmptyState>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Where the value sits</Text>
          {summary.groups.map((group) => (
            <View key={group.kind} style={styles.groupRow}>
              <View style={styles.groupCopy}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <Text style={styles.groupMeta}>
                  {group.kind === 'shares'
                    ? `${finances.holdings.length} holding${finances.holdings.length === 1 ? '' : 's'}`
                    : `${group.accounts.length} · ${group.class === 'liability' ? 'owed' : 'owned'}`}
                </Text>
              </View>
              <View style={styles.groupValue}>
                <Text style={styles.groupAmount}>{formatMoney(group.total, finances.currency)}</Text>
                <MoneyBar
                  progress={group.class === 'asset' ? group.total / assetMax : group.total / Math.max(summary.liabilities, 1)}
                  over={group.class === 'liability'}
                />
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Monthly budget</Text>
        <Text style={styles.meta}>
          Budget {formatMoney(budget.expensePlanned, finances.currency)} · spent {formatMoney(budget.expenseSpent, finances.currency)}
          {budget.expenseSpent > budget.expensePlanned && budget.expensePlanned > 0
            ? ` · ${formatMoney(budget.expenseSpent - budget.expensePlanned, finances.currency)} over`
            : ` · ${formatMoney(Math.max(0, budget.expensePlanned - budget.expenseSpent), finances.currency)} left`}
        </Text>
        <MoneyBar progress={budget.expenseProgress} over={budget.expenseSpent > budget.expensePlanned && budget.expensePlanned > 0} />
        <View style={styles.actions}>
          <Btn label="Open budget" variant="secondary" onPress={() => router.push('/finances')} />
          <Btn label="Manage assets" variant="secondary" onPress={() => router.push('/finances/assets')} />
          <Btn label="Shares" variant="secondary" onPress={() => router.push('/finances/shares')} />
          <Btn label="Collectibles" variant="secondary" onPress={() => router.push('/finances/collectibles')} />
        </View>
      </View>
    </FinancesChrome>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
  },
  heroLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroValue: { color: colors.text, fontSize: 36, fontWeight: '800' },
  heroHint: { color: colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13 },
  groupRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  groupCopy: { flex: 1, minWidth: 0 },
  groupLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  groupMeta: { color: colors.textDim, fontSize: 12 },
  groupValue: { width: 160, gap: 6 },
  groupAmount: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
