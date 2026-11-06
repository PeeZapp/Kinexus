import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  buildImportPlan,
  refreshImportPlanRows,
  remapImportPlan,
  summarizeImportRows,
  type ExistingDedupeItem,
  type ImportApplySummary,
  type ImportField,
  type ImportPlan,
  type KinexusListKind,
  type WeightUnit,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import {
  runListImport,
  type ListImportTarget,
  type ListImportWriters,
} from '@/src/features/lists/list-import-apply';
import { pickListFile, type PickedListFile } from '@/src/features/lists/list-file-io';
import { takeStashedListImport } from '@/src/features/lists/list-import-stash';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Step = 'upload' | 'target' | 'mapping' | 'review' | 'progress' | 'summary';

const KIND_LABEL: Record<KinexusListKind, string> = {
  watchlist: 'Watchlist',
  workout: 'Workout',
  wishlist: 'Wishlist',
  shopping: 'Shopping',
  checklist: 'Checklist',
};

const FIELD_OPTIONS: { value: ImportField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'quantity', label: 'Qty' },
  { value: 'notes', label: 'Notes' },
  { value: 'url', label: 'URL' },
  { value: 'price', label: 'Price' },
  { value: 'sets', label: 'Sets' },
  { value: 'reps', label: 'Reps' },
  { value: 'weight', label: 'Weight' },
  { value: 'tmdbId', label: 'TMDB' },
  { value: 'mediaType', label: 'Media' },
  { value: 'skip', label: 'Skip' },
];

