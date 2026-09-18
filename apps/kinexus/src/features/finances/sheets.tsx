import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  ASSET_KINDS,
  COLLECTIBLE_KINDS,
  LIABILITY_KINDS,
  accountKindLabel,
  collectibleCatalogHint,
  collectibleConditionLabel,
  collectibleKindLabel,
  collectibleSearchPlaceholder,
  collectibleSourceLabel,
  evalMoneyExpression,
  formatHolderId,
  formatMoney,
  holderIdKind,
  holderIdLabel,
  moneyExpressionHasOp,
  parseShareImport,
  pickCollectibleValue,
  sourceForKind,
  type CollectibleCondition,
  type CollectibleKind,
  type CollectibleSearchHit,
  type FinanceAccount,
  type FinanceAccountKind,
  type FinanceBudgetLine,
  type FinanceBudgetLineKind,
  type FinanceCollectible,
  type FinanceShareHolding,
  type FinanceSharePortfolio,
  type ShareImportResult,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import type { AccountDraft, BudgetEntryDraft, BudgetLineDraft, CollectibleDraft, HoldingDraft, PortfolioDraft } from '@/src/features/finances/use-finances-sync';
import { lookupCollectibleCatalog, searchCollectibleCatalog } from '@/src/features/finances/finance-api';
import { colors, radius, space } from '@/src/features/shell/theme';

