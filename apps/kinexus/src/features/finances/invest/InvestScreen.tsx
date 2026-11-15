import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { INVESTMENT_STATUSES, formatMoney, investmentStatusLabel, type FinanceInvestmentItem, type InvestmentStatus } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import {
  ItemSheet,
  StatusBadge,
  formatPct,
  investStyles,
  pctTo,
} from '@/src/features/finances/invest/invest-ui';
import { useInvestSync, type InvestItemDraft } from '@/src/features/finances/invest/use-invest-sync';
import { actionErrorMessage } from '@/src/features/finances/use-finances-sync';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function InvestScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const invest = useInvestSync();
  const desktop = mode === 'desktop';
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceInvestmentItem | null>(null);
  const [status, setStatus] = useState<InvestmentStatus | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tags = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of invest.items) for (const t of item.tags) seen.set(t.toLowerCase(), t);
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [invest.items]);

  const visible = useMemo(
    () =>
      invest.items.filter(
        (item) =>
          (!status || item.status === status) &&
          (!tag || item.tags.some((t) => t.toLowerCase() === tag.toLowerCase())),
      ),
    [invest.items, status, tag],
  );

  const canRefresh = invest.items.some((item) => item.symbol && invest.canEditItem(item));

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

  function openSheet(item: FinanceInvestmentItem | null) {
    setActionError(null);
    setEditing(item);
    setSheetOpen(true);
  }

  if (invest.loading && invest.items.length === 0) return <LoadingState label="Loading watchlist…" />;

  return (
    <>
      <FinancesChrome desktop={desktop} kicker="Ideas" title="Watchlist">
        <ErrorText message={invest.error ? actionErrorMessage(invest.error) : actionError} />
        {invest.canWrite ? (
          <View style={investStyles.actions}>
            <Btn label="New idea" onPress={() => openSheet(null)} disabled={!invest.online} />
            {canRefresh ? (
              <Btn
                label={busy ? 'Refreshing…' : 'Refresh prices'}
                variant="secondary"
                onPress={() => void run(() => invest.refreshPrices())}
                disabled={!invest.online || busy}
              />
            ) : null}
          </View>
        ) : null}
        {invest.items.length === 0 ? (
          <EmptyState
            title="No ideas yet"
            body={invest.canWrite ? 'Add a symbol to start your watchlist.' : 'Ask a household adult to add ideas.'}>
            {invest.canWrite ? <Btn label="New idea" onPress={() => openSheet(null)} disabled={!invest.online} /> : null}
          </EmptyState>
        ) : (
          <>
            <FilterBar>
              <FilterDropdown<InvestmentStatus | null>
                id="status"
                label="Status"
                value={status}
                valueLabel={status ? investmentStatusLabel(status) : 'All'}
                open={openMenu === 'status'}
                options={[
                  { value: null, label: 'All' },
                  ...INVESTMENT_STATUSES.map((value) => ({ value, label: investmentStatusLabel(value) })),
                ]}
                onToggle={toggleMenu}
                onSelect={pick(setStatus)}
              />
              {tags.length > 0 ? (
                <FilterDropdown<string | null>
                  id="tag"
                  label="Tag"
                  value={tag}
                  valueLabel={tag ?? 'All'}
                  open={openMenu === 'tag'}
                  options={[{ value: null, label: 'All' }, ...tags.map((value) => ({ value, label: value }))]}
                  onToggle={toggleMenu}
                  onSelect={pick(setTag)}
                />
              ) : null}
            </FilterBar>
            <View style={investStyles.card}>
              {visible.length === 0 ? (
                <Text style={investStyles.meta}>Nothing matches these filters.</Text>
              ) : (
                visible.map((item, index) => (
                  <IdeaRow
                    key={item.id}
                    item={item}
                    first={index === 0}
                    onOpen={() => router.push(`/finances/invest/${item.id}` as Href)}
                    onEdit={invest.canEditItem(item) ? () => openSheet(item) : undefined}
                  />
                ))
              )}
            </View>
          </>
        )}
      </FinancesChrome>
      <ItemSheet
        visible={sheetOpen}
        item={editing}
        busy={busy}
        error={actionError}
        readOnly={editing ? !invest.canEditItem(editing) : !invest.canWrite}
        onClose={() => {
          setSheetOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: InvestItemDraft) => {
          const ok = await run(() => (editing ? invest.updateItem(editing.id, draft) : invest.createItem(draft)));
          if (ok) setSheetOpen(false);
        }}
        onDelete={
          editing && invest.canEditItem(editing) && (editing.createdBy === invest.userId || invest.role === 'owner' || invest.role === 'admin')
            ? async () => {
                const ok = await run(() => invest.deleteItem(editing.id));
                if (ok) setSheetOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

function IdeaRow({
  item,
  first,
  onOpen,
  onEdit,
}: {
  item: FinanceInvestmentItem;
  first: boolean;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  const upside = pctTo(item.targetPrice, item.lastPrice);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      onLongPress={onEdit}
      style={({ pressed }) => [investStyles.rowItem, first && styles.rowFirst, pressed && styles.pressed]}>
      <View style={investStyles.rowCopy}>
        <View style={styles.titleLine}>
          <Text style={investStyles.symbol} numberOfLines={1}>
            {item.symbol ?? item.title}
          </Text>
          <StatusBadge status={item.status} />
          {item.visibility === 'private' ? <Text style={styles.private}>Private</Text> : null}
        </View>
        {item.symbol ? (
          <Text style={investStyles.meta} numberOfLines={1}>
            {item.title}
          </Text>
        ) : null}
        {item.tags.length > 0 ? (
          <Text style={investStyles.meta} numberOfLines={1}>
            {item.tags.join(' · ')}
          </Text>
        ) : null}
      </View>
      <View style={investStyles.rowValue}>
        <Text style={investStyles.value}>{item.lastPrice != null ? formatMoney(item.lastPrice, item.currency) : '—'}</Text>
        {item.targetPrice != null ? (
          <Text style={[investStyles.meta, upside != null && (upside >= 0 ? investStyles.gain : investStyles.loss)]}>
            Target {formatMoney(item.targetPrice, item.currency)}
            {upside != null ? ` · ${formatPct(upside)}` : ''}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowFirst: { borderTopWidth: 0, paddingTop: 4 },
  pressed: { opacity: 0.8 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  private: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
});
