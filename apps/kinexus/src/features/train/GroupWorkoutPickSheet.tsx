import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  TARGET_UNITS,
  defaultTargetFor,
  exerciseMatchesRemixCategory,
  exerciseSearchScore,
  getRemixDefaultsForCategory,
  remixCategoryOf,
  targetUnitLabel,
  trackingCompatTargets,
  unitToTracking,
  type TargetUnit,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { loadLibrary, type LibraryExercise } from '@/src/features/train/api';
import { exerciseTitle, prettyLabel } from '@/src/features/train/format';
import { SearchField, TrainButton } from '@/src/features/train/ui';

export type GroupPickDraft = {
  exerciseId: string;
  category: string | null;
  targetSets: number;
  targetReps: string;
  targetUnit: TargetUnit;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
};

type PickedMeta = {
  exerciseId: string;
  byName: string;
};

let cachedLibrary: LibraryExercise[] | null = null;
let libraryRequest: Promise<LibraryExercise[]> | null = null;

function ensureLibrary(): Promise<LibraryExercise[]> {
  if (cachedLibrary) return Promise.resolve(cachedLibrary);
  if (libraryRequest) return libraryRequest;
  libraryRequest = loadLibrary()
    .then((rows) => {
      cachedLibrary = rows;
      return rows;
    })
    .finally(() => {
      libraryRequest = null;
    });
  return libraryRequest;
}

function amountRawFromTarget(unit: TargetUnit, target: ReturnType<typeof defaultTargetFor>): string {
  if (unit === 'min') {
    if (target.targetDurationSec != null && target.targetDurationSec > 0) {
      return String(Math.max(1, Math.round(target.targetDurationSec / 60)));
    }
    return '30';
  }
  if (unit === 'sec') {
    if (target.targetDurationSec != null && target.targetDurationSec > 0) {
      return String(target.targetDurationSec);
    }
    return '30';
  }
  if (unit === 'km') {
    if (target.targetDistanceKm != null && target.targetDistanceKm > 0) {
      return String(target.targetDistanceKm);
    }
    return '2';
  }
  if (unit === 'm') {
    if (target.targetDistanceKm != null && target.targetDistanceKm > 0) {
      return String(Math.max(1, Math.round(target.targetDistanceKm * 1000)));
    }
    return '200';
  }
  return target.targetReps || '10';
}

function amountValid(unit: TargetUnit, raw: string): boolean {
  const trimmed = raw.trim();
  if (unit === 'reps') return trimmed.length > 0 && trimmed !== '0';
  const value = unit === 'km' ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value)) return false;
  if (unit === 'sec') return value >= 5 && value <= 3600;
  if (unit === 'min') return value >= 1 && value <= 1440;
  if (unit === 'km') return value >= 0.01 && value <= 999;
  if (unit === 'm') return value >= 1 && value <= 99999;
  return false;
}

