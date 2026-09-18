import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  accountKindLabel,
  accountsOfClass,
  canManageFinances,
  formatMoney,
  netWorth,
  type FinanceAccount,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import { AccountSheet } from '@/src/features/finances/sheets';
import { actionErrorMessage, useFinancesSync, type AccountDraft } from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function AssetsScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const summary = useMemo(() => netWorth(finances.accounts), [finances.accounts]);
  const assets = useMemo(() => accountsOfClass(finances.accounts, 'asset'), [finances.accounts]);
  const debts = useMemo(() => accountsOfClass(finances.accounts, 'liability'), [finances.accounts]);

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

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(account: FinanceAccount) {
    setEditing(account);
    setOpen(true);
  }

  if (finances.loading && finances.accounts.length === 0) {
    return <LoadingState label="Loading accounts…" />;
  }

  return (
    <>
      <FinancesChrome
        desktop={desktop}
        kicker="Family"
        title="Assets"
        subtitle="Bank, property, super, cars, and the debts against them. Values are what you enter — there is no bank feed yet.">
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        {canManage ? <Btn label="Add account" onPress={openNew} disabled={!finances.online} /> : null}
        {finances.accounts.length === 0 ? (
          <EmptyState
            title="Nothing on the books"
            body={canManage ? 'Start with the home, offset, and any loans. Net worth updates on the dashboard.' : 'Only household admins can add accounts.'}
          />
        ) : (
          <>
            <AccountGroup
              title="What you own"
              total={formatMoney(summary.assets, finances.currency)}
              accounts={assets}
              currency={finances.currency}
              onOpen={openEdit}
            />
            <AccountGroup
              title="What you owe"
              total={formatMoney(summary.liabilities, finances.currency)}
              accounts={debts}
              currency={finances.currency}
              onOpen={openEdit}
              empty="No debts recorded."
            />
          </>
        )}
      </FinancesChrome>
      <AccountSheet
        visible={open}
        account={editing}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: AccountDraft) => {
          const ok = await run(() => (editing ? finances.updateAccount(editing.id, draft) : finances.createAccount(draft)));
          if (ok) setOpen(false);
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteAccount(editing.id));
                if (ok) setOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

function AccountGroup({
  title,
  total,
  accounts,
  currency,
  onOpen,
  empty,
}: {
  title: string;
  total: string;
  accounts: FinanceAccount[];
  currency: string;
  onOpen: (account: FinanceAccount) => void;
  empty?: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupTotal}>{total}</Text>
      </View>
      {accounts.length === 0 ? (
        <Text style={styles.empty}>{empty ?? 'None yet.'}</Text>
      ) : (
        accounts.map((account) => (
          <Pressable key={account.id} onPress={() => onOpen(account)} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{account.name}</Text>
              <Text style={styles.meta}>
                {accountKindLabel(account.kind)}
                {account.institution ? ` · ${account.institution}` : ''}
              </Text>
            </View>
            <Text style={styles.value}>{formatMoney(account.value, currency)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  groupTotal: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  empty: { color: colors.textDim, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