export function ListImportWizard({
  visible,
  kind,
  existingLists,
  existingItems,
  weightUnit = 'kg',
  writers,
  onClose,
  onDone,
}: {
  visible: boolean;
  kind: KinexusListKind;
  existingLists: readonly { id: string; name: string }[];
  existingItems: readonly ExistingDedupeItem[];
  weightUnit?: WeightUnit;
  writers: ListImportWriters;
  onClose: () => void;
  onDone?: () => void;
}) {
  useExperienceMode();
  const [step, setStep] = useState<Step>('upload');
  const [paste, setPaste] = useState('');
  const [picked, setPicked] = useState<PickedListFile | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newName, setNewName] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportApplySummary | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const shoppingFixed = kind === 'shopping';

  useEffect(() => {
    if (!visible) return;
    setStep('upload');
    setPaste('');
    setPicked(null);
    setPlan(null);
    setTargetMode(shoppingFixed ? 'existing' : 'new');
    setNewName('');
    setExistingId(existingLists[0]?.id ?? null);
    setError(null);
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    setSummary(null);
    cancelRef.current = { cancelled: false };

    const stashed = takeStashedListImport();
    if (stashed) {
      setPicked(stashed);
      void analyse(stashed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [visible, kind]);

  const counts = useMemo(() => (plan ? summarizeImportRows(plan.rows) : null), [plan]);

  async function analyse(source?: PickedListFile | null) {
    setError(null);
    setBusy(true);
    try {
      const file = source ?? picked;
      const text = file?.text ?? paste;
      if (!text?.trim() && !file?.bytes) {
        setError('Paste a list or choose a file first');
        return;
      }
      const next = await buildImportPlan({
        fileName: file?.fileName ?? 'paste.txt',
        mimeType: file?.mimeType,
        text: text || null,
        bytes: file?.bytes ?? null,
        kindHint: kind,
        weightUnit,
      });
      const withKind = { ...next, kind: next.kind ?? kind };
      setPlan(refreshImportPlanRows(withKind, existingItems));
      setNewName(withKind.suggestedName);
      setStep(shoppingFixed ? (withKind.headers ? 'mapping' : 'review') : 'target');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setBusy(false);
    }
  }

  function chooseTarget() {
    if (!plan) return;
    if (!shoppingFixed && targetMode === 'new' && !newName.trim()) {
      setError('Give the new list a name');
      return;
    }
    if (!shoppingFixed && targetMode === 'existing' && !existingId) {
      setError('Pick a list');
      return;
    }
    setError(null);
    setStep(plan.headers && plan.headers.length > 0 ? 'mapping' : 'review');
  }

  function applyMapping() {
    if (!plan) return;
    const remapped = plan.matrix
      ? remapImportPlan(plan, plan.mapping, plan.matrix)
      : plan;
    setPlan(refreshImportPlanRows(remapped, existingItems));
    setStep('review');
  }

  async function confirmImport() {
    if (!plan?.kind || busy) return;
    const target: ListImportTarget = shoppingFixed
      ? { mode: 'existing', listId: 'shopping', name: 'Shopping' }
      : targetMode === 'new'
        ? { mode: 'new', name: newName.trim() }
        : { mode: 'existing', listId: existingId!, name: existingLists.find((list) => list.id === existingId)?.name ?? 'List' };

    cancelRef.current = { cancelled: false };
    setStep('progress');
    setBusy(true);
    setProgress({ done: 0, total: plan.rows.filter((row) => row.status === 'ready').length });
    try {
      const result = await runListImport({
        kind: plan.kind,
        rows: plan.rows,
        target,
        writers,
        signal: cancelRef.current,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setSummary(result);
      setStep('summary');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('review');
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === 'upload'
      ? `Import ${KIND_LABEL[kind]}`
      : step === 'target'
        ? 'Where to import'
        : step === 'mapping'
          ? 'Match columns'
          : step === 'review'
            ? 'Review'
            : step === 'progress'
              ? 'Importing'
              : 'Done';

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        {step === 'upload' ? (
          <>
            <Field
              label="Paste"
              value={paste}
              onChangeText={setPaste}
              placeholder="One item per line, or CSV…"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              style={styles.paste}
            />
            <View style={styles.wrap}>
              <Btn
                label="Paste clipboard"
                variant="secondary"
                onPress={() => void Clipboard.getStringAsync().then((value) => value.trim() && setPaste(value))}
              />
              <Btn
                label="Choose file"
                variant="secondary"
                onPress={() =>
                  void pickListFile().then((file) => {
                    if (!file) return;
                    setPicked(file);
                    if (file.text) setPaste(file.text);
                  })
                }
              />
            </View>
            {picked ? <Text style={styles.hint}>{picked.fileName}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn label={busy ? 'Reading…' : 'Continue'} onPress={() => void analyse()} busy={busy} />
          </>
        ) : null}

        {step === 'target' && plan ? (
          <>
            <View style={styles.wrap}>
              <Pill label="New list" active={targetMode === 'new'} onPress={() => setTargetMode('new')} />
              <Pill
                label="Existing"
                active={targetMode === 'existing'}
                onPress={existingLists.length === 0 ? undefined : () => setTargetMode('existing')}
              />
            </View>
            {targetMode === 'new' ? (
              <Field label="List name" value={newName} onChangeText={setNewName} placeholder="Imported list" />
            ) : (
              <View style={styles.wrap}>
                {existingLists.map((list) => (
                  <Pill
                    key={list.id}
                    label={list.name}
                    active={existingId === list.id}
                    onPress={() => setExistingId(list.id)}
                  />
                ))}
              </View>
            )}
            <Text style={styles.hint}>Imports stay private.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn label="Continue" onPress={chooseTarget} />
            <Btn label="Back" variant="ghost" onPress={() => setStep('upload')} />
          </>
        ) : null}

        {step === 'mapping' && plan?.headers ? (
          <>
            {plan.headers.map((header, index) => (
              <View key={`${header}-${index}`} style={styles.mapRow}>
                <Text style={styles.mapHeader}>{header || `Column ${index + 1}`}</Text>
                <View style={styles.wrap}>
                  {FIELD_OPTIONS.map((option) => (
                    <Pill
                      key={option.value}
                      label={option.label}
                      active={(plan.mapping[index] ?? 'skip') === option.value}
                      onPress={() =>
                        setPlan({
                          ...plan,
                          mapping: { ...plan.mapping, [index]: option.value },
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
            <Btn label="Continue" onPress={applyMapping} />
            <Btn label="Back" variant="ghost" onPress={() => setStep(shoppingFixed ? 'upload' : 'target')} />
          </>
        ) : null}

        {step === 'review' && plan && counts ? (
          <>
            <Text style={styles.hint}>
              {counts.imported} to import
              {counts.skippedDuplicate ? ` · ${counts.skippedDuplicate} duplicates` : ''}
              {counts.skippedNeedsMatch ? ` · ${counts.skippedNeedsMatch} need a match later` : ''}
              {counts.skippedInvalid ? ` · ${counts.skippedInvalid} invalid` : ''}
            </Text>
            {plan.rows.slice(0, 12).map((row, index) => (
              <View key={`${row.title}-${index}`} style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.title || '(untitled)'}
                </Text>
                <Text style={styles.rowMeta}>{row.status}</Text>
              </View>
            ))}
            {plan.rows.length > 12 ? <Text style={styles.hint}>+{plan.rows.length - 12} more</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn label="Import" onPress={() => void confirmImport()} disabled={counts.imported === 0} />
            <Btn
              label="Back"
              variant="ghost"
              onPress={() => setStep(plan.headers ? 'mapping' : shoppingFixed ? 'upload' : 'target')}
            />
          </>
        ) : null}

        {step === 'progress' ? (
          <>
            <Text style={styles.hint}>
              {progress.done} / {progress.total}
            </Text>
            <Btn label="Cancel" variant="secondary" onPress={() => { cancelRef.current.cancelled = true; }} />
          </>
        ) : null}

        {step === 'summary' && summary ? (
          <>
            <Text style={styles.hint}>
              Imported {summary.imported}
              {summary.skippedDuplicate ? ` · skipped ${summary.skippedDuplicate} duplicates` : ''}
              {summary.skippedNeedsMatch ? ` · ${summary.skippedNeedsMatch} need match (later)` : ''}
              {summary.cancelled ? ' · cancelled' : ''}
            </Text>
            <Btn label="Done" onPress={onClose} />
          </>
        ) : null}

      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paste: { minHeight: 140 },
  hint: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  mapRow: { gap: 8, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  mapHeader: { color: colors.text, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, flex: 1 },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
});
