import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  acceptExerciseMatch,
  acceptHevyLinkExerciseMatch,
  acceptImportMatch,
  applyMatchResults,
  buildImportPlan,
  buildImportPlanFromHevyLink,
  buildImportPlanFromListLink,
  findMatchingLibraryWorkout,
  formatWeight,
  isHevyWorkoutImportUrl,
  isWatchlistListImportUrl,
  keepExerciseFreeText,
  keepHevyLinkAsCustom,
  matchPlanExercises,
  refreshImportPlanRows,
  refreshWorkoutImportPlan,
  remapImportPlan,
  summarizeImportRows,
  summarizeWorkoutImport,
  type ExerciseCatalogEntry,
  type ExistingDedupeItem,
  type HistoryDedupeItem,
  type ImportApplySummary,
  type ImportField,
  type ImportMatchCandidate,
  type ImportPlan,
  type KinexusListKind,
  type LibraryWorkoutFingerprint,
  type WeightUnit,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import {
  isHevyLinkImportPlan,
  isWorkoutExportPlan,
  runListImport,
  runWorkoutExportImport,
  type ListImportTarget,
  type ListImportWriters,
} from '@/src/features/lists/list-import-apply';
import { pickListFile, type PickedListFile } from '@/src/features/lists/list-file-io';
import { importListFromLink } from '@/src/features/lists/list-import-link-api';
import { takeStashedListImport } from '@/src/features/lists/list-import-stash';
import { ReadlistGoodreadsImport } from '@/src/features/lists/ReadlistGoodreadsImport';
import { Sheet } from '@/src/features/meals/meals-kit';
import { matchWatchlistImport, searchWatchlistCatalog } from '@/src/features/stash/watchlist-api';
import { colors, space } from '@/src/features/shell/theme';
import {
  importWorkoutFromLink,
  trainImportLinkToPreview,
} from '@/src/features/train/train-import-link-api';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Step = 'upload' | 'target' | 'mapping' | 'review' | 'progress' | 'summary';

const KIND_LABEL: Record<KinexusListKind, string> = {
  watchlist: 'Watchlist',
  workout: 'Workout',
  wishlist: 'Wishlist',
  shopping: 'Shopping',
  checklist: 'Checklist',
  readlist: 'Readlist',
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
  { value: 'imdbId', label: 'IMDb' },
  { value: 'rating', label: 'Rating' },
  { value: 'watchedDate', label: 'Watched' },
  { value: 'itemStatus', label: 'Status' },
  { value: 'skip', label: 'Skip' },
];

const MATCH_BATCH = 40;

