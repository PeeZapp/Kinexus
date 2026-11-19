import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  INVESTMENT_STATUSES,
  TRADE_SIDES,
  formatMoney,
  investmentStatusLabel,
  type FinanceInvestmentItem,
  type FinanceTradeJournalEntry,
  type InvestmentAlertKind,
  type InvestmentStatus,
  type InvestmentVisibility,
  type TradeSide,
} from '@kinexus/domain';

import { IsoDatePicker } from '@/src/features/household/IsoDatePicker';
import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { todayIso, type InvestItemDraft, type TradeDraft } from '@/src/features/finances/invest/use-invest-sync';
import { colors, radius, space } from '@/src/features/shell/theme';

const TRADE_YEAR_MIN = new Date().getFullYear() - 40;
const TRADE_YEAR_MAX = new Date().getFullYear() + 1;

export function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function pctTo(target: number | null, price: number | null): number | null {
  if (target == null || price == null || !(price > 0)) return null;
  return ((target - price) / price) * 100;
}

export function alertKindLabel(kind: InvestmentAlertKind): string {
  switch (kind) {
    case 'above':
      return 'Above';
    case 'below':
      return 'Below';
    case 'pct_move':
      return '% move';
  }
}

export function alertSummary(kind: InvestmentAlertKind, threshold: number, currency: string): string {
  if (kind === 'pct_move') return `Moves ${threshold}% or more`;
  return `${alertKindLabel(kind)} ${formatMoney(threshold, currency)}`;
}

export function visibilityLabel(visibility: InvestmentVisibility): string {
  return visibility === 'private' ? 'Private' : 'Family';
}

export function ideaLabel(item: Pick<FinanceInvestmentItem, 'symbol' | 'title'>): string {
  return item.symbol || item.title;
}