function toDraft(
  exercise: LibraryExercise,
  setsRaw: string,
  amountRaw: string,
  unit: TargetUnit,
): GroupPickDraft | null {
  const sets = Number.parseInt(setsRaw, 10);
  if (!Number.isFinite(sets) || sets < 1 || sets > 20) return null;
  if (!amountValid(unit, amountRaw)) return null;
  const category = remixCategoryOf(exercise);
  if (unit === 'min') {
    const minutes = Number.parseInt(amountRaw.trim(), 10);
    const compat = trackingCompatTargets({
      tracking: 'time',
      targetUnit: 'min',
      targetSets: sets,
      targetReps: `${minutes} min`,
      targetDurationSec: minutes * 60,
      targetDistanceKm: null,
    });
    return {
      exerciseId: exercise.id,
      category,
      targetSets: compat.targetSets,
      targetReps: compat.targetReps,
      targetUnit: compat.targetUnit,
      targetDurationSec: compat.targetDurationSec,
      targetDistanceKm: compat.targetDistanceKm,
    };
  }
  if (unit === 'sec') {
    const seconds = Number.parseInt(amountRaw.trim(), 10);
    const compat = trackingCompatTargets({
      tracking: 'intervals',
      targetUnit: 'sec',
      targetSets: sets,
      targetReps: `${seconds} s`,
      targetDurationSec: seconds,
      targetDistanceKm: null,
    });
    return {
      exerciseId: exercise.id,
      category,
      targetSets: compat.targetSets,
      targetReps: compat.targetReps,
      targetUnit: compat.targetUnit,
      targetDurationSec: compat.targetDurationSec,
      targetDistanceKm: null,
    };
  }
  if (unit === 'km') {
    const km = Number.parseFloat(amountRaw.trim());
    const compat = trackingCompatTargets({
      tracking: 'distance',
      targetUnit: 'km',
      targetSets: sets,
      targetReps: `${km} km`,
      targetDurationSec: null,
      targetDistanceKm: km,
    });
    return {
      exerciseId: exercise.id,
      category,
      targetSets: compat.targetSets,
      targetReps: compat.targetReps,
      targetUnit: compat.targetUnit,
      targetDurationSec: null,
      targetDistanceKm: compat.targetDistanceKm,
    };
  }
  if (unit === 'm') {
    const metres = Number.parseInt(amountRaw.trim(), 10);
    const compat = trackingCompatTargets({
      tracking: 'distance',
      targetUnit: 'm',
      targetSets: sets,
      targetReps: `${metres} m`,
      targetDurationSec: null,
      targetDistanceKm: metres / 1000,
    });
    return {
      exerciseId: exercise.id,
      category,
      targetSets: compat.targetSets,
      targetReps: compat.targetReps,
      targetUnit: compat.targetUnit,
      targetDurationSec: null,
      targetDistanceKm: compat.targetDistanceKm,
    };
  }
  const compat = trackingCompatTargets({
    tracking: unitToTracking('reps'),
    targetUnit: 'reps',
    targetSets: sets,
    targetReps: amountRaw.trim(),
    targetDurationSec: null,
    targetDistanceKm: null,
  });
  return {
    exerciseId: exercise.id,
    category,
    targetSets: compat.targetSets,
    targetReps: compat.targetReps,
    targetUnit: 'reps',
    targetDurationSec: null,
    targetDistanceKm: null,
  };
}