export function ListImportWizard({
  visible,
  kind,
  existingLists,
  existingItems,
  existingHistory = [],
  existingWorkoutFingerprints = [],
  weightUnit = 'kg',
  country = 'AU',
  writers,
  loadExerciseCatalog,
  listId = null,
  initialLinkUrl = null,
  onClose,
  onDone,
  onOpenExistingWorkout,
}: {
  visible: boolean;
  kind: KinexusListKind;
  existingLists: readonly { id: string; name: string }[];
  existingItems: readonly ExistingDedupeItem[];
  existingHistory?: readonly HistoryDedupeItem[];
  /** Library workouts for Hevy link dedupe (title + exercise set). */
  existingWorkoutFingerprints?: readonly LibraryWorkoutFingerprint[];
  weightUnit?: WeightUnit;
  country?: string;
  writers: ListImportWriters;
  loadExerciseCatalog?: () => Promise<ExerciseCatalogEntry[]>;
  /** Fixed list target for readlist Goodreads import. */
  listId?: string | null;
  /** Prefill IMDb/Letterboxd/Hevy list URL (share picker / deep link). */
  initialLinkUrl?: string | null;
  onClose: () => void;
  onDone?: () => void;
  onOpenExistingWorkout?: (workoutId: string) => void;
}) {
  useExperienceMode();

  if (kind === 'readlist') {
    return (
      <ReadlistGoodreadsImport
        visible={visible}
        listId={listId ?? existingLists[0]?.id ?? null}
        onClose={onClose}
        onDone={onDone}
      />
    );
  }
  const [step, setStep] = useState<Step>('upload');
  const [paste, setPaste] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [picked, setPicked] = useState<PickedListFile | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newName, setNewName] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportApplySummary | null>(null);
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [manualHits, setManualHits] = useState<ImportMatchCandidate[]>([]);
  const [exerciseSearchIndex, setExerciseSearchIndex] = useState<number | null>(null);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [exerciseSearchHits, setExerciseSearchHits] = useState<ExerciseCatalogEntry[]>([]);
  const [existingDupe, setExistingDupe] = useState<LibraryWorkoutFingerprint | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const matchedRef = useRef(false);

  const shoppingFixed = kind === 'shopping';

  useEffect(() => {
    if (!visible) return;
    setStep('upload');
    setPaste('');
    setLinkUrl(
      (kind === 'watchlist' || kind === 'workout') && initialLinkUrl?.trim() ? initialLinkUrl.trim() : '',
    );
    setPicked(null);
    setPlan(null);
    setTargetMode(shoppingFixed ? 'existing' : 'new');
    setNewName('');
    setExistingId(existingLists[0]?.id ?? null);
    setError(null);
    setBusy(false);
    setMatching(false);
    setProgress({ done: 0, total: 0 });
    setSummary(null);
    setManualIndex(null);
    setManualQuery('');
    setManualHits([]);
    setExerciseSearchIndex(null);
    setExerciseSearchQuery('');
    setExerciseSearchHits([]);
    setExistingDupe(null);
    matchedRef.current = false;
    cancelRef.current = { cancelled: false };

    const stashed = takeStashedListImport();
    if (stashed?.linkUrl && (kind === 'watchlist' || kind === 'workout')) {
      setLinkUrl(stashed.linkUrl);
      void analyseLink(stashed.linkUrl);
      return;
    }
    if (stashed) {
      setPicked(stashed);
      void analyse(stashed);
      return;
    }
    if ((kind === 'watchlist' || kind === 'workout') && initialLinkUrl?.trim()) {
      void analyseLink(initialLinkUrl.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [visible, kind, initialLinkUrl]);

  const workoutExport = isWorkoutExportPlan(plan);
  const counts = useMemo(() => {
    if (!plan) return null;
    if (isWorkoutExportPlan(plan)) {
      const summary = summarizeWorkoutImport(plan);
      return {
        imported: summary.routinesReady + (plan.importHistory ? summary.historyReady : 0),
        skippedDuplicate: summary.routinesDuplicate + (plan.importHistory ? summary.historyDuplicate : 0),
        skippedNeedsMatch: summary.exercisesNeedMatch,
        skippedInvalid: 0,
      };
    }
    return summarizeImportRows(plan.rows);
  }, [plan]);
  const needsConfirm = useMemo(
    () =>
      plan?.kind === 'watchlist'
        ? plan.rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row.status === 'needsMatch' && (row.candidates?.length ?? 0) > 0)
        : [],
    [plan],
  );
  const needsSearch = useMemo(
    () =>
      plan?.kind === 'watchlist'
        ? plan.rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row.status === 'needsMatch' && !(row.candidates?.length))
        : [],
    [plan],
  );
  const exerciseNeedsConfirm = useMemo(() => {
    if (!plan || !isWorkoutExportPlan(plan)) return [];
    const out: {
      routineIndex: number;
      exerciseIndex: number;
      name: string;
      candidates: { exerciseId: string; name: string; confidence: number }[];
    }[] = [];
    (plan.workoutRoutines ?? []).forEach((routine, routineIndex) => {
      if (routine.status !== 'ready') return;
      routine.exercises.forEach((exercise, exerciseIndex) => {
        if (exercise.status === 'needsMatch' && (exercise.candidates?.length ?? 0) > 0) {
          out.push({
            routineIndex,
            exerciseIndex,
            name: exercise.name,
            candidates: exercise.candidates!,
          });
        }
      });
    });
    return out;
  }, [plan]);
  const exerciseNeedsManual = useMemo(() => {
    if (!plan || !isWorkoutExportPlan(plan)) return [];
    const out: { routineIndex: number; exerciseIndex: number; name: string }[] = [];
    (plan.workoutRoutines ?? []).forEach((routine, routineIndex) => {
      if (routine.status !== 'ready') return;
      routine.exercises.forEach((exercise, exerciseIndex) => {
        if (exercise.status === 'needsMatch' && !(exercise.candidates?.length)) {
          out.push({ routineIndex, exerciseIndex, name: exercise.name });
        }
      });
    });
    return out;
  }, [plan]);

  async function analyseLink(url = linkUrl) {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError(kind === 'workout' ? 'Paste a Hevy workout link' : 'Paste an IMDb or Letterboxd list link');
      return;
    }
    if (kind === 'workout') {
      if (!isHevyWorkoutImportUrl(trimmed)) {
        setError('Paste a Hevy workout or routine link');
        return;
      }
      setBusy(true);
      matchedRef.current = false;
      setExistingDupe(null);
      try {
        const payload = await importWorkoutFromLink(trimmed);
        const preview = trainImportLinkToPreview(payload);
        const next = buildImportPlanFromHevyLink(preview);
        const dupe = findMatchingLibraryWorkout(
          next.suggestedName,
          (next.workoutRoutines?.[0]?.exercises ?? []).map((ex) => ex.name),
          existingWorkoutFingerprints,
        );
        setPlan(next);
        setNewName(next.suggestedName);
        setExistingDupe(dupe);
        setStep('review');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read that workout');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!isWatchlistListImportUrl(trimmed)) {
      setError('Paste an IMDb or Letterboxd list link');
      return;
    }
    setBusy(true);
    matchedRef.current = false;
    try {
      const payload = await importListFromLink(trimmed);
      const next = refreshImportPlanRows(
        buildImportPlanFromListLink({
          source: payload.source,
          listName: payload.suggestedName,
          items: payload.rows.map((row) => ({
            title: row.title,
            year: row.year,
            imdbId: row.imdbId,
          })),
        }),
        existingItems,
      );
      setPlan(next);
      setNewName(next.suggestedName);
      setStep('target');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that list');
    } finally {
      setBusy(false);
    }
  }

  async function analyse(source?: PickedListFile | null) {
    setError(null);
    setBusy(true);
    matchedRef.current = false;
    try {
      if (
        !source &&
        !paste.trim() &&
        !picked &&
        linkUrl.trim() &&
        ((kind === 'watchlist' && isWatchlistListImportUrl(linkUrl)) ||
          (kind === 'workout' && isHevyWorkoutImportUrl(linkUrl)))
      ) {
        setBusy(false);
        await analyseLink(linkUrl);
        return;
      }
      const file = source ?? picked;
      const text = file?.text ?? paste;
      if (!text?.trim() && !file?.bytes) {
        setError('Paste a list or choose a file first');
        return;
      }
      let next = await buildImportPlan({
        fileName: file?.fileName ?? 'paste.txt',
        mimeType: file?.mimeType,
        text: text || null,
        bytes: file?.bytes ?? null,
        kindHint: kind,
        weightUnit,
      });
      const withKind = { ...next, kind: next.kind ?? kind };
      if (isWorkoutExportPlan(withKind)) {
        if (loadExerciseCatalog) {
          setMatching(true);
          try {
            const catalog = await loadExerciseCatalog();
            next = matchPlanExercises(withKind, catalog);
          } finally {
            setMatching(false);
          }
        } else {
          next = withKind;
        }
        const deduped = refreshWorkoutImportPlan(
          next,
          existingLists.map((list) => list.name),
          existingHistory,
        );
        setPlan(deduped);
        setNewName(deduped.suggestedName);
        setStep('review');
        return;
      }
      setPlan(refreshImportPlanRows(withKind, existingItems));
      setNewName(withKind.suggestedName);
      setStep(shoppingFixed ? (withKind.headers ? 'mapping' : 'review') : 'target');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setBusy(false);
    }
  }

  async function runWatchlistMatching(current: ImportPlan): Promise<ImportPlan> {
    if (current.kind !== 'watchlist') return current;
    const pending = current.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status === 'needsMatch' && row.tmdbId == null);
    if (pending.length === 0) return current;

    setMatching(true);
    let next = current;
    try {
      for (let offset = 0; offset < pending.length; offset += MATCH_BATCH) {
        const batch = pending.slice(offset, offset + MATCH_BATCH);
        const results = await matchWatchlistImport(
          batch.map(({ row, index }) => ({
            key: String(index),
            imdbId: row.imdbId,
            title: row.title,
            year: row.year,
          })),
          country,
        );
        next = applyMatchResults(
          next,
          results.map((result) => ({
            index: Number(result.key),
            confidence: result.confidence,
            match: result.match
              ? {
                  tmdbId: result.match.tmdbId,
                  mediaType: result.match.mediaType,
                  title: result.match.title,
                  year: result.match.year,
                  posterPath: result.match.posterPath,
                  imdbId: result.match.imdbId,
                }
              : null,
            candidates: result.candidates.map((candidate) => ({
              tmdbId: candidate.tmdbId,
              mediaType: candidate.mediaType,
              title: candidate.title,
              year: candidate.year,
              posterPath: candidate.posterPath,
              imdbId: candidate.imdbId,
              confidence: candidate.confidence,
            })),
          })),
        );
        next = refreshImportPlanRows(next, existingItems);
      }
      matchedRef.current = true;
      return next;
    } finally {
      setMatching(false);
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

  useEffect(() => {
    if (step !== 'review' || !plan || plan.kind !== 'watchlist' || matchedRef.current || matching) return;
    const pending = plan.rows.some((row) => row.status === 'needsMatch' && row.tmdbId == null);
    if (!pending) return;
    void runWatchlistMatching(plan)
      .then((next) => setPlan(next))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not match titles'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match once per review entry
  }, [step, plan?.kind, plan?.rows.length]);

  function confirmCandidate(index: number, candidate: ImportMatchCandidate) {
    if (!plan) return;
    setPlan(acceptImportMatch(plan, index, candidate, existingItems));
  }

  async function runManualSearch(index: number) {
    if (!plan) return;
    const query = manualQuery.trim() || plan.rows[index]?.title || '';
    if (query.length < 2) {
      setError('Type at least two characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hits = await searchWatchlistCatalog(query, country);
      setManualHits(
        hits.map((hit) => ({
          tmdbId: hit.tmdbId,
          mediaType: hit.mediaType,
          title: hit.title,
          year: hit.year,
          posterPath: hit.posterPath,
          imdbId: hit.imdbId,
          confidence: 1,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!plan?.kind || busy) return;

    cancelRef.current = { cancelled: false };
    setStep('progress');
    setBusy(true);

    try {
      if (isWorkoutExportPlan(plan)) {
        if (!writers.workoutExport) throw new Error('Workout import is not available here');
        const summary = summarizeWorkoutImport(plan);
        const total = summary.routinesReady + (plan.importHistory ? summary.historyReady : 0);
        setProgress({ done: 0, total });
        const result = await runWorkoutExportImport({
          plan,
          writers: writers.workoutExport,
          signal: cancelRef.current,
          onProgress: (done, totalCount) => setProgress({ done, total: totalCount }),
        });
        setSummary(result);
        setStep('summary');
        onDone?.();
        return;
      }

      const target: ListImportTarget = shoppingFixed
        ? { mode: 'existing', listId: 'shopping', name: 'Shopping' }
        : targetMode === 'new'
          ? { mode: 'new', name: newName.trim() }
          : { mode: 'existing', listId: existingId!, name: existingLists.find((list) => list.id === existingId)?.name ?? 'List' };

      setProgress({ done: 0, total: plan.rows.filter((row) => row.status === 'ready').length });
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
            {kind === 'watchlist' || kind === 'workout' ? (
              <Field
                label="Import from link"
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder={kind === 'workout' ? 'Hevy workout or routine URL' : 'IMDb or Letterboxd list URL'}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}
            <Field
              label="Paste a list"
              value={paste}
              onChangeText={setPaste}
              placeholder="One item per line"
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
            {matching ? <Text style={styles.hint}>{workoutExport ? 'Matching exercises…' : 'Matching titles…'}</Text> : null}
            <Text style={styles.hint}>
              {workoutExport
                ? `${summarizeWorkoutImport(plan).routinesReady} routines`
                : `${counts.imported} to import`}
              {counts.skippedDuplicate ? ` · ${counts.skippedDuplicate} duplicates` : ''}
              {counts.skippedNeedsMatch ? ` · ${counts.skippedNeedsMatch} need a match` : ''}
              {counts.skippedInvalid ? ` · ${counts.skippedInvalid} invalid` : ''}
              {workoutExport && plan.sourceWeightUnit
                ? ` · file ${plan.sourceWeightUnit}, display ${weightUnit}`
                : ''}
            </Text>

            {workoutExport && plan.supportsHistory ? (
              <View style={styles.wrap}>
                <Pill
                  label="Routines only"
                  active={!plan.importHistory}
                  onPress={() => setPlan({ ...plan, importHistory: false })}
                />
                <Pill
                  label="Include history"
                  active={Boolean(plan.importHistory)}
                  onPress={() => setPlan({ ...plan, importHistory: true })}
                />
              </View>
            ) : null}
            {workoutExport && !isHevyLinkImportPlan(plan) ? (
              <Text style={styles.hint}>Private routines. Unmatched stay free-text (no custom catalogue).</Text>
            ) : null}
            {isHevyLinkImportPlan(plan) ? (
              <Text style={styles.hint}>Private library workout. Missing exercises are added to yours.</Text>
            ) : null}
            {existingDupe ? (
              <View style={styles.section}>
                <Text style={styles.rowTitle}>Already in your library</Text>
                <Btn
                  label="Open existing"
                  onPress={() => {
                    onOpenExistingWorkout?.(existingDupe.id);
                    onClose();
                  }}
                />
              </View>
            ) : null}

            {needsConfirm.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Needs confirmation</Text>
                {needsConfirm.slice(0, 8).map(({ row, index }) => (
                  <View key={`confirm-${index}`} style={styles.confirmBlock}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.title}
                      {row.year ? ` (${row.year})` : ''}
                    </Text>
                    <View style={styles.wrap}>
                      {(row.candidates ?? []).slice(0, 3).map((candidate) => (
                        <Pill
                          key={`${candidate.mediaType}-${candidate.tmdbId}`}
                          label={`${candidate.title}${candidate.year ? ` ${candidate.year}` : ''}`}
                          onPress={() => confirmCandidate(index, candidate)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {exerciseNeedsConfirm.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Confirm exercises</Text>
                {exerciseNeedsConfirm.slice(0, 8).map((item) => (
                  <View key={`ex-confirm-${item.routineIndex}-${item.exerciseIndex}`} style={styles.confirmBlock}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.wrap}>
                      {item.candidates.slice(0, 3).map((candidate) => (
                        <Pill
                          key={candidate.exerciseId}
                          label={candidate.name}
                          onPress={() =>
                            setPlan(
                              isHevyLinkImportPlan(plan)
                                ? acceptHevyLinkExerciseMatch(plan, item.exerciseIndex, candidate)
                                : acceptExerciseMatch(plan, item.routineIndex, item.exerciseIndex, candidate),
                            )
                          }
                        />
                      ))}
                      {isHevyLinkImportPlan(plan) ? (
                        <Pill
                          label="Search"
                          active={exerciseSearchIndex === item.exerciseIndex}
                          onPress={() => {
                            setExerciseSearchIndex(item.exerciseIndex);
                            setExerciseSearchQuery(item.name);
                            setExerciseSearchHits([]);
                          }}
                        />
                      ) : (
                        <Pill
                          label="Keep name"
                          onPress={() =>
                            setPlan(keepExerciseFreeText(plan, item.routineIndex, item.exerciseIndex))
                          }
                        />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {isHevyLinkImportPlan(plan)
              ? (plan.workoutRoutines?.[0]?.exercises ?? [])
                  .map((exercise, exerciseIndex) => ({ exercise, exerciseIndex }))
                  .filter(({ exercise }) => exercise.matchStatus === 'missing' || exercise.willCreateCustom)
                  .slice(0, 8)
                  .map(({ exercise, exerciseIndex }) => (
                    <View key={`ex-missing-${exerciseIndex}`} style={styles.confirmBlock}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {exercise.sourceName ?? exercise.name}
                      </Text>
                      <Text style={styles.rowMeta}>Will be added to your exercises</Text>
                      <View style={styles.wrap}>
                        <Pill
                          label="Pick existing"
                          active={exerciseSearchIndex === exerciseIndex}
                          onPress={() => {
                            setExerciseSearchIndex(exerciseIndex);
                            setExerciseSearchQuery(exercise.sourceName ?? exercise.name);
                            setExerciseSearchHits([]);
                          }}
                        />
                        {exercise.willCreateCustom ? null : (
                          <Pill label="Add as new" onPress={() => setPlan(keepHevyLinkAsCustom(plan, exerciseIndex))} />
                        )}
                      </View>
                    </View>
                  ))
              : null}

            {!isHevyLinkImportPlan(plan) && exerciseNeedsManual.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Unmatched exercises</Text>
                {exerciseNeedsManual.slice(0, 8).map((item) => (
                  <View key={`ex-free-${item.routineIndex}-${item.exerciseIndex}`} style={styles.row}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Pill
                      label="Keep name"
                      onPress={() =>
                        setPlan(keepExerciseFreeText(plan, item.routineIndex, item.exerciseIndex))
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {isHevyLinkImportPlan(plan) && exerciseSearchIndex != null && loadExerciseCatalog ? (
              <View style={styles.section}>
                <Field
                  label="Exercise"
                  value={exerciseSearchQuery}
                  onChangeText={setExerciseSearchQuery}
                  placeholder="Search exercises"
                />
                <Btn
                  label={busy ? 'Searching…' : 'Search'}
                  onPress={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const catalog = await loadExerciseCatalog();
                        const q = exerciseSearchQuery.trim().toLowerCase();
                        setExerciseSearchHits(
                          catalog
                            .filter((entry) => !q || entry.name.toLowerCase().includes(q))
                            .slice(0, 8),
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  busy={busy}
                />
                <View style={styles.wrap}>
                  {exerciseSearchHits.map((hit) => (
                    <Pill
                      key={hit.id}
                      label={hit.name}
                      onPress={() => {
                        setPlan(
                          acceptHevyLinkExerciseMatch(plan, exerciseSearchIndex, {
                            exerciseId: hit.id,
                            name: hit.name,
                            confidence: 1,
                          }),
                        );
                        setExerciseSearchIndex(null);
                        setExerciseSearchHits([]);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {needsSearch.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Search manually</Text>
                {needsSearch.slice(0, 6).map(({ row, index }) => (
                  <View key={`search-${index}`} style={styles.row}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.title || '(untitled)'}
                    </Text>
                    <Pill
                      label="Search"
                      active={manualIndex === index}
                      onPress={() => {
                        setManualIndex(index);
                        setManualQuery(row.title);
                        setManualHits([]);
                      }}
                    />
                  </View>
                ))}
                {manualIndex != null ? (
                  <View style={styles.section}>
                    <Field label="Title" value={manualQuery} onChangeText={setManualQuery} placeholder="Search TMDB" />
                    <Btn label={busy ? 'Searching…' : 'Search'} onPress={() => void runManualSearch(manualIndex)} busy={busy} />
                    <View style={styles.wrap}>
                      {manualHits.map((hit) => (
                        <Pill
                          key={`${hit.mediaType}-${hit.tmdbId}`}
                          label={`${hit.title}${hit.year ? ` ${hit.year}` : ''}`}
                          onPress={() => {
                            confirmCandidate(manualIndex, hit);
                            setManualIndex(null);
                            setManualHits([]);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {isHevyLinkImportPlan(plan)
              ? (plan.workoutRoutines?.[0]?.exercises ?? []).slice(0, 12).map((exercise, index) => (
                  <View key={`hevy-ex-${index}`} style={styles.row}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {exercise.sourceName ?? exercise.name}
                      {exercise.targetSets ? ` · ${exercise.targetSets}×${exercise.targetReps}` : ''}
                    </Text>
                    <Text style={styles.rowMeta}>{exercise.matchStatus ?? exercise.status}</Text>
                  </View>
                ))
              : workoutExport
                ? (plan.workoutRoutines ?? []).slice(0, 8).map((routine, index) => (
                    <View key={`routine-${routine.name}-${index}`} style={styles.row}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {routine.name} · {routine.exercises.length} exercises
                        {routine.exercises[0]?.targetWeightKg != null
                          ? ` · ${formatWeight(routine.exercises[0].targetWeightKg, weightUnit)} ${weightUnit}`
                          : ''}
                      </Text>
                      <Text style={styles.rowMeta}>{routine.status}</Text>
                    </View>
                  ))
                : plan.rows
                    .filter((row) => row.status === 'ready' || row.status === 'duplicate' || row.status === 'invalid')
                    .slice(0, 8)
                    .map((row, index) => (
                      <View key={`row-${row.title}-${index}`} style={styles.row}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {row.title || '(untitled)'}
                        </Text>
                        <Text style={styles.rowMeta}>{row.status}</Text>
                      </View>
                    ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!existingDupe ? (
              <Btn
                label="Import"
                onPress={() => void confirmImport()}
                disabled={
                  counts.imported === 0 ||
                  matching ||
                  (workoutExport &&
                    !isHevyLinkImportPlan(plan) &&
                    (exerciseNeedsConfirm.length > 0 || exerciseNeedsManual.length > 0)) ||
                  (isHevyLinkImportPlan(plan) && exerciseNeedsConfirm.length > 0)
                }
                busy={matching}
              />
            ) : null}
            <Btn
              label="Back"
              variant="ghost"
              onPress={() =>
                setStep(
                  workoutExport || isHevyLinkImportPlan(plan)
                    ? 'upload'
                    : plan.headers
                      ? 'mapping'
                      : shoppingFixed
                        ? 'upload'
                        : 'target',
                )
              }
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
              {summary.skippedNeedsMatch ? ` · ${summary.skippedNeedsMatch} need match` : ''}
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
  section: { gap: 8 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  confirmBlock: { gap: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, flex: 1 },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
});