export function AccountSheet({
  visible,
  account,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
  readOnly,
}: {
  visible: boolean;
  account: FinanceAccount | null;
  onClose: () => void;
  onSave: (draft: AccountDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinanceAccountKind>('bank');
  const [institution, setInstitution] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(account?.name ?? '');
    setKind(account?.kind ?? 'bank');
    setInstitution(account?.institution ?? '');
    setValue(account ? String(account.value) : '');
    setNotes(account?.notes ?? '');
  }, [account, visible]);

  return (
    <Sheet visible={visible} title={account ? 'Edit account' : 'Add account'} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Offset saver" autoCapitalize="words" editable={!readOnly} />
        <Text style={styles.label}>What you own</Text>
        <View style={styles.wrap}>
          {ASSET_KINDS.map((item) => (
            <Pill key={item} label={accountKindLabel(item)} active={kind === item} onPress={readOnly ? undefined : () => setKind(item)} />
          ))}
        </View>
        <Text style={styles.label}>What you owe</Text>
        <View style={styles.wrap}>
          {LIABILITY_KINDS.map((item) => (
            <Pill key={item} label={accountKindLabel(item)} active={kind === item} onPress={readOnly ? undefined : () => setKind(item)} />
          ))}
        </View>
        <Field label="Institution" value={institution} onChangeText={setInstitution} placeholder="Optional bank or lender" editable={!readOnly} />
        <Field
          label="Current value"
          value={value}
          onChangeText={setValue}
          placeholder="0"
          keyboardType="decimal-pad"
          editable={!readOnly}
        />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" editable={!readOnly} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {readOnly ? (
          <Text style={styles.hint}>Only household admins can change accounts.</Text>
        ) : (
          <>
            <Btn
              label={account ? 'Save' : 'Add account'}
              onPress={() => void onSave({ name, kind, institution, value, notes })}
              busy={busy}
              disabled={!name.trim()}
            />
            {account && onDelete ? (
              <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

export function BudgetLineSheet({
  visible,
  line,
  defaultKind,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
  readOnly,
}: {
  visible: boolean;
  line: FinanceBudgetLine | null;
  defaultKind: FinanceBudgetLineKind;
  onClose: () => void;
  onSave: (draft: BudgetLineDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinanceBudgetLineKind>(defaultKind);
  const [planned, setPlanned] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(line?.name ?? '');
    setKind(line?.kind ?? defaultKind);
    setPlanned(line ? String(line.planned) : '');
  }, [defaultKind, line, visible]);

  return (
    <Sheet visible={visible} title={line ? 'Edit category' : 'Add category'} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Groceries & food" autoCapitalize="words" editable={!readOnly} />
        <Text style={styles.label}>Type</Text>
        <View style={styles.wrap}>
          <Pill label="Income" active={kind === 'income'} onPress={readOnly ? undefined : () => setKind('income')} />
          <Pill label="Expense" active={kind === 'expense'} onPress={readOnly ? undefined : () => setKind('expense')} />
        </View>
        <Field label="Set amount each month" value={planned} onChangeText={setPlanned} placeholder="0" keyboardType="decimal-pad" editable={!readOnly} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {readOnly ? (
          <Text style={styles.hint}>Only household admins can change the budget.</Text>
        ) : (
          <>
            <Btn
              label={line ? 'Save' : 'Add category'}
              onPress={() => void onSave({ kind, name, planned })}
              busy={busy}
              disabled={!name.trim()}
            />
            {line && onDelete ? (
              <Btn label="Remove category" variant="danger" onPress={() => void onDelete()} disabled={busy} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

export function BudgetEntrySheet({
  visible,
  lines,
  selectedLineId,
  monthLabel,
  currency,
  onClose,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  lines: readonly FinanceBudgetLine[];
  selectedLineId?: string | null;
  monthLabel: string;
  currency: string;
  onClose: () => void;
  onSave: (draft: BudgetEntryDraft, line: FinanceBudgetLine) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [query, setQuery] = useState('');
  const [lineId, setLineId] = useState<string | null>(selectedLineId ?? null);
  const [showMatches, setShowMatches] = useState(false);
  const selected = lines.find((line) => line.id === lineId) ?? null;
  const amountValue = useMemo(() => evalMoneyExpression(amount), [amount]);
  const amountPreview = moneyExpressionHasOp(amount) && amountValue != null && amountValue > 0 ? amountValue : null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...lines].sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
    if (!needle) return sorted;
    return sorted.filter((line) => line.name.toLowerCase().includes(needle));
  }, [lines, query]);

  useEffect(() => {
    if (!visible) return;
    const preselected = lines.find((line) => line.id === selectedLineId) ?? null;
    setDescription('');
    setAmount('');
    setLineId(preselected?.id ?? null);
    setQuery(preselected?.name ?? '');
    setShowMatches(false);
  }, [lines, selectedLineId, visible]);

  function chooseLine(line: FinanceBudgetLine) {
    setLineId(line.id);
    setQuery(line.name);
    setShowMatches(false);
  }

  function typeCategory(value: string) {
    setQuery(value);
    setShowMatches(true);
    const exact = lines.find((line) => line.name.trim().toLowerCase() === value.trim().toLowerCase());
    setLineId(exact?.id ?? null);
  }

  function commitAmount() {
    if (amountValue == null || amountValue <= 0) return;
    if (!moneyExpressionHasOp(amount)) return;
    setAmount(String(amountValue));
  }

  return (
    <Sheet visible={visible} title={selected ? `Add to ${selected.name}` : 'Add item'} onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.hint}>
          Adds to {monthLabel}. Start typing a category, then click the match. Amount accepts 50+30.
        </Text>
        <Field
          label="Category"
          value={query}
          onChangeText={typeCategory}
          onFocus={() => {
            if (query.trim()) setShowMatches(true);
          }}
          placeholder="Groceries"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {showMatches && query.trim() ? (
          <View style={styles.suggestList}>
            {matches.length === 0 ? (
              <Text style={styles.hint}>No matching category.</Text>
            ) : (
              matches.map((line) => (
                <Pressable key={line.id} onPress={() => chooseLine(line)} style={styles.suggestRow}>
                  <Text style={styles.hitName}>{line.name}</Text>
                  <Text style={styles.hint}>{line.kind === 'income' ? 'Income' : 'Expense'}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
        <Field
          label="What was it"
          value={description}
          onChangeText={setDescription}
          placeholder="Woolworths food shop"
          autoCapitalize="sentences"
        />
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          onBlur={commitAmount}
          placeholder="50+30"
          keyboardType="default"
        />
        {amountPreview != null ? (
          <Text style={styles.hint}>
            = {formatMoney(amountPreview, currency)}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Add item"
          onPress={() =>
            selected &&
            amountValue != null &&
            void onSave({ description, amount: String(amountValue) }, selected)
          }
          busy={busy}
          disabled={!selected || !description.trim() || amountValue == null || amountValue <= 0}
        />
      </View>
    </Sheet>
  );
}

export function PortfolioSheet({
  visible,
  portfolio,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
  readOnly,
}: {
  visible: boolean;
  portfolio: FinanceSharePortfolio | null;
  onClose: () => void;
  onSave: (draft: PortfolioDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [holderId, setHolderId] = useState('');
  const [postcode, setPostcode] = useState('');
  const kind = holderIdKind(holderId);

  useEffect(() => {
    if (!visible) return;
    setName(portfolio?.name ?? '');
    setBroker(portfolio?.broker ?? '');
    setHolderId(portfolio?.holderId ?? '');
    setPostcode(portfolio?.postcode ?? '');
  }, [portfolio, visible]);

  return (
    <Sheet visible={visible} title={portfolio ? 'Edit portfolio' : 'Add portfolio'} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="CommSec" autoCapitalize="words" editable={!readOnly} />
        <Field label="Broker" value={broker} onChangeText={setBroker} placeholder="Optional" editable={!readOnly} />
        <Field
          label="HIN or SRN"
          value={holderId}
          onChangeText={setHolderId}
          placeholder="X0001234567"
          autoCapitalize="characters"
          editable={!readOnly}
        />
        <Text style={styles.hint}>
          {kind
            ? `${kind === 'hin' ? 'HIN' : 'SRN'} ${formatHolderId(holderId)} is saved for a future registry feed. CHESS does not let consumer apps look up holdings from a number alone.`
            : 'A HIN starts with X and 10 digits. An SRN starts with I. BGL can import from this because it pays Computershare, Automic, and other registries — we cannot yet.'}
        </Text>
        <Field
          label="Postcode"
          value={postcode}
          onChangeText={setPostcode}
          placeholder="Registries often match on this"
          keyboardType="number-pad"
          editable={!readOnly}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {readOnly ? (
          <Text style={styles.hint}>Only household admins can change portfolios.</Text>
        ) : (
          <>
            <Btn
              label={portfolio ? 'Save' : 'Add portfolio'}
              onPress={() => void onSave({ name, broker, holderId, postcode })}
              busy={busy}
              disabled={!name.trim()}
            />
            {portfolio && onDelete ? (
              <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

export function HoldingSheet({
  visible,
  holding,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
  readOnly,
}: {
  visible: boolean;
  holding: FinanceShareHolding | null;
  onClose: () => void;
  onSave: (draft: HoldingDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [symbol, setSymbol] = useState('');
  const [units, setUnits] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSymbol(holding?.symbol ?? '');
    setUnits(holding ? String(holding.units) : '');
    setCostPerUnit(holding?.costPerUnit != null ? String(holding.costPerUnit) : '');
    setName(holding?.name ?? '');
  }, [holding, visible]);

  return (
    <Sheet visible={visible} title={holding ? 'Edit holding' : 'Add holding'} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="ASX code" value={symbol} onChangeText={setSymbol} placeholder="CBA" autoCapitalize="characters" editable={!readOnly} />
        <Field label="Company" value={name} onChangeText={setName} placeholder="Filled from the quote when you refresh" editable={!readOnly} />
        <Field label="Units" value={units} onChangeText={setUnits} placeholder="0" keyboardType="decimal-pad" editable={!readOnly} />
        <Field label="Average cost" value={costPerUnit} onChangeText={setCostPerUnit} placeholder="Optional" keyboardType="decimal-pad" editable={!readOnly} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {readOnly ? (
          <Text style={styles.hint}>Only household admins can change holdings.</Text>
        ) : (
          <>
            <Btn
              label={holding ? 'Save' : 'Add holding'}
              onPress={() => void onSave({ symbol, units, costPerUnit, name })}
              busy={busy}
              disabled={!symbol.trim()}
            />
            {holding && onDelete ? (
              <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const IMPORT_FORMAT_LABEL = {
  csv: 'CSV holdings',
  chess: 'CHESS statement',
  lines: 'Symbol list',
} as const;

function pickShareImportFile(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export function ImportHoldingsSheet({
  visible,
  portfolioName,
  hasHolderId,
  currency,
  onClose,
  onImport,
  busy,
  error,
}: {
  visible: boolean;
  portfolioName: string;
  hasHolderId: boolean;
  currency: string;
  onClose: () => void;
  onImport: (parsed: ShareImportResult) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseShareImport(text), [text]);

  useEffect(() => {
    if (!visible) return;
    setText('');
  }, [visible]);

  async function pasteClipboard() {
    const next = await Clipboard.getStringAsync();
    if (next.trim()) setText(next);
  }

  async function chooseFile() {
    const next = await pickShareImportFile();
    if (next?.trim()) setText(next);
  }

  const preview = parsed.holdings.slice(0, 12);

  return (
    <Sheet visible={visible} title={`Import into ${portfolioName}`} onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.hint}>
          Paste a CommSec (or similar) holdings CSV, a CHESS holding statement, or lines like CBA,50,90. Duplicate
          codes are merged. Choose a CSV file or paste from the clipboard. This does not log into a broker.
        </Text>
        <Field
          label="CSV or CHESS text"
          value={text}
          onChangeText={setText}
          placeholder="Code,Quantity,Average Price…"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          style={styles.paste}
        />
        <View style={styles.wrap}>
          <Btn label="Paste" variant="secondary" onPress={() => void pasteClipboard()} />
          {Platform.OS === 'web' ? (
            <Btn label="Choose CSV" variant="secondary" onPress={() => void chooseFile()} />
          ) : null}
        </View>
        {text.trim() ? (
          parsed.holdings.length > 0 ? (
            <>
              <Text style={styles.hint}>
                {IMPORT_FORMAT_LABEL[parsed.format]} · {parsed.holdings.length} holding
                {parsed.holdings.length === 1 ? '' : 's'}
                {parsed.skipped > 0 ? ` · skipped ${parsed.skipped}` : ''}
                {parsed.holderId
                  ? hasHolderId
                    ? ` · ${holderIdLabel(parsed.holderKind)} ${parsed.holderId} (already saved)`
                    : ` · will save ${holderIdLabel(parsed.holderKind)} ${parsed.holderId}`
                  : ''}
              </Text>
              {preview.map((holding) => (
                <View key={holding.symbol} style={styles.previewRow}>
                  <View style={styles.hitCopy}>
                    <Text style={styles.hitName}>{holding.symbol}</Text>
                    <Text style={styles.hint}>
                      {holding.name ? `${holding.name} · ` : ''}
                      {holding.units} units
                      {holding.costPerUnit != null ? ` · cost ${formatMoney(holding.costPerUnit, currency)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.hitValue}>
                    {holding.lastPrice != null ? formatMoney(holding.lastPrice, currency) : '—'}
                  </Text>
                </View>
              ))}
              {parsed.holdings.length > preview.length ? (
                <Text style={styles.hint}>+{parsed.holdings.length - preview.length} more</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.error}>No ASX holdings found. Check the columns include a code and quantity.</Text>
          )
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label={busy ? 'Importing…' : 'Import holdings'}
          onPress={() => void onImport(parsed)}
          busy={busy}
          disabled={parsed.holdings.length === 0 || busy}
        />
      </View>
    </Sheet>
  );
}

export function CollectibleSheet({
  visible,
  collectible,
  currency,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
  readOnly,
}: {
  visible: boolean;
  collectible: FinanceCollectible | null;
  currency: string;
  onClose: () => void;
  onSave: (draft: CollectibleDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CollectibleKind>('lego');
  const [condition, setCondition] = useState<CollectibleCondition>('new');
  const [quantity, setQuantity] = useState('1');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CollectibleSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState('');
  const [source, setSource] = useState(sourceForKind('lego'));
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [purchasedValue, setPurchasedValue] = useState('');
  const [marketValue, setMarketValue] = useState('');
  const [notes, setNotes] = useState('');
  const [valuedAt, setValuedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(collectible?.name ?? '');
    setKind(collectible?.kind ?? 'lego');
    setCondition(collectible?.condition ?? 'new');
    setQuantity(collectible ? String(collectible.quantity) : '1');
    setQuery('');
    setHits([]);
    setSearchError(null);
    setCatalogId(collectible?.catalogId ?? '');
    setSource(collectible?.source ?? sourceForKind(collectible?.kind ?? 'lego'));
    setSourceUrl(collectible?.sourceUrl ?? '');
    setImageUrl(collectible?.imageUrl ?? '');
    setPurchasedValue(collectible?.purchasedValue != null ? String(collectible.purchasedValue) : '');
    setMarketValue(collectible ? String(collectible.marketValue) : '');
    setNotes(collectible?.notes ?? '');
    setValuedAt(collectible?.valuedAt ?? null);
  }, [collectible, visible]);

  function applyHit(hit: CollectibleSearchHit, nextCondition = condition) {
    setName(hit.name);
    setKind(hit.kind);
    setCatalogId(hit.catalogId);
    setSource(hit.source);
    setSourceUrl(hit.sourceUrl);
    setImageUrl(hit.imageUrl ?? '');
    const value = pickCollectibleValue(hit, nextCondition);
    setMarketValue(value != null ? String(value) : '');
    setValuedAt(new Date().toISOString());
    setHits([]);
    setQuery('');
  }

  async function runSearch() {
    setSearchError(null);
    setSearching(true);
    try {
      const results = await searchCollectibleCatalog(kind, query, currency);
      setHits(results);
      if (results.length === 0) setSearchError(collectibleCatalogHint(kind));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function refreshValue() {
    if (!catalogId.trim()) {
      setSearchError('Search the catalog first, or enter a value yourself.');
      return;
    }
    setSearchError(null);
    setLookingUp(true);
    try {
      const hit = await lookupCollectibleCatalog({
        kind,
        catalogId,
        sourceUrl: sourceUrl || null,
        currency,
      });
      applyHit(hit, condition);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLookingUp(false);
    }
  }

  const catalogHint = collectibleCatalogHint(kind);

  return (
    <Sheet visible={visible} title={collectible ? 'Edit collectible' : 'Add collectible'} onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.wrap}>
          {COLLECTIBLE_KINDS.map((item) => (
            <Pill
              key={item}
              label={collectibleKindLabel(item)}
              active={kind === item}
              onPress={
                readOnly
                  ? undefined
                  : () => {
                      setKind(item);
                      setSource(sourceForKind(item));
                      setHits([]);
                    }
              }
            />
          ))}
        </View>
        {readOnly ? null : (
          <>
            <Field
              label="Search catalog"
              value={query}
              onChangeText={setQuery}
              placeholder={collectibleSearchPlaceholder(kind)}
              autoCapitalize="words"
              onSubmitEditing={() => void runSearch()}
            />
            <Text style={styles.hint}>{catalogHint}</Text>
            <Btn label="Search" onPress={() => void runSearch()} busy={searching} disabled={!query.trim() || searching} />
            {hits.map((hit) => (
              <Pressable key={`${hit.source}-${hit.catalogId}`} onPress={() => applyHit(hit)} style={styles.hit}>
                {hit.imageUrl ? <Image source={{ uri: hit.imageUrl }} style={styles.hitImage} /> : <View style={styles.hitImage} />}
                <View style={styles.hitCopy}>
                  <Text style={styles.hitName}>{hit.name}</Text>
                  <Text style={styles.hint}>
                    {hit.subtitle ? `${hit.subtitle} · ` : ''}
                    {collectibleSourceLabel(hit.source)}
                  </Text>
                </View>
                <Text style={styles.hitValue}>
                  {formatMoney(pickCollectibleValue(hit, condition), hit.currency || currency)}
                </Text>
              </Pressable>
            ))}
          </>
        )}
        <Field label="Name" value={name} onChangeText={setName} placeholder="Millennium Falcon" autoCapitalize="words" editable={!readOnly} />
        <Text style={styles.label}>Condition</Text>
        <View style={styles.wrap}>
          {(['new', 'used'] as const).map((item) => (
            <Pill
              key={item}
              label={collectibleConditionLabel(item)}
              active={condition === item}
              onPress={readOnly ? undefined : () => setCondition(item)}
            />
          ))}
        </View>
        <Field label="Quantity" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="number-pad" editable={!readOnly} />
        <Field
          label="Market value each"
          value={marketValue}
          onChangeText={setMarketValue}
          placeholder="0"
          keyboardType="decimal-pad"
          editable={!readOnly}
        />
        <Field
          label="What you paid each"
          value={purchasedValue}
          onChangeText={setPurchasedValue}
          placeholder="Optional"
          keyboardType="decimal-pad"
          editable={!readOnly}
        />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" editable={!readOnly} />
        {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {readOnly ? (
          <Text style={styles.hint}>Only household admins can change collectibles.</Text>
        ) : (
          <>
            {catalogId ? (
              <Btn label="Refresh catalog value" variant="secondary" onPress={() => void refreshValue()} busy={lookingUp} disabled={lookingUp || busy} />
            ) : null}
            <Btn
              label={collectible ? 'Save' : 'Add collectible'}
              onPress={() =>
                void onSave({
                  name,
                  kind,
                  condition,
                  quantity,
                  catalogId,
                  source,
                  sourceUrl,
                  imageUrl,
                  purchasedValue,
                  marketValue,
                  notes,
                  valuedAt,
                })
              }
              busy={busy}
              disabled={!name.trim()}
            />
            {collectible && onDelete ? (
              <Btn label="Remove" variant="danger" onPress={() => void onDelete()} disabled={busy} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hitImage: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
  },
  hitCopy: { flex: 1, minWidth: 0 },
  hitName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hitValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  paste: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 160,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestList: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
