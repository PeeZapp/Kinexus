import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BANKS,
  bankById,
  buildTxnReview,
  formatMoney,
  groupReviewRowsByDate,
  linePathName,
  parseBankStatement,
  type BankId,
  type FinanceBudgetLine,
  type FinanceBudgetTxn,
  type ReviewTxnRow,
  type StatementAssignment,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import {
  MAX_STATEMENT_CHARS,
  pasteStatementText,
  pickStatementText,
} from '@/src/features/finances/budget/statement-file';
import {
  classifyBudgetMerchants,
  readBudgetTransactionsFromScreenshots,
} from '@/src/features/finances/finance-api';
import { Sheet } from '@/src/features/meals/meals-kit';
import type { StashedBudgetTxnShare } from '@/src/features/finances/budget/budget-txn-share-stash';
import {
  pickRecipePhotos,
  prepareBankScreenshots,
  recipePhotosFromSharedImages,
  releaseRecipePhotoPreview,
} from '@/src/features/meals/recipes/recipe-photo-import';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAiStatus } from '@/src/lib/ai-status-context';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { getPwaInstallPlatform } from '@/src/lib/pwa';

type Step = 'source' | 'file' | 'review' | 'category';
const BANK_KEY = (userId: string) => `kinexus.budget.preferredBank.${userId}`;
const MAX_SCREENSHOTS = 6;
const BODY_CAP = 4 * 1024 * 1024;

function localDateIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function estimatedBodyBytes(images: Array<{ base64: string }>): number {
  return images.reduce((sum, image) => sum + Math.ceil((image.base64.length * 3) / 4), 0);
}