export function GroupWorkoutPickSheet({
  visible,
  categories,
  picked,
  onClose,
  onAdd,
}: {
  visible: boolean;
  categories: string[];
  picked: PickedMeta[];
  onClose: () => void;
  onAdd: (draft: GroupPickDraft) => Promise<void>;
}) {
  const [library, setLibrary] = useState<LibraryExercise[]>(cachedLibrary ?? []);
  const [ready, setReady] = useState(Boolean(cachedLibrary));
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [setsRaw, setSetsRaw] = useState('3');
  const [amountRaw, setAmountRaw] = useState('10');
  const [unit, setUnit] = useState<TargetUnit>('reps');
  const [unitOpen, setUnitOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setQuery('');
    setSelected(null);
    setUnitOpen(false);
    setBusy(false);
    let cancelled = false;
    ensureLibrary()
      .then((rows) => {
        if (!cancelled) {
          setLibrary(rows);
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load exercises');
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const pickedById = useMemo(() => new Map(picked.map((row) => [row.exerciseId, row.byName])), [picked]);

  const matches = useMemo(() => {
    const ranked: { exercise: LibraryExercise; score: number }[] = [];
    for (const exercise of library) {
      const inCategory = categories.some((category) => exerciseMatchesRemixCategory(exercise, category));
      if (!inCategory) continue;
      const haystack = [exercise.name, exercise.bodyPart, exercise.equipment, exercise.category]
        .filter(Boolean)
        .join(' ');
      const score = exerciseSearchScore(query, haystack);
      if (score == null) continue;
      ranked.push({ exercise, score });
    }
    ranked.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
    return ranked.slice(0, query ? 60 : 40).map((row) => row.exercise);
  }, [categories, library, query]);

  function chooseExercise(exercise: LibraryExercise) {
    if (pickedById.has(exercise.id)) return;
    const category = remixCategoryOf(exercise);
    const target = defaultTargetFor({
      name: exercise.name,
      category: category ?? exercise.category,
      canonicalKey: exercise.canonicalKey,
      instructions: exercise.instructions,
      repsDefaults: getRemixDefaultsForCategory(category ?? ''),
    });
    setSelected(exercise);
    setUnit(target.targetUnit);
    setSetsRaw(String(target.targetSets));
    setAmountRaw(amountRawFromTarget(target.targetUnit, target));
    setUnitOpen(false);
    setError(null);
  }

  async function submit() {
    if (!selected || busy) return;
    const draft = toDraft(selected, setsRaw, amountRaw, unit);
    if (!draft) {
      setError('Check sets and target');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(draft);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add pick');
    } finally {
      setBusy(false);
    }
  }

  const amountKeyboard = unit === 'reps' ? 'default' : unit === 'km' ? 'decimal-pad' : 'number-pad';
  const setsFaded = (unit === 'min' || unit === 'km' || unit === 'm') && (Number.parseInt(setsRaw, 10) || 1) === 1;

  return (
    <Sheet visible={visible} title={selected ? 'Target' : 'Add exercise'} onClose={onClose}>
      <View style={styles.body}>
        <ErrorBanner message={error} />
        {selected ? (
          <View style={styles.targetStep}>
            <Text style={styles.selectedName}>{exerciseTitle(selected.name)}</Text>
            <View style={styles.targets}>
              <View style={[styles.slot, setsFaded && styles.slotFaded]}>
                <Text style={styles.slotLabel}>Sets</Text>
                <TextInput
                  value={setsRaw}
                  onChangeText={(value) => setSetsRaw(value.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.slotInput}
                />
              </View>
              <Text style={[styles.times, setsFaded && styles.slotFaded]}>×</Text>
              <View style={[styles.slot, styles.slotFill]}>
                <TextInput
                  value={amountRaw}
                  onChangeText={(value) => {
                    if (unit === 'reps') {
                      setAmountRaw(value);
                      return;
                    }
                    if (unit === 'km') {
                      setAmountRaw(value.replace(/[^\d.]/g, ''));
                      return;
                    }
                    setAmountRaw(value.replace(/[^\d]/g, ''));
                  }}
                  keyboardType={amountKeyboard}
                  style={[styles.slotInput, styles.slotInputFill]}
                />
                <View style={styles.unitWrap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setUnitOpen((open) => !open)}
                    hitSlop={6}
                    style={styles.unitButton}>
                    <Text style={styles.unitLabel}>{targetUnitLabel(unit)} ▾</Text>
                  </Pressable>
                  {unitOpen ? (
                    <View style={styles.unitMenu}>
                      {TARGET_UNITS.map((next) => (
                        <Pressable
                          key={next}
                          accessibilityRole="button"
                          onPress={() => {
                            setUnit(next);
                            setUnitOpen(false);
                          }}
                          style={[styles.unitOption, next === unit && styles.unitOptionOn]}>
                          <Text style={[styles.unitOptionLabel, next === unit && styles.unitOptionLabelOn]}>
                            {targetUnitLabel(next)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <TrainButton label="Back" tone="ghost" onPress={() => setSelected(null)} disabled={busy} />
              <TrainButton label="Add" fill onPress={() => void submit()} disabled={busy} />
            </View>
          </View>
        ) : !ready ? (
          <LoadingState label="Loading exercises" />
        ) : (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search exercises" />
            <View style={styles.list}>
              {matches.map((exercise) => {
                const by = pickedById.get(exercise.id);
                const taken = Boolean(by);
                const line = taken
                  ? `Picked by ${by}`
                  : [remixCategoryOf(exercise), prettyLabel(exercise.equipment)].filter(Boolean).join(' · ');
                return (
                  <Pressable
                    key={exercise.id}
                    accessibilityRole="button"
                    disabled={taken}
                    onPress={() => chooseExercise(exercise)}
                    style={[styles.row, taken && styles.rowTaken]}>
                    <Text style={[styles.name, taken && styles.nameTaken]} numberOfLines={2}>
                      {exerciseTitle(exercise.name)}
                    </Text>
                    {line ? (
                      <Text style={[styles.meta, taken && styles.nameTaken]} numberOfLines={1}>
                        {line}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {matches.length === 0 ? <Text style={styles.empty}>No exercises</Text> : null}
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm, paddingBottom: space.md },
  list: { gap: 4 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  rowTaken: { opacity: 0.72 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  nameTaken: { color: colors.textDim },
  meta: { color: colors.textDim, fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: space.md },
  targetStep: { gap: space.md },
  selectedName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  targets: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slot: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  slotFill: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotFaded: { opacity: 0.45 },
  slotLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  slotInput: { color: colors.text, fontSize: 16, fontWeight: '700', padding: 0 },
  slotInputFill: { flex: 1, minWidth: 0 },
  times: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  unitWrap: { position: 'relative' },
  unitButton: { paddingHorizontal: 2, paddingVertical: 2 },
  unitLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  unitMenu: {
    position: 'absolute',
    right: 0,
    top: 22,
    zIndex: 20,
    minWidth: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  unitOption: { paddingHorizontal: 10, paddingVertical: 8 },
  unitOptionOn: { backgroundColor: colors.bgHover },
  unitOptionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  unitOptionLabelOn: { color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
});
