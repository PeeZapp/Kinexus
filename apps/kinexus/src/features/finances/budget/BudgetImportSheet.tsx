import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  applyAiMerchantGuesses,
  applyMerchantAnswers,
  budgetCategoryOptions,
  draftBudgetFromStatement,
  emptyStatementDraft,
  formatMoney,
  merchantsForProposedLine,
  parseBankStatement,
  statementCoverageHint,
  statementRangeLabel,
  unsureMerchantsForAi,
  type BudgetCategoryOption,
  type ClassifiedStatementTxn,
  type ProposedBudgetLine,
  type StatementAssignment,
  type StatementBudgetDraft,
  type StatementMerchantQuestion,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { classifyBudgetMerchants } from '@/src/features/finances/finance-api';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

const FORMAT_LABEL = {
  csv: 'CSV',
  ofx: 'OFX',
  qif: 'QIF',
  text: 'pasted text',
} as const;

const MAX_STATEMENT_CHARS = 2_000_000;

type Step = 'upload' | 'questions' | 'review';

function pickStatementFile(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.ofx,.qfx,.qif,.txt,text/csv,text/plain,application/x-ofx';
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

export function BudgetImportSheet({
  visible,
  existingLines,
  currency,
  plannedIsEmpty,
  busy,
  error,
  onClose,
  onApply,
}: {
  visible: boolean;
  existingLines: readonly BudgetCategoryOption[];
  currency: string;
  plannedIsEmpty: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onApply: (draft: StatementBudgetDraft, setPlanned: boolean) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<StatementBudgetDraft>(emptyStatementDraft());
  const [localError, setLocalError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [customName, setCustomName] = useState('');
  const [setPlanned, setSetPlanned] = useState(true);
  const categories = useMemo(
    () => budgetCategoryOptions([...existingLines, ...draft.lines]),
    [draft.lines, existingLines],
  );
  const question = draft.questions[0] ?? null;
  const coverage = statementCoverageHint(draft);
  const parsedPreview = useMemo(() => (text.trim() ? parseBankStatement(text) : null), [text]);

  useEffect(() => {
    if (!visible) return;
    setStep('upload');
    setText('');
    setDraft(emptyStatementDraft());
    setLocalError(null);
    setClassifying(false);
    setCustomName('');
    setSetPlanned(true);
  }, [visible]);

  async function pasteClipboard() {
    const next = await Clipboard.getStringAsync();
    if (next.trim()) setText(next);
  }

  async function chooseFile() {
    const next = await pickStatementFile();
    if (next?.trim()) setText(next);
  }

  async function analyse() {
    setLocalError(null);
    const raw = text.trim();
    if (!raw) {
      setLocalError('Paste a statement or choose a file first');
      return;
    }
    if (raw.length > MAX_STATEMENT_CHARS) {
      setLocalError('That file is too large. Export up to 12 months as CSV, OFX, or QIF.');
      return;
    }
    const parsed = parseBankStatement(raw);
    if (parsed.transactions.length === 0) {
      setLocalError('No transactions found. Use a CSV, OFX, or QIF export, or paste the activity lines.');
      return;
    }
    let next = draftBudgetFromStatement(parsed, { existingLines: categories });
    setDraft(next);
    setClassifying(true);
    try {
      const merchants = unsureMerchantsForAi(next);
      if (merchants.length > 0) {
        const guesses = await classifyBudgetMerchants({
          merchants,
          categories: categories.map((item) => ({ kind: item.kind, name: item.name })),
        });
        if (guesses.length > 0) next = applyAiMerchantGuesses(next, guesses);
      }
    } catch {
      // Local rules and questions still work if the classifier is offline.
    } finally {
      setClassifying(false);
    }
    setDraft(next);
    setCustomName('');
    setStep(next.questions.length > 0 ? 'questions' : 'review');
  }

  function answer(assignment: StatementAssignment) {
    if (!question) return;
    const next = applyMerchantAnswers(draft, [{ questionId: question.id, assignment }]);
    setDraft(next);
    setCustomName('');
    if (next.questions.length === 0) setStep('review');
  }

  const title =
    step === 'upload' ? 'Upload statement' : step === 'questions' ? 'A few unknowns' : 'Average monthly budget';

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        {step === 'upload' ? (
          <UploadStep
            text={text}
            parsedCount={parsedPreview?.transactions.length ?? 0}
            format={parsedPreview?.format ?? null}
            dateFrom={parsedPreview?.dateFrom ?? null}
            dateTo={parsedPreview?.dateTo ?? null}
            classifying={classifying}
            error={localError}
            onChangeText={setText}
            onPaste={() => void pasteClipboard()}
            onChooseFile={() => void chooseFile()}
            onAnalyse={() => void analyse()}
          />
        ) : null}
        {step === 'questions' && question ? (
          <QuestionStep
            question={question}
            remaining={draft.questions.length}
            recognised={draft.autoCount}
            total={draft.transactions.length}
            categories={categories.filter((item) => item.kind === question.kind)}
            currency={currency}
            customName={customName}
            onCustomName={setCustomName}
            onAnswer={answer}
          />
        ) : null}
        {step === 'review' ? (
          <ReviewStep
            draft={draft}
            currency={currency}
            coverage={coverage}
            setPlanned={setPlanned}
            plannedIsEmpty={plannedIsEmpty}
            busy={busy}
            error={error ?? localError}
            onTogglePlanned={() => setSetPlanned((value) => !value)}
            onBack={() => setStep(draft.questions.length > 0 ? 'questions' : 'upload')}
            onApply={() => void onApply(draft, setPlanned)}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function UploadStep({
  text,
  parsedCount,
  format,
  dateFrom,
  dateTo,
  classifying,
  error,
  onChangeText,
  onPaste,
  onChooseFile,
  onAnalyse,
}: {
  text: string;
  parsedCount: number;
  format: StatementBudgetDraft['format'] | null;
  dateFrom: string | null;
  dateTo: string | null;
  classifying: boolean;
  error: string | null;
  onChangeText: (value: string) => void;
  onPaste: () => void;
  onChooseFile: () => void;
  onAnalyse: () => void;
}) {
  return (
    <>
      <Text style={styles.hint}>
        Export 12 months of CSV, OFX, or QIF from your bank (usually under statements or account activity) and drop it
        here. You can also paste copied lines. The app averages each category across the months in the file. This does
        not log into a bank.
      </Text>
      <Field
        label="Statement text"
        value={text}
        onChangeText={onChangeText}
        placeholder="Date, Description, Debit, Credit…"
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={styles.paste}
      />
      <View style={styles.wrap}>
        <Btn label="Paste" variant="secondary" onPress={onPaste} />
        {Platform.OS === 'web' ? <Btn label="Choose file" variant="secondary" onPress={onChooseFile} /> : null}
      </View>
      {text.trim() && parsedCount > 0 ? (
        <Text style={styles.hint}>
          {FORMAT_LABEL[format ?? 'text']} · {parsedCount} transaction{parsedCount === 1 ? '' : 's'}
          {dateFrom && dateTo ? ` · ${dateFrom} to ${dateTo}` : ''}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn
        label={classifying ? 'Reading merchants…' : 'Work out average budget'}
        onPress={onAnalyse}
        busy={classifying}
        disabled={!text.trim()}
      />
    </>
  );
}

function QuestionStep({
  question,
  remaining,
  recognised,
  total,
  categories,
  currency,
  customName,
  onCustomName,
  onAnswer,
}: {
  question: StatementMerchantQuestion;
  remaining: number;
  recognised: number;
  total: number;
  categories: BudgetCategoryOption[];
  currency: string;
  customName: string;
  onCustomName: (value: string) => void;
  onAnswer: (assignment: StatementAssignment) => void;
}) {
  const fallback = question.kind === 'income' ? 'Other income' : 'Other';
  return (
    <>
      <Text style={styles.hint}>
        Recognised {recognised} of {total} transactions. {remaining} merchant{remaining === 1 ? '' : 's'} still need a
        home.
      </Text>
      <View style={styles.card}>
        <Text style={styles.merchant}>{question.merchantKey}</Text>
        <Text style={styles.sample}>{question.sample}</Text>
        <Text style={styles.meta}>
          {question.count} transaction{question.count === 1 ? '' : 's'} · {formatMoney(question.total, currency)}{' '}
          {question.kind === 'income' ? 'in' : 'out'}
        </Text>
      </View>
      <Text style={styles.label}>{question.kind === 'income' ? 'Which income is this?' : 'Which expense is this?'}</Text>
      <View style={styles.wrap}>
        {categories.map((item) => (
          <Pill
            key={`${item.kind}:${item.name}`}
            label={item.name}
            active={question.suggestedName === item.name}
            onPress={() => onAnswer({ kind: item.kind, name: item.name })}
          />
        ))}
      </View>
      <Field
        label="Or a new category"
        value={customName}
        onChangeText={onCustomName}
        placeholder="Coffee, sport, pets…"
        autoCapitalize="words"
      />
      <View style={styles.wrap}>
        <Btn
          label="Use this name"
          variant="secondary"
          onPress={() => onAnswer({ kind: question.kind, name: customName.trim() })}
          disabled={!customName.trim()}
        />
        <Btn label={`Skip as ${fallback}`} variant="ghost" onPress={() => onAnswer({ kind: question.kind, name: fallback })} />
        <Btn label="Ignore / transfer" variant="ghost" onPress={() => onAnswer({ ignore: true })} />
      </View>
    </>
  );
}

function ReviewStep({
  draft,
  currency,
  coverage,
  setPlanned,
  plannedIsEmpty,
  busy,
  error,
  onTogglePlanned,
  onBack,
  onApply,
}: {
  draft: StatementBudgetDraft;
  currency: string;
  coverage: string | null;
  setPlanned: boolean;
  plannedIsEmpty: boolean;
  busy?: boolean;
  error?: string | null;
  onTogglePlanned: () => void;
  onBack: () => void;
  onApply: () => void;
}) {
  const income = draft.lines.filter((line) => line.kind === 'income');
  const expenses = draft.lines.filter((line) => line.kind === 'expense');
  return (
    <>
      <Text style={styles.hint}>
        {FORMAT_LABEL[draft.format]} across {statementRangeLabel(draft)}. Typical monthly spend on matching categories
        will be replaced with these averages.
        {draft.ignoredCount > 0 ? ` ${draft.ignoredCount} transfer-like line${draft.ignoredCount === 1 ? '' : 's'} ignored.` : ''}
      </Text>
      {coverage ? <Text style={styles.warn}>{coverage}</Text> : null}
      {income.length > 0 ? <LinePreview title="Income" lines={income} currency={currency} /> : null}
      {expenses.length > 0 ? (
        <LinePreview title="Expenses" lines={expenses} transactions={draft.transactions} currency={currency} showTransactions />
      ) : null}
      <Pressable onPress={onTogglePlanned} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: setPlanned }}>
        <View style={[styles.check, setPlanned && styles.checkOn]}>
          <Text style={styles.checkMark}>{setPlanned ? '✓' : ''}</Text>
        </View>
        <Text style={styles.checkLabel}>
          {plannedIsEmpty ? 'Also fill planned amounts from these averages' : 'Overwrite planned amounts with these monthly averages'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Btn label="Apply monthly budget" onPress={onApply} busy={busy} disabled={draft.lines.length === 0} />
      <Btn label="Back" variant="ghost" onPress={onBack} disabled={busy} />
    </>
  );
}

function LinePreview({
  title,
  lines,
  transactions = [],
  currency,
  showTransactions = false,
}: {
  title: string;
  lines: readonly ProposedBudgetLine[];
  transactions?: readonly ClassifiedStatementTxn[];
  currency: string;
  showTransactions?: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.groupTitle}>{title}</Text>
      {lines.map((line) => (
        <PreviewLine
          key={`${line.kind}:${line.name}`}
          line={line}
          transactions={transactions}
          currency={currency}
          showTransactions={showTransactions}
        />
      ))}
    </View>
  );
}

function PreviewLine({
  line,
  transactions,
  currency,
  showTransactions,
}: {
  line: ProposedBudgetLine;
  transactions: readonly ClassifiedStatementTxn[];
  currency: string;
  showTransactions: boolean;
}) {
  const merchants = useMemo(
    () => (showTransactions ? merchantsForProposedLine(transactions, line) : []),
    [line, showTransactions, transactions],
  );
  const [open, setOpen] = useState(showTransactions);
  return (
    <View style={styles.previewBlock}>
      <Pressable
        onPress={showTransactions ? () => setOpen((value) => !value) : undefined}
        style={styles.previewRow}
        accessibilityRole={showTransactions ? 'button' : undefined}>
        <View style={styles.previewCopy}>
          <Text style={styles.previewName}>{line.name}</Text>
          <Text style={styles.meta}>
            {line.count} transaction{line.count === 1 ? '' : 's'}
            {line.total !== line.spent ? ` · ${formatMoney(line.total, currency)} total` : ''}
            {showTransactions ? (open ? ' · hide' : ' · show') : ''}
          </Text>
        </View>
        <Text style={styles.previewValue}>{formatMoney(line.spent, currency)}</Text>
      </Pressable>
      {showTransactions && open
        ? merchants.map((merchant) => (
            <View key={merchant.merchantKey} style={styles.merchantBlock}>
              <Text style={styles.merchantHead}>
                {merchant.merchantKey}
                {merchant.count > 1 ? ` · ${merchant.count}` : ''}
                {` · ${formatMoney(merchant.total, currency)}`}
              </Text>
              {merchant.transactions.map((txn, index) => (
                <View key={`${txn.date}:${txn.description}:${index}`} style={styles.txnRow}>
                  <Text style={styles.txnDate}>{formatTxnDate(txn.date)}</Text>
                  <Text style={styles.txnDesc} numberOfLines={2}>
                    {txn.description}
                  </Text>
                  <Text style={styles.txnAmount}>{formatMoney(Math.abs(txn.amount), currency)}</Text>
                </View>
              ))}
            </View>
          ))
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
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  warn: { color: colors.warning, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
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
  card: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 6,
  },
  merchant: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sample: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.textDim, fontSize: 12 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  previewBlock: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewCopy: { flex: 1, minWidth: 0 },
  previewName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  previewValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  merchantBlock: { gap: 4, paddingLeft: 4 },
  merchantHead: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  txnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  txnDate: { color: colors.textDim, fontSize: 12, width: 88 },
  txnDesc: { color: colors.text, fontSize: 13, flex: 1, minWidth: 0, lineHeight: 18 },
  txnAmount: { color: colors.text, fontSize: 12, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  checkMark: { color: colors.text, fontSize: 13, fontWeight: '800' },
  checkLabel: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