export function AddTransactionsSheet({
  visible,
  lines,
  txns,
  currency,
  busy,
  error,
  sharedIntake = null,
  onSharedIntakeConsumed,
  onClose,
  onAdded,
  onSave,
}: {
  visible: boolean;
  lines: readonly FinanceBudgetLine[];
  txns: readonly FinanceBudgetTxn[];
  currency: string;
  busy?: boolean;
  error?: string | null;
  /** Shared screenshots / statement from the share target handoff. */
  sharedIntake?: StashedBudgetTxnShare | null;
  onSharedIntakeConsumed?: () => void;
  onClose: () => void;
  onAdded: (count: number) => void;
  onSave: (
    rows: Array<{
      date: string;
      description: string;
      amount: number;
      merchantKey: string;
      lineId: string | null;
      ignored: boolean;
    }>,
  ) => Promise<void>;
}) {
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const { blocked } = useAiStatus();
  const aiOff = blocked === 'no_access' || blocked === 'key_paused';
  const desktopWeb = Platform.OS === 'web' && getPwaInstallPlatform() === 'other';

  const [step, setStep] = useState<Step>('source');
  const [bankId, setBankId] = useState<BankId | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [fileText, setFileText] = useState('');
  const [rows, setRows] = useState<ReviewTxnRow[]>([]);
  const [showAlready, setShowAlready] = useState(false);
  const [pickingCategoryFor, setPickingCategoryFor] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [sharedAiOff, setSharedAiOff] = useState(false);
  const intakeStarted = useRef(false);

  const bank = bankById(bankId);
  const selectedCount = rows.filter((row) => row.selected && !row.alreadyAdded).length;
  const alreadyAdded = rows.filter((row) => row.alreadyAdded);
  const freshRows = rows.filter((row) => !row.alreadyAdded);
  const grouped = useMemo(() => groupReviewRowsByDate(freshRows), [freshRows]);
  const categoryTarget = rows.find((row) => row.id === pickingCategoryFor) ?? null;

  useEffect(() => {
    if (!visible) {
      intakeStarted.current = false;
      return;
    }
    setStep('source');
    setBankOpen(false);
    setFileText('');
    setRows([]);
    setShowAlready(false);
    setPickingCategoryFor(null);
    setLocalError(null);
    setWorking(false);
    setSharedAiOff(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !user?.id) return;
    void AsyncStorage.getItem(BANK_KEY(user.id)).then((raw) => {
      const next = bankById(raw);
      setBankId(next?.id ?? null);
    });
  }, [user?.id, visible]);

  useEffect(() => {
    if (!visible || !sharedIntake || intakeStarted.current) return;
    intakeStarted.current = true;
    const intake = sharedIntake;
    let cancelled = false;

    void (async () => {
      if (intake.kind === 'statement') {
        setFileText(intake.text);
        setStep('file');
        setLocalError(null);
        const raw = intake.text.trim();
        if (!raw) {
          setLocalError(
            /\.pdf$/i.test(intake.fileName) || intake.mimeType === 'application/pdf'
              ? 'Paste the statement text from that PDF, then continue.'
              : 'Paste a statement or choose a file first',
          );
          return;
        }
        if (raw.length > MAX_STATEMENT_CHARS) {
          setLocalError('That file is too large.');
          return;
        }
        const parsed = parseBankStatement(raw);
        if (parsed.transactions.length === 0) {
          setLocalError('No transactions found.');
          return;
        }
        setWorking(true);
        try {
          if (cancelled) return;
          await goToReview(
            parsed.transactions.map((txn) => ({
              ...txn,
              pending: false,
            })),
          );
        } catch (err) {
          if (!cancelled) setLocalError(err instanceof Error ? err.message : 'Could not read that file');
        } finally {
          if (!cancelled) setWorking(false);
        }
        return;
      }

      if (aiOff) {
        setSharedAiOff(true);
        setStep('source');
        return;
      }

      setWorking(true);
      setLocalError(null);
      let picked: Awaited<ReturnType<typeof recipePhotosFromSharedImages>> = [];
      try {
        if (!activeHousehold?.id) throw new Error('Pick a household first');
        picked = await recipePhotosFromSharedImages(intake.screenshots);
        if (cancelled) return;
        const images = await prepareBankScreenshots(picked);
        if (estimatedBodyBytes(images) > BODY_CAP) {
          throw new Error('Those screenshots are too large together. Try fewer or crop tighter.');
        }
        const read = await readBudgetTransactionsFromScreenshots({
          householdId: activeHousehold.id,
          localDate: localDateIso(),
          images,
        });
        if (cancelled) return;
        await goToReview(read.transactions);
      } catch (err) {
        if (!cancelled) setLocalError(err instanceof Error ? err.message : 'Could not read screenshots');
        if (!cancelled) setStep('source');
      } finally {
        for (const file of picked) releaseRecipePhotoPreview(file);
        if (!cancelled) setWorking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Process each sharedIntake once per open; goToReview uses latest lines/txns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sharedIntake, aiOff, activeHousehold?.id]);

  async function rememberBank(id: BankId) {
    setBankId(id);
    setBankOpen(false);
    if (user?.id) await AsyncStorage.setItem(BANK_KEY(user.id), id);
  }

  async function openBankLogin() {
    if (!bank?.loginUrl) return;
    await Linking.openURL(bank.loginUrl);
  }

  async function chooseScreenshots() {
    setLocalError(null);
    setWorking(true);
    let picked: Awaited<ReturnType<typeof pickRecipePhotos>> = [];
    try {
      picked = await pickRecipePhotos(MAX_SCREENSHOTS);
      if (picked.length === 0) return;
      if (!activeHousehold?.id) throw new Error('Pick a household first');
      const images = await prepareBankScreenshots(picked);
      if (estimatedBodyBytes(images) > BODY_CAP) {
        throw new Error('Those screenshots are too large together. Try fewer or crop tighter.');
      }
      const read = await readBudgetTransactionsFromScreenshots({
        householdId: activeHousehold.id,
        localDate: localDateIso(),
        images,
      });
      await goToReview(read.transactions);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not read screenshots');
    } finally {
      for (const file of picked) releaseRecipePhotoPreview(file);
      setWorking(false);
    }
  }

  async function analyseFile() {
    setLocalError(null);
    const raw = fileText.trim();
    if (!raw) {
      setLocalError('Paste a statement or choose a file first');
      return;
    }
    if (raw.length > MAX_STATEMENT_CHARS) {
      setLocalError('That file is too large.');
      return;
    }
    const parsed = parseBankStatement(raw);
    if (parsed.transactions.length === 0) {
      setLocalError('No transactions found.');
      return;
    }
    setWorking(true);
    try {
      await goToReview(
        parsed.transactions.map((txn) => ({
          ...txn,
          pending: false,
        })),
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setWorking(false);
    }
  }

  async function goToReview(
    incoming: Array<{ date: string; description: string; amount: number; merchantKey: string; pending?: boolean }>,
  ) {
    let aiGuesses: Array<{
      merchantKey: string;
      sample: string;
      count: number;
      total: number;
      kind: 'income' | 'expense';
      confidence?: number;
      ignore?: boolean;
      kindGuess?: 'income' | 'expense';
      name?: string;
    }> = [];
    const uniqueMerchants = new Map<string, { sample: string; count: number; total: number; kind: 'income' | 'expense' }>();
    for (const txn of incoming) {
      const kind = txn.amount >= 0 ? 'income' : 'expense';
      const current = uniqueMerchants.get(txn.merchantKey);
      if (current) {
        current.count += 1;
        current.total += txn.amount;
      } else {
        uniqueMerchants.set(txn.merchantKey, {
          sample: txn.description,
          count: 1,
          total: txn.amount,
          kind,
        });
      }
    }
    if (!aiOff && activeHousehold?.id && uniqueMerchants.size > 0) {
      try {
        const guesses = await classifyBudgetMerchants({
          householdId: activeHousehold.id,
          merchants: [...uniqueMerchants.entries()].map(([merchantKey, meta]) => ({
            merchantKey,
            sample: meta.sample,
            count: meta.count,
            total: meta.total,
            kind: meta.kind,
          })),
          categories: lines.map((line) => ({ kind: line.kind, name: line.name })),
        });
        aiGuesses = guesses.map((guess) => ({
          merchantKey: guess.merchantKey,
          sample: guess.merchantKey,
          count: 1,
          total: 0,
          kind: guess.kind ?? 'expense',
          confidence: guess.confidence,
          ignore: guess.ignore,
          name: guess.name,
        }));
      } catch {
        /* classification is best-effort */
      }
    }
    const built = buildTxnReview({
      incoming,
      existing: txns,
      lines,
      aiGuesses: aiGuesses.map((guess) => ({
        merchantKey: guess.merchantKey,
        confidence: guess.confidence,
        ignore: guess.ignore,
        kind: guess.kind,
        name: guess.name,
      })),
    });
    setRows(built.rows);
    setShowAlready(false);
    setStep('review');
  }

  function setAssignment(rowId: string, assignment: StatementAssignment | null) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              assignment,
              prefill: assignment?.ignore
                ? { source: 'ignore' as const }
                : assignment
                  ? { source: 'ai' as const, assignment, confidence: 1 }
                  : { source: 'none' as const },
            }
          : row,
      ),
    );
  }

  function toggleRow(rowId: string) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, selected: !row.selected } : row)));
  }

  async function addSelected() {
    setLocalError(null);
    const selected = rows.filter((row) => row.selected && !row.alreadyAdded);
    if (selected.length === 0) {
      setLocalError('Tick at least one transaction');
      return;
    }
    const missing = selected.find((row) => !row.assignment);
    if (missing) {
      setLocalError('Choose a category for each ticked transaction');
      return;
    }
    setWorking(true);
    try {
      const payload = selected.map((row) => {
        const assignment = row.assignment!;
        if (assignment.ignore) {
          return {
            date: row.date,
            description: row.description,
            amount: row.amount,
            merchantKey: row.merchantKey,
            lineId: null,
            ignored: true,
          };
        }
        const line = lines.find(
          (item) => item.kind === assignment.kind && item.name.trim().toLowerCase() === assignment.name.trim().toLowerCase(),
        );
        return {
          date: row.date,
          description: row.description,
          amount: row.amount,
          merchantKey: row.merchantKey,
          lineId: line?.id ?? null,
          ignored: false,
        };
      });
      await onSave(payload);
      onAdded(payload.length);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not add transactions');
    } finally {
      setWorking(false);
    }
  }

  const title =
    step === 'file'
      ? 'Paste or upload'
      : step === 'review'
        ? 'Review transactions'
        : step === 'category'
          ? 'Category'
          : 'Add transactions';

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={() => {
        if (step === 'category') {
          setStep('review');
          setPickingCategoryFor(null);
          return;
        }
        onSharedIntakeConsumed?.();
        onClose();
      }}>
      <View style={styles.stack}>
        {step === 'source' ? (
          <SourceStep
            bankName={bank?.name ?? null}
            bankLoginUrl={bank?.loginUrl ?? ''}
            bankOpen={bankOpen}
            desktopWeb={desktopWeb}
            aiOff={aiOff}
            sharedAiOff={sharedAiOff}
            working={working}
            error={localError ?? error}
            onToggleBank={() => setBankOpen((value) => !value)}
            onPickBank={(id) => void rememberBank(id)}
            onOpenBank={() => void openBankLogin()}
            onChooseScreenshots={() => void chooseScreenshots()}
            onFileInstead={() => {
              setLocalError(null);
              setSharedAiOff(false);
              setStep('file');
            }}
            onEnterManually={() => {
              setLocalError(null);
              setSharedAiOff(false);
              setStep('file');
            }}
          />
        ) : null}

        {step === 'file' ? (
          <FileStep
            text={fileText}
            working={working}
            error={localError ?? error}
            onChangeText={setFileText}
            onPaste={() =>
              void pasteStatementText().then((next) => {
                if (next) setFileText(next);
              })
            }
            onChooseFile={() =>
              void pickStatementText().then((next) => {
                if (next?.trim()) setFileText(next);
              })
            }
            onAnalyse={() => void analyseFile()}
          />
        ) : null}

        {step === 'review' ? (
          <ReviewStep
            grouped={grouped}
            alreadyAdded={alreadyAdded}
            showAlready={showAlready}
            selectedCount={selectedCount}
            currency={currency}
            lines={lines}
            working={working || Boolean(busy)}
            error={localError ?? error}
            onToggleAlready={() => setShowAlready((value) => !value)}
            onToggleRow={toggleRow}
            onPickCategory={(rowId) => {
              setPickingCategoryFor(rowId);
              setStep('category');
            }}
            onAdd={() => void addSelected()}
          />
        ) : null}

        {step === 'category' && categoryTarget ? (
          <CategoryStep
            lines={lines}
            currency={currency}
            row={categoryTarget}
            onPick={(assignment) => {
              setAssignment(categoryTarget.id, assignment);
              setPickingCategoryFor(null);
              setStep('review');
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function SourceStep({
  bankName,
  bankLoginUrl,
  bankOpen,
  desktopWeb,
  aiOff,
  sharedAiOff,
  working,
  error,
  onToggleBank,
  onPickBank,
  onOpenBank,
  onChooseScreenshots,
  onFileInstead,
  onEnterManually,
}: {
  bankName: string | null;
  bankLoginUrl: string;
  bankOpen: boolean;
  desktopWeb: boolean;
  aiOff: boolean;
  sharedAiOff: boolean;
  working: boolean;
  error?: string | null;
  onToggleBank: () => void;
  onPickBank: (id: BankId) => void;
  onOpenBank: () => void;
  onChooseScreenshots: () => void;
  onFileInstead: () => void;
  onEnterManually: () => void;
}) {
  const copy = desktopWeb
    ? 'Log in, download your recent transactions as CSV (or take screenshots), then come back and add the file.'
    : bankName && bankName !== 'Other'
      ? `Open ${bankName}, screenshot your recent transactions, then come back and pick them.`
      : 'Open your bank app, screenshot your recent transactions, then come back and pick them.';

  const screenshotBlock =
    aiOff || sharedAiOff ? (
      <>
        <Text style={styles.warn}>Screenshot reading needs AI, which is off for you in this household.</Text>
        {sharedAiOff ? <Btn label="Enter manually" variant="secondary" onPress={onEnterManually} disabled={working} /> : null}
      </>
    ) : (
      <Btn label={working ? 'Reading…' : 'Choose screenshots'} onPress={onChooseScreenshots} busy={working} />
    );

  const fileBlock = sharedAiOff ? null : (
    <Btn label="Paste or upload a file instead" variant="secondary" onPress={onFileInstead} disabled={working} />
  );

  return (
    <>
      <Pressable onPress={onToggleBank} style={styles.bankRow}>
        <Text style={styles.bankLabel}>Your bank</Text>
        <Text style={styles.bankValue}>{bankName ?? 'Choose'}</Text>
      </Pressable>
      {bankOpen ? (
        <View style={styles.wrap}>
          {BANKS.map((bank) => (
            <Pill key={bank.id} label={bank.name} active={bank.name === bankName} onPress={() => onPickBank(bank.id)} />
          ))}
        </View>
      ) : null}
      {sharedAiOff ? null : <Text style={styles.hint}>{copy}</Text>}
      {desktopWeb && bankLoginUrl && !sharedAiOff ? (
        <Btn label="Open internet banking" variant="secondary" onPress={onOpenBank} disabled={working} />
      ) : null}
      {desktopWeb ? (
        <>
          {fileBlock}
          {screenshotBlock}
        </>
      ) : (
        <>
          {screenshotBlock}
          {fileBlock}
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

function FileStep({
  text,
  working,
  error,
  onChangeText,
  onPaste,
  onChooseFile,
  onAnalyse,
}: {
  text: string;
  working: boolean;
  error?: string | null;
  onChangeText: (value: string) => void;
  onPaste: () => void;
  onChooseFile: () => void;
  onAnalyse: () => void;
}) {
  return (
    <>
      <Field
        label="Statement text"
        value={text}
        onChangeText={onChangeText}
        placeholder="Date, Description, Amount…"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={styles.paste}
      />
      <View style={styles.wrap}>
        <Btn label="Paste" variant="secondary" onPress={onPaste} disabled={working} />
        <Btn label="Choose file" variant="secondary" onPress={onChooseFile} disabled={working} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn label={working ? 'Reading…' : 'Continue'} onPress={onAnalyse} busy={working} disabled={!text.trim()} />
    </>
  );
}

function ReviewStep({
  grouped,
  alreadyAdded,
  showAlready,
  selectedCount,
  currency,
  lines,
  working,
  error,
  onToggleAlready,
  onToggleRow,
  onPickCategory,
  onAdd,
}: {
  grouped: Array<{ date: string; rows: ReviewTxnRow[] }>;
  alreadyAdded: ReviewTxnRow[];
  showAlready: boolean;
  selectedCount: number;
  currency: string;
  lines: readonly FinanceBudgetLine[];
  working: boolean;
  error?: string | null;
  onToggleAlready: () => void;
  onToggleRow: (id: string) => void;
  onPickCategory: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      {alreadyAdded.length > 0 ? (
        <Pressable onPress={onToggleAlready} style={styles.already}>
          <Text style={styles.alreadyLabel}>
            {alreadyAdded.length} already added{showAlready ? '' : ' · show'}
          </Text>
        </Pressable>
      ) : null}
      {showAlready
        ? alreadyAdded.map((row) => (
            <TxnRow
              key={row.id}
              row={row}
              currency={currency}
              lines={lines}
              onToggle={() => onToggleRow(row.id)}
              onPickCategory={() => onPickCategory(row.id)}
            />
          ))
        : null}
      {grouped.map((group) => (
        <View key={group.date} style={styles.group}>
          <Text style={styles.dateHead}>{group.date}</Text>
          {group.rows.map((row) => (
            <TxnRow
              key={row.id}
              row={row}
              currency={currency}
              lines={lines}
              onToggle={() => onToggleRow(row.id)}
              onPickCategory={() => onPickCategory(row.id)}
            />
          ))}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        label={`Add ${selectedCount} transaction${selectedCount === 1 ? '' : 's'}`}
        onPress={onAdd}
        busy={working}
        disabled={selectedCount === 0}
      />
    </>
  );
}

function TxnRow({
  row,
  currency,
  lines,
  onToggle,
  onPickCategory,
}: {
  row: ReviewTxnRow;
  currency: string;
  lines: readonly FinanceBudgetLine[];
  onToggle: () => void;
  onPickCategory: () => void;
}) {
  const chip = categoryChipLabel(row, lines);
  return (
    <View style={[styles.txn, row.alreadyAdded && styles.txnMuted]}>
      <Pressable onPress={onToggle} style={styles.checkRow} disabled={row.alreadyAdded}>
        <View style={[styles.check, row.selected && styles.checkOn]}>
          <Text style={styles.checkMark}>{row.selected ? '✓' : ''}</Text>
        </View>
      </Pressable>
      <View style={styles.txnBody}>
        <Text style={styles.merchant}>{row.merchantKey}</Text>
        <Text style={styles.amount}>{formatMoney(row.amount, currency)}</Text>
        {row.pending ? <Text style={styles.pending}>Pending</Text> : null}
        <Pressable onPress={onPickCategory} disabled={row.alreadyAdded}>
          <Text style={styles.chip}>{chip}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function categoryChipLabel(row: ReviewTxnRow, lines: readonly FinanceBudgetLine[]): string {
  if (row.assignment?.ignore) return 'Ignore / transfer';
  if (row.assignment && !row.assignment.ignore) {
    const line = lines.find(
      (item) =>
        item.kind === row.assignment!.kind &&
        item.name.trim().toLowerCase() === row.assignment!.name.trim().toLowerCase(),
    );
    return line ? linePathName(line, lines) : row.assignment.name;
  }
  return 'Choose';
}

function CategoryStep({
  lines,
  currency,
  row,
  onPick,
}: {
  lines: readonly FinanceBudgetLine[];
  currency: string;
  row: ReviewTxnRow;
  onPick: (assignment: StatementAssignment) => void;
}) {
  const ordered = [...lines].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'expense' ? -1 : 1;
    return linePathName(a, lines).localeCompare(linePathName(b, lines));
  });
  return (
    <>
      <Text style={styles.merchant}>{row.merchantKey}</Text>
      <Text style={styles.amount}>{formatMoney(row.amount, currency)}</Text>
      <View style={styles.wrap}>
        {ordered.map((line) => (
          <Pill
            key={line.id}
            label={linePathName(line, lines)}
            onPress={() => onPick({ kind: line.kind, name: line.name })}
          />
        ))}
        <Pill label="Ignore / transfer" onPress={() => onPick({ ignore: true })} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  warn: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bankLabel: { color: colors.textMuted, fontSize: 13 },
  bankValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  paste: { minHeight: 140 },
  already: { paddingVertical: space.xs },
  alreadyLabel: { color: colors.textMuted, fontSize: 13 },
  group: { gap: space.sm },
  dateHead: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  txn: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txnMuted: { opacity: 0.55 },
  txnBody: { flex: 1, gap: 2 },
  merchant: { color: colors.text, fontSize: 15, fontWeight: '600' },
  amount: { color: colors.text, fontSize: 14 },
  pending: { color: colors.warning, fontSize: 12 },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    color: colors.text,
    overflow: 'hidden',
    fontSize: 12,
  },
  checkRow: { paddingTop: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.bg, fontSize: 13, fontWeight: '700' },
});
