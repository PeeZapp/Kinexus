import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  canManageFinances,
  collectibleConditionLabel,
  collectibleHoldingValue,
  collectibleKindLabel,
  collectibleSourceLabel,
  collectiblesTotal,
  formatMoney,
  groupCollectibles,
  pickCollectibleValue,
  type FinanceCollectible,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { FinancesChrome } from '@/src/features/finances/FinancesShared';
import { CollectibleSheet } from '@/src/features/finances/sheets';
import { lookupCollectibleCatalog } from '@/src/features/finances/finance-api';
import { actionErrorMessage, useFinancesSync, type CollectibleDraft } from '@/src/features/finances/use-finances-sync';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function CollectiblesScreen() {
  const { mode } = useExperienceMode();
  const { role } = useHousehold();
  const finances = useFinancesSync();
  const canManage = canManageFinances(role);
  const desktop = mode === 'desktop';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCollectible | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const total = useMemo(() => collectiblesTotal(finances.collectibles), [finances.collectibles]);
  const groups = useMemo(() => groupCollectibles(finances.collectibles), [finances.collectibles]);
  const pricedIds = useRef(new Set<string>());

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

  async function refreshAll() {
    const cataloged = finances.collectibles.filter((item) => item.catalogId);
    if (cataloged.length === 0) {
      setActionError('Add catalog matches first, then refresh. Sneakers and watches often need a value typed in.');
      return;
    }
    await run(async () => {
      let failed = 0;
      for (const item of cataloged) {
        try {
          const hit = await lookupCollectibleCatalog({
            kind: item.kind,
            catalogId: item.catalogId!,
            sourceUrl: item.sourceUrl,
            currency: finances.currency,
          });
          await finances.updateCollectible(item.id, {
            name: item.name,
            kind: item.kind,
            condition: item.condition,
            quantity: String(item.quantity),
            catalogId: hit.catalogId,
            source: hit.source,
            sourceUrl: hit.sourceUrl,
            imageUrl: hit.imageUrl ?? item.imageUrl ?? undefined,
            purchasedValue: item.purchasedValue != null ? String(item.purchasedValue) : '',
            marketValue: String(pickCollectibleValue(hit, item.condition) ?? item.marketValue),
            notes: item.notes ?? '',
            valuedAt: new Date().toISOString(),
          });
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) throw new Error(`Updated some values. ${failed} could not be refreshed.`);
    });
  }

  useEffect(() => {
    if (!canManage || !finances.online || finances.loading || busy) return;
    const missing = finances.collectibles.filter(
      (item) => item.catalogId && item.marketValue <= 0 && !pricedIds.current.has(item.id),
    );
    if (missing.length === 0) return;
    for (const item of missing) pricedIds.current.add(item.id);
    void (async () => {
      for (const item of missing) {
        try {
          const hit = await lookupCollectibleCatalog({
            kind: item.kind,
            catalogId: item.catalogId!,
            sourceUrl: item.sourceUrl,
            currency: finances.currency,
          });
          const value = pickCollectibleValue(hit, item.condition);
          if (value == null) continue;
          await finances.updateCollectible(item.id, {
            name: item.name,
            kind: item.kind,
            condition: item.condition,
            quantity: String(item.quantity),
            catalogId: hit.catalogId,
            source: hit.source,
            sourceUrl: hit.sourceUrl,
            imageUrl: hit.imageUrl ?? item.imageUrl ?? undefined,
            purchasedValue: item.purchasedValue != null ? String(item.purchasedValue) : '',
            marketValue: String(value),
            notes: item.notes ?? '',
            valuedAt: new Date().toISOString(),
          });
        } catch {
          // Keep the id marked so a failed catalog does not retry in a loop.
        }
      }
    })();
  }, [busy, canManage, finances.collectibles, finances.currency, finances.loading, finances.online, finances.updateCollectible]);

  if (finances.loading && finances.collectibles.length === 0) {
    return <LoadingState label="Loading collectibles…" />;
  }

  return (
    <>
      <FinancesChrome
        desktop={desktop}
        kicker="Family"
        title="Collectibles"
        subtitle="Look up LEGO, minifigs, cards, games, comics, Funko, coins, and vinyl. Sneakers and watches often need a manual value. Totals roll into family net worth.">
        <ErrorText message={finances.error ? actionErrorMessage(finances.error) : actionError} />
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Collection value</Text>
          <Text style={styles.summaryValue}>{formatMoney(total, finances.currency)}</Text>
          <Text style={styles.meta}>{finances.collectibles.length} items</Text>
        </View>
        {canManage ? (
          <View style={styles.actions}>
            <Btn
              label="Add collectible"
              onPress={() => {
                setEditing(null);
                setOpen(true);
              }}
              disabled={!finances.online}
            />
            {finances.collectibles.some((item) => item.catalogId) ? (
              <Btn label="Refresh values" variant="secondary" onPress={() => void refreshAll()} disabled={!finances.online || busy} busy={busy} />
            ) : null}
          </View>
        ) : null}
        {finances.collectibles.length === 0 ? (
          <EmptyState
            title="No collectibles yet"
            body={
              canManage
                ? 'Pick a type and search. LEGO and minifigs use BrickEconomy; cards, games, comics, Funko, and coins use PriceCharting; vinyl uses Discogs.'
                : 'Only household admins can add collectibles.'
            }
          />
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupTotal}>{formatMoney(group.total, finances.currency)}</Text>
              </View>
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setEditing(item);
                    setOpen(true);
                  }}
                  style={styles.row}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={styles.rowCopy}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {collectibleKindLabel(item.kind)} · {collectibleConditionLabel(item.condition)}
                      {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
                      {item.source !== 'manual' ? ` · ${collectibleSourceLabel(item.source)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.value}>
                    {item.marketValue > 0 ? formatMoney(collectibleHoldingValue(item), finances.currency) : '—'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </FinancesChrome>
      <CollectibleSheet
        visible={open}
        collectible={editing}
        currency={finances.currency}
        busy={busy}
        error={actionError}
        readOnly={!canManage}
        onClose={() => {
          setOpen(false);
          setActionError(null);
        }}
        onSave={async (draft: CollectibleDraft) => {
          const ok = await run(() => (editing ? finances.updateCollectible(editing.id, draft) : finances.createCollectible(draft)));
          if (ok) setOpen(false);
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await run(() => finances.deleteCollectible(editing.id));
                if (ok) setOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 4,
  },
  summaryLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  summaryValue: { color: colors.text, fontSize: 28, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