export function tradeLabel(entry: Pick<FinanceTradeJournalEntry, 'symbol'>, item?: Pick<FinanceInvestmentItem, 'symbol' | 'title'> | null): string {
  return entry.symbol || (item ? ideaLabel(item) : 'Trade');
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function SelectTile({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function StatusTiles({
  value,
  onChange,
  disabled,
}: {
  value: InvestmentStatus;
  onChange: (next: InvestmentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.section}>
      <SectionLabel>Status</SectionLabel>
      <TileGrid>
        {INVESTMENT_STATUSES.map((status) => (
          <SelectTile
            key={status}
            label={investmentStatusLabel(status)}
            active={value === status}
            disabled={disabled}
            onPress={() => onChange(status)}
          />
        ))}
      </TileGrid>
    </View>
  );
}

export function VisibilityRows({
  value,
  onChange,
  disabled,
}: {
  value: InvestmentVisibility;
  onChange: (next: InvestmentVisibility) => void;
  disabled?: boolean;
}) {
  const options: InvestmentVisibility[] = ['private', 'household'];
  return (
    <View style={styles.section}>
      <SectionLabel>Visible to</SectionLabel>
      {options.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={({ pressed }) => [styles.pickerRow, active && styles.tileActive, pressed && !disabled && styles.pressed]}>
            <Text style={[styles.pickerLabel, active && styles.tileLabelActive]}>{visibilityLabel(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusBadge({ status }: { status: InvestmentStatus }) {
  const tone =
    status === 'holding' ? colors.accent : status === 'idea' ? colors.warning : status === 'closed' ? colors.textDim : colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeLabel, { color: tone }]}>{investmentStatusLabel(status)}</Text>
    </View>
  );
}

export function ItemSheet({
  visible,
  item,
  busy,
  error,
  readOnly,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  item: FinanceInvestmentItem | null;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (draft: InvestItemDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [symbol, setSymbol] = useState('');
  const [status, setStatus] = useState<InvestmentStatus>('watching');
  const [visibility, setVisibility] = useState<InvestmentVisibility>('household');
  const [thesis, setThesis] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title ?? '');
    setSymbol(item?.symbol ?? '');
    setStatus(item?.status ?? 'watching');
    setVisibility(item?.visibility ?? 'household');
    setThesis(item?.thesis ?? '');
    setNotes(item?.notes ?? '');
    setTags(item?.tags.join(', ') ?? '');
    setTargetPrice(item?.targetPrice != null ? String(item.targetPrice) : '');
    setStopPrice(item?.stopPrice != null ? String(item.stopPrice) : '');
  }, [item, visible]);

  const locked = Boolean(readOnly);

  return (
    <Sheet visible={visible} title={item ? 'Edit idea' : 'New idea'} onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Symbol" value={symbol} onChangeText={setSymbol} placeholder="CBA" autoCapitalize="characters" editable={!locked} />
          </View>
          <View style={[styles.cell, styles.cellWide]}>
            <Field label="Name" value={title} onChangeText={setTitle} placeholder="Commonwealth Bank" autoCapitalize="words" editable={!locked} />
          </View>
        </View>
        <StatusTiles value={status} onChange={setStatus} disabled={locked} />
        <VisibilityRows value={visibility} onChange={setVisibility} disabled={locked} />
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Target" value={targetPrice} onChangeText={setTargetPrice} placeholder="0.00" keyboardType="decimal-pad" editable={!locked} />
          </View>
          <View style={styles.cell}>
            <Field label="Stop" value={stopPrice} onChangeText={setStopPrice} placeholder="0.00" keyboardType="decimal-pad" editable={!locked} />
          </View>
        </View>
        <Field label="Thesis" value={thesis} onChangeText={setThesis} multiline autoCapitalize="sentences" editable={!locked} />
        <Field label="Tags" value={tags} onChangeText={setTags} placeholder="dividend, banks" editable={!locked} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline autoCapitalize="sentences" editable={!locked} />
        <ErrorText message={error ?? null} />
        {locked ? null : (
          <>
            <Btn
              label={item ? 'Save' : 'Add idea'}
              busy={busy}
              disabled={!title.trim() && !symbol.trim()}
              onPress={() => void onSave({ title, symbol, status, visibility, thesis, notes, tags, targetPrice, stopPrice })}
            />
            {item && onDelete ? <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} /> : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

export function TradeSheet({
  visible,
  entry,
  items,
  lockedItemId,
  busy,
  error,
  readOnly,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  entry: FinanceTradeJournalEntry | null;
  items: readonly FinanceInvestmentItem[];
  /** Pre-links a new trade to an idea and hides the idea picker. */
  lockedItemId?: string | null;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (draft: TradeDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<TradeSide>('buy');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('');
  const [tradedOn, setTradedOn] = useState('');
  const [thesis, setThesis] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<InvestmentVisibility>('household');

  useEffect(() => {
    if (!visible) return;
    const preset = !entry && lockedItemId ? items.find((item) => item.id === lockedItemId) ?? null : null;
    setItemId(entry?.itemId ?? preset?.id ?? null);
    setSymbol(entry?.symbol ?? preset?.symbol ?? '');
    setSide(entry?.side ?? 'buy');
    setQty(entry ? String(entry.qty) : '');
    setPrice(entry ? String(entry.price) : preset?.lastPrice != null ? String(preset.lastPrice) : '');
    setFees(entry && entry.fees > 0 ? String(entry.fees) : '');
    setTradedOn(entry?.tradedOn ?? todayIso());
    setThesis(entry?.thesis ?? '');
    setEmotions(entry?.emotions ?? '');
    setNotes(entry?.notes ?? '');
    setVisibility(entry?.visibility ?? preset?.visibility ?? 'household');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, visible, lockedItemId]);

  function pickIdea(next: FinanceInvestmentItem | null) {
    setItemId(next?.id ?? null);
    if (!next) return;
    if (!symbol.trim() && next.symbol) setSymbol(next.symbol);
    if (!entry) setVisibility(next.visibility);
  }

  const locked = Boolean(readOnly);
  const showIdeas = !lockedItemId && items.length > 0;

  return (
    <Sheet visible={visible} title={entry ? 'Edit trade' : 'Log trade'} onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.section}>
          <SectionLabel>Side</SectionLabel>
          <TileGrid>
            {TRADE_SIDES.map((option) => (
              <SelectTile
                key={option}
                label={option === 'buy' ? 'Buy' : 'Sell'}
                active={side === option}
                disabled={locked}
                onPress={() => setSide(option)}
              />
            ))}
          </TileGrid>
        </View>
        <Field label="Symbol" value={symbol} onChangeText={setSymbol} placeholder="CBA" autoCapitalize="characters" editable={!locked} />
        {locked ? (
          <Field label="Date" value={tradedOn} onChangeText={setTradedOn} editable={false} />
        ) : (
          <IsoDatePicker
            label="Date"
            value={tradedOn || null}
            onChange={(next) => setTradedOn(next ?? todayIso())}
            minYear={TRADE_YEAR_MIN}
            maxYear={TRADE_YEAR_MAX}
            yearOrder="desc"
          />
        )}
        <View style={styles.row}>
          <View style={styles.cell}>
            <Field label="Qty" value={qty} onChangeText={setQty} placeholder="0" keyboardType="decimal-pad" editable={!locked} />
          </View>
          <View style={styles.cell}>
            <Field label="Price" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" editable={!locked} />
          </View>
          <View style={styles.cell}>
            <Field label="Fees" value={fees} onChangeText={setFees} placeholder="0.00" keyboardType="decimal-pad" editable={!locked} />
          </View>
        </View>
        {showIdeas ? (
          <View style={styles.section}>
            <SectionLabel>Idea</SectionLabel>
            <TileGrid>
              <SelectTile label="None" active={itemId == null} disabled={locked} onPress={() => pickIdea(null)} />
              {items.map((item) => (
                <SelectTile
                  key={item.id}
                  label={ideaLabel(item)}
                  active={itemId === item.id}
                  disabled={locked}
                  onPress={() => pickIdea(item)}
                />
              ))}
            </TileGrid>
          </View>
        ) : null}
        <VisibilityRows value={visibility} onChange={setVisibility} disabled={locked} />
        <Field label="Thesis" value={thesis} onChangeText={setThesis} multiline autoCapitalize="sentences" editable={!locked} />
        <Field label="Emotions" value={emotions} onChangeText={setEmotions} autoCapitalize="sentences" editable={!locked} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline autoCapitalize="sentences" editable={!locked} />
        <ErrorText message={error ?? null} />
        {locked ? null : (
          <>
            <Btn
              label={entry ? 'Save' : 'Log trade'}
              busy={busy}
              disabled={!qty.trim() || !price.trim() || (!symbol.trim() && !itemId)}
              onPress={() => void onSave({ itemId, symbol, side, qty, price, fees, tradedOn, thesis, emotions, notes, visibility })}
            />
            {entry && onDelete ? <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} /> : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

export const investStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 12 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowValue: { alignItems: 'flex-end', gap: 2 },
  symbol: { color: colors.text, fontSize: 15, fontWeight: '800' },
  value: { color: colors.text, fontSize: 15, fontWeight: '800' },
  gain: { color: colors.accent },
  loss: { color: colors.danger },
});

const styles = StyleSheet.create({
  stack: { gap: space.md },
  section: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flex: 1, minWidth: 96 },
  cellWide: { flexGrow: 2, flexBasis: 160 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    maxWidth: '48.5%',
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  tileActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tileLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tileLabelActive: { color: colors.accent },
  pressed: { opacity: 0.82 },
  pickerRow: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  pickerLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
});
