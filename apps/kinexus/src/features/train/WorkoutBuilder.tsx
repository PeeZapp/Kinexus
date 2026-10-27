import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import {
  clusterExercises,
  linkSuperset,
  normalizeSupersets,
  REMIX_CATEGORIES,
  REMIX_CATEGORY_COLOR,
  exerciseMatchesRemixCategory,
  exerciseSearchScore,
  estimateWorkout,
  getRemixDefaultsForCategory,
  remixCategoryOf,
  unlinkSuperset,
  type RemixCategory,
} from '@kinexus/domain';

import { AppModal } from '@/src/features/shell/AppModal';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { loadLibrary, type LibraryExercise, type WorkoutDraft } from '@/src/features/train/api';
import { exerciseFacts, exerciseTitle, prettyLabel } from '@/src/features/train/format';
import {
  Choice,
  ExerciseSteps,
  Field,
  MediaGallery,
  NoteLine,
  Pill,
  SearchField,
  Segmented,
  TextAction,
  TrainButton,
  TrainPage,
} from '@/src/features/train/ui';

const VISIBILITY = [
  { value: 'private', label: 'Only me' },
  { value: 'household', label: 'Household' },
  { value: 'people', label: 'People' },
] as const;

export type WorkoutBuilderSeed = {
  name: string;
  visibility: WorkoutDraft['visibility'];
  personIds: string[];
  splitId: string | null;
  durationMin: number | null;
  exercises: {
    exerciseId: string | null;
    name: string;
    targetSets: number;
    targetReps: string;
    targetWeight?: string;
    note?: string;
    supersetId?: string | null;
  }[];
  notes?: { position: number; body: string }[];
};

export type WorkoutBuilderResult = WorkoutBuilderSeed & { start: boolean };

export const EMPTY_WORKOUT_SEED: WorkoutBuilderSeed = {
  name: '',
  visibility: 'private',
  personIds: [],
  splitId: null,
  durationMin: null,
  exercises: [],
};

type BuiltExercise = {
  key: string;
  exerciseId: string | null;
  name: string;
  category: RemixCategory | null;
  targetSets: number;
  targetReps: string;
  targetWeight: string;
  note: string;
  personalNote: string;
  supersetId: string | null;
};

type CatalogRow = {
  exercise: LibraryExercise;
  category: RemixCategory | null;
  haystack: string;
};

let cachedLibrary: LibraryExercise[] | null = null;
let libraryRequest: Promise<LibraryExercise[]> | null = null;

function ensureLibrary(): Promise<LibraryExercise[]> {
  if (cachedLibrary) return Promise.resolve(cachedLibrary);
  if (!libraryRequest) {
    libraryRequest = loadLibrary()
      .then((rows) => {
        cachedLibrary = rows;
        return rows;
      })
      .finally(() => {
        libraryRequest = null;
      });
  }
  return libraryRequest;
}

function suggestWorkoutName(exercises: { name: string }[]): string {
  const [first, second] = exercises;
  if (!first) return '';
  if (!second) return exerciseTitle(first.name);
  if (exercises.length === 2) return `${exerciseTitle(first.name)} & ${exerciseTitle(second.name)}`;
  return `${exerciseTitle(first.name)} + ${exercises.length - 1} more`;
}

function toSelected(seed: WorkoutBuilderSeed): BuiltExercise[] {
  return seed.exercises.map((exercise, index) => ({
    key: exercise.exerciseId ?? `saved-${index}`,
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    category: null,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    targetWeight: exercise.targetWeight ?? '',
    note: exercise.note ?? '',
    personalNote: seed.notes?.find((note) => note.position === index)?.body ?? '',
    supersetId: exercise.supersetId ?? null,
  }));
}

function nextSupersetId(): string {
  return `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WorkoutBuilder({
  presentation,
  seed,
  people,
  editable,
  onClose,
  onDelete,
  onSubmit,
  onPersonalNotes,
}: {
  presentation: 'modal' | 'page';
  seed: WorkoutBuilderSeed;
  people: { id: string; name: string }[];
  editable: boolean;
  onClose?: () => void;
  onDelete?: () => void | Promise<void>;
  onSubmit: (result: WorkoutBuilderResult) => Promise<void>;
  onPersonalNotes?: (notes: { position: number; body: string }[]) => Promise<void>;
}) {
  const [meta] = useState({ splitId: seed.splitId, durationMin: seed.durationMin });
  const [name, setName] = useState(seed.name);
  const [visibility, setVisibility] = useState(seed.visibility);
  const [personIds, setPersonIds] = useState(seed.personIds);
  const [selected, setSelected] = useState<BuiltExercise[]>(() => toSelected(seed));
  const [workoutNote, setWorkoutNote] = useState(() => seed.notes?.find((note) => note.position === -1)?.body ?? '');
  const [library, setLibrary] = useState<LibraryExercise[]>(cachedLibrary ?? []);
  const [libraryReady, setLibraryReady] = useState(cachedLibrary !== null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RemixCategory | ''>('');
  const [preview, setPreview] = useState<LibraryExercise | null>(null);
  const [returnToWorkout, setReturnToWorkout] = useState(false);
  const [pairFrom, setPairFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'workout' | 'library'>(seed.exercises.length > 0 ? 'workout' : 'library');
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const split = useExperienceMode().mode === 'desktop';

  useEffect(() => {
    if (cachedLibrary) return;
    let cancelled = false;
    ensureLibrary()
      .then((rows) => {
        if (cancelled) return;
        setLibrary(rows);
        setLibraryReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load exercises');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected.length === 0) return;
    setName((current) => (current.trim() ? current : suggestWorkoutName(selected)));
  }, [selected]);

  const catalog = useMemo<CatalogRow[]>(
    () =>
      library.map((exercise) => ({
        exercise,
        category: remixCategoryOf(exercise),
        haystack: `${exercise.name} ${exercise.equipment} ${exercise.targetMuscle} ${exercise.bodyPart}`.toLowerCase(),
      })),
    [library],
  );

  useEffect(() => {
    if (catalog.length === 0) return;
    const byId = new Map(catalog.map((row) => [row.exercise.id, row.category]));
    setSelected((rows) => {
      let changed = false;
      const next = rows.map((row) => {
        if (row.category || !row.exerciseId) return row;
        const nextCategory = byId.get(row.exerciseId) ?? null;
        if (!nextCategory) return row;
        changed = true;
        return { ...row, category: nextCategory };
      });
      return changed ? next : rows;
    });
  }, [catalog]);

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const exercise of selected) {
      if (exercise.exerciseId) ids.add(exercise.exerciseId);
    }
    return ids;
  }, [selected]);

  const matches = useMemo(() => {
    const ranked: { row: CatalogRow; score: number }[] = [];
    for (const row of catalog) {
      if (split && selectedIds.has(row.exercise.id)) continue;
      if (category && !exerciseMatchesRemixCategory(row.exercise, category)) continue;
      const score = exerciseSearchScore(query, row.haystack);
      if (score === null) continue;
      ranked.push({ row, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map((item) => item.row);
  }, [catalog, category, query, selectedIds, split]);

  const estimate = useMemo(
    () =>
      estimateWorkout(
        selected.map((exercise) => ({
          name: exercise.name,
          category: exercise.category,
          targetSets: exercise.targetSets,
          supersetId: exercise.supersetId,
        })),
      ),
    [selected],
  );

  const canSubmit = name.trim().length > 0 && selected.length > 0 && !busy;

  function addExercise(exercise: LibraryExercise) {
    if (!editable) return;
    const nextCategory = remixCategoryOf(exercise);
    const defaults = getRemixDefaultsForCategory(nextCategory ?? '');
    setSelected((rows) => {
      if (rows.some((row) => row.exerciseId === exercise.id)) return rows;
      return [
        ...rows,
        {
          key: exercise.id,
          exerciseId: exercise.id,
          name: exercise.name,
          category: nextCategory,
          targetSets: defaults.sets,
          targetReps: defaults.reps,
          targetWeight: '',
          note: '',
          personalNote: '',
          supersetId: null,
        },
      ];
    });
    setPreview(null);
  }

  function removeExercise(key: string) {
    setPairFrom((current) => (current === key ? null : current));
    setSelected((rows) => {
      const next = normalizeSupersets(rows.filter((row) => row.key !== key));
      void persistPersonal(next, workoutNote);
      return next;
    });
  }

  function pairWith(targetKey: string) {
    setSelected((rows) => {
      const sourceIndex = rows.findIndex((row) => row.key === pairFrom);
      const targetIndex = rows.findIndex((row) => row.key === targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return rows;
      const next = linkSuperset(rows, sourceIndex, targetIndex, nextSupersetId);
      void persistPersonal(next, workoutNote);
      return next;
    });
    setPairFrom(null);
  }

  function unlink(key: string) {
    setSelected((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index < 0) return rows;
      const next = unlinkSuperset(rows, index);
      void persistPersonal(next, workoutNote);
      return next;
    });
  }

  async function persistPersonal(rows: BuiltExercise[], mine: string) {
    if (!onPersonalNotes) return;
    try {
      await onPersonalNotes([
        { position: -1, body: mine },
        ...rows.map((row, position) => ({ position, body: row.personalNote })),
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your note');
    }
  }

  async function removeWorkout() {
    if (!onDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete workout');
    } finally {
      setBusy(false);
    }
  }

  async function submit(start: boolean) {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        visibility,
        personIds: visibility === 'people' ? personIds : [],
        splitId: meta.splitId,
        durationMin: estimate.minutes > 0 ? estimate.minutes : meta.durationMin,
        exercises: selected.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps.trim() || '10',
          targetWeight: exercise.targetWeight.trim(),
          note: exercise.note.trim().slice(0, 160),
          supersetId: exercise.supersetId,
        })),
        start,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save workout');
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <View style={[styles.column, presentation === 'modal' && styles.columnModal]}>
      {onClose ? (
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {presentation === 'modal' ? 'Build workout' : name.trim() || 'Workout'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={presentation === 'modal' ? 'Close' : 'Back to workouts'}>
            <Text style={styles.close}>{presentation === 'modal' ? 'Close' : 'Back'}</Text>
          </Pressable>
        </View>
      ) : null}
      <ErrorBanner message={error} />
      {!split ? (
        <>
          <Field value={name} onChangeText={setName} placeholder="Workout name" editable={editable} />
          <Segmented
            value={visibility}
            options={VISIBILITY.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(next) => {
              if (editable) setVisibility(next);
            }}
          />
          {visibility === 'people' ? (
            <View style={styles.people}>
              {people.map((person) => {
                const on = personIds.includes(person.id);
                return (
                  <Choice
                    key={person.id}
                    label={person.name}
                    active={on}
                    onPress={() => {
                      if (!editable) return;
                      setPersonIds((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]));
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          <Segmented
            value={mobilePane}
            options={[
              { value: 'workout', label: 'Workout' },
              { value: 'library', label: 'Library' },
            ]}
            onChange={setMobilePane}
          />
        </>
      ) : null}
      <View style={split ? styles.split : styles.stack}>
        {split || mobilePane === 'workout' ? (
        <View style={split ? [styles.pane, styles.paneLeft] : styles.pane}>
          {split ? (
            <>
              <Field value={name} onChangeText={setName} placeholder="Workout name" editable={editable} />
              <Segmented
                value={visibility}
                options={VISIBILITY.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(next) => {
                  if (editable) setVisibility(next);
                }}
              />
              {visibility === 'people' ? (
                <View style={styles.people}>
                  {people.map((person) => {
                    const on = personIds.includes(person.id);
                    return (
                      <Choice
                        key={person.id}
                        label={person.name}
                        active={on}
                        onPress={() => {
                          if (!editable) return;
                          setPersonIds((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]));
                        }}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}
          <View style={[styles.selectedBlock, styles.selectedBlockSplit]}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Selected · {selected.length}</Text>
                {estimate.minutes > 0 ? (
                  <Text style={styles.count}>
                    {estimate.minutes} min · ~{estimate.calories} kcal
                  </Text>
                ) : null}
              </View>
              {onPersonalNotes ? (
                <NoteLine
                  label="Mine"
                  value={workoutNote}
                  editable
                  maxLength={280}
                  onSave={(body) => {
                    setWorkoutNote(body);
                    void persistPersonal(selected, body);
                  }}
                />
              ) : null}
              <ScrollView
                style={styles.selectedScrollSplit}
                contentContainerStyle={styles.selectedContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {selected.length === 0 ? <Text style={styles.empty}>No exercises</Text> : null}
                {clusterExercises(selected).map((cluster) => {
                  const rows = cluster.indices.map((index) => selected[index]).filter((exercise): exercise is BuiltExercise => Boolean(exercise));
                  const cards = rows.map((exercise, part) => {
                    const info =
                      (exercise.exerciseId ? library.find((item) => item.id === exercise.exerciseId) : undefined) ??
                      library.find((item) => item.name.toLowerCase() === exercise.name.toLowerCase());
                    return (
                    <SelectedExercise
                      key={exercise.key}
                      exercise={exercise}
                      part={cluster.type === 'superset' ? part + 1 : null}
                      pairing={pairFrom !== null}
                      isSource={pairFrom === exercise.key}
                      editable={editable}
                      canPair={selected.length > 1}
                      onDetails={() => {
                        if (!info) return;
                        if (split && preview?.id === info.id) {
                          setPreview(null);
                          return;
                        }
                        setReturnToWorkout(!split);
                        setPreview(info);
                        if (!split) setMobilePane('library');
                      }}
                      detailsReady={Boolean(info)}
                      onRemove={() => removeExercise(exercise.key)}
                      onSuperset={() => setPairFrom(exercise.key)}
                      onCancelPair={() => setPairFrom(null)}
                      onPair={() => pairWith(exercise.key)}
                      onUnlink={() => unlink(exercise.key)}
                      onSets={(value) => {
                        const targetSets = Math.max(1, Math.min(20, Number.parseInt(value, 10) || 1));
                        setSelected((current) => current.map((row) => (row.key === exercise.key ? { ...row, targetSets } : row)));
                      }}
                      onReps={(targetReps) => {
                        setSelected((current) => current.map((row) => (row.key === exercise.key ? { ...row, targetReps } : row)));
                      }}
                      onWeight={(targetWeight) => {
                        setSelected((current) => current.map((row) => (row.key === exercise.key ? { ...row, targetWeight } : row)));
                      }}
                      onNote={(note) => {
                        setSelected((current) => current.map((row) => (row.key === exercise.key ? { ...row, note: note.slice(0, 160) } : row)));
                      }}
                      onPersonalNote={
                        onPersonalNotes
                          ? (personalNote) => {
                              setSelected((current) => {
                                const next = current.map((row) => (row.key === exercise.key ? { ...row, personalNote: personalNote.slice(0, 280) } : row));
                                void persistPersonal(next, workoutNote);
                                return next;
                              });
                            }
                          : undefined
                      }
                    />
                    );
                  });
                  if (cluster.type === 'single') return cards;
                  return (
                    <View key={rows.map((exercise) => exercise.key).join('-')} style={styles.superset}>
                      <Text style={styles.supersetLabel}>Superset</Text>
                      {cards}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
        </View>
        ) : null}
        {split || mobilePane === 'library' ? (
        <View style={styles.pane}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Add exercises</Text>
            {libraryReady ? <Text style={styles.count}>{matches.length.toLocaleString()}</Text> : null}
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search exercises" />
          <View style={styles.filters}>
            <FilterBar>
              <FilterDropdown
                id="muscle"
                label="Muscle"
                value={category}
                valueLabel={category || 'All'}
                open={openMenu === 'muscle'}
                options={[{ value: '' as const, label: 'All' }, ...REMIX_CATEGORIES.map((item) => ({ value: item, label: item }))]}
                active={category !== ''}
                onToggle={toggleMenu}
                onSelect={pick(setCategory)}
              />
            </FilterBar>
          </View>
          <View style={[styles.listWrap, split && preview ? styles.listWrapSplit : null]}>
            {preview && split ? (
              <View style={styles.previewDock}>
                <ExercisePreview
                  exercise={preview}
                  editable={editable && !selectedIds.has(preview.id)}
                  onClose={() => setPreview(null)}
                  onAdd={() => addExercise(preview)}
                />
              </View>
            ) : null}
            {preview && !split ? (
              <ExercisePreview
                exercise={preview}
                editable={editable && !selectedIds.has(preview.id)}
                onClose={() => {
                  setPreview(null);
                  if (returnToWorkout) {
                    setReturnToWorkout(false);
                    setMobilePane('workout');
                  }
                }}
                onAdd={() => addExercise(preview)}
              />
            ) : !libraryReady && !error ? (
              <LoadingState label="Loading exercises" />
            ) : (
              <FlatList
                data={matches}
                keyExtractor={(row) => row.exercise.id}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                initialNumToRender={16}
                windowSize={8}
                ListEmptyComponent={<Text style={styles.empty}>No exercises</Text>}
                renderItem={({ item }) => {
                  const taken = selectedIds.has(item.exercise.id);
                  const line = taken ? 'Selected' : [item.category, prettyLabel(item.exercise.equipment)].filter(Boolean).join(' · ');
                  return (
                    <View style={styles.libraryRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={taken ? `${exerciseTitle(item.exercise.name)} selected` : editable ? `Add ${exerciseTitle(item.exercise.name)}` : exerciseTitle(item.exercise.name)}
                        disabled={!editable || taken}
                        onPress={() => addExercise(item.exercise)}
                        style={({ pressed }) => [styles.libraryCopy, taken && styles.libraryTaken, pressed && editable && !taken && styles.pressed]}>
                        <Text style={[styles.exerciseName, taken && styles.takenName]} numberOfLines={2}>
                          {exerciseTitle(item.exercise.name)}
                        </Text>
                        {line ? <Text style={[styles.meta, taken && styles.takenName]}>{line}</Text> : null}
                      </Pressable>
                      <TrainButton
                        label="Details"
                        onPress={() => {
                          if (preview?.id === item.exercise.id) {
                            setPreview(null);
                            setReturnToWorkout(false);
                            return;
                          }
                          setReturnToWorkout(false);
                          setPreview(item.exercise);
                        }}
                      />
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        {onDelete ? <TrainButton label="Delete" tone="danger" onPress={() => void removeWorkout()} disabled={busy} /> : null}
        <View style={styles.footerActions}>
          {onClose ? (
            <TrainButton label={presentation === 'modal' ? 'Cancel' : 'Back'} tone="ghost" fill onPress={onClose} disabled={busy} />
          ) : null}
          {editable ? <TrainButton label="Save" tone="ghost" fill disabled={!canSubmit} onPress={() => void submit(false)} /> : null}
          <TrainButton label="Start" fill disabled={!canSubmit} onPress={() => void submit(true)} />
        </View>
      </View>
    </View>
  );

  if (presentation === 'page') return <TrainPage>{body}</TrainPage>;
  if (!onClose) return body;
  return <BuilderModal onClose={onClose}>{body}</BuilderModal>;
}

function BuilderModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const { height, width } = useWindowDimensions();
  const cardHeight = desktop ? Math.round(height * 0.9) : Math.round(height * 0.94);
  const cardWidth = desktop ? width - 48 : width;
  return (
    <AppModal visible transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, desktop && styles.backdropDesktop]} onPress={onClose}>
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={[styles.card, { width: cardWidth, height: cardHeight }, desktop ? styles.cardDesktop : styles.cardMobile]}>
          {children}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

function CategoryMark({ category }: { category: RemixCategory }) {
  const color = REMIX_CATEGORY_COLOR[category];
  return (
    <View style={[styles.mark, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.markLabel, { color }]}>{category}</Text>
    </View>
  );
}

function IconButton({
  label,
  glyph,
  tone,
  compact = false,
  onPress,
}: {
  label: string;
  glyph: string;
  tone: 'add' | 'info' | 'remove';
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        compact && styles.iconCompact,
        tone === 'add' && styles.iconAdd,
        tone === 'info' && styles.iconInfo,
        tone === 'remove' && styles.iconRemove,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.iconGlyph, tone === 'add' && styles.iconGlyphAdd, tone === 'remove' && styles.iconGlyphRemove]}>{glyph}</Text>
    </Pressable>
  );
}

function ExercisePreview({
  exercise,
  editable,
  onClose,
  onAdd,
}: {
  exercise: LibraryExercise;
  editable: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const facts = exerciseFacts(exercise);
  const credit =
    exercise.source === 'exercisedb'
      ? 'AscendAPI'
      : exercise.source === 'wger'
        ? `CC BY-SA${exercise.licenseAuthor ? ` · ${exercise.licenseAuthor}` : ''}`
        : '';
  return (
    <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent} keyboardShouldPersistTaps="handled">
      <View style={styles.previewHead}>
        <Text style={styles.previewTitle}>{exerciseTitle(exercise.name)}</Text>
        <TextAction label="Close" tone="accent" onPress={onClose} />
      </View>
      {exercise.mediaUrls.length > 0 ? <MediaGallery urls={exercise.mediaUrls} /> : null}
      {facts.length > 0 ? (
        <View style={styles.pills}>
          {facts.map((fact) => (
            <Pill key={fact} label={fact} />
          ))}
        </View>
      ) : null}
      <ExerciseSteps instructions={exercise.instructions} />
      {credit ? <Text style={styles.credit}>{credit}</Text> : null}
      {editable ? <TrainButton label="Add to workout" fill onPress={onAdd} /> : null}
    </ScrollView>
  );
}

function LabeledSlot({
  label,
  value,
  onChangeText,
  editable,
  keyboard,
  width,
  fill = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  keyboard?: 'decimal-pad';
  width?: number;
  fill?: boolean;
}) {
  return (
    <View style={[styles.slot, fill ? styles.slotFill : { width }]}>
      <Text style={styles.slotLabel}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboard}
        value={value}
        onChangeText={onChangeText}
        style={[styles.slotInput, fill && styles.slotInputFill]}
      />
    </View>
  );
}

function SelectedExercise({
  exercise,
  part,
  pairing,
  isSource,
  editable,
  canPair,
  onRemove,
  onSuperset,
  onCancelPair,
  onPair,
  onUnlink,
  onDetails,
  detailsReady,
  onSets,
  onReps,
  onWeight,
  onNote,
  onPersonalNote,
}: {
  exercise: BuiltExercise;
  part: number | null;
  pairing: boolean;
  isSource: boolean;
  editable: boolean;
  canPair: boolean;
  onRemove: () => void;
  onSuperset: () => void;
  onCancelPair: () => void;
  onPair: () => void;
  onUnlink: () => void;
  onDetails: () => void;
  detailsReady: boolean;
  onSets: (value: string) => void;
  onReps: (value: string) => void;
  onWeight: (value: string) => void;
  onNote: (value: string) => void;
  onPersonalNote?: (value: string) => void;
}) {
  return (
    <View style={[styles.selectedRow, isSource && styles.selectedRowActive]}>
      <View style={styles.selectedTop}>
        <View style={styles.selectedCopy}>
          <Text style={[styles.exerciseName, styles.selectedName]} numberOfLines={1}>
            {exerciseTitle(exercise.name)}
          </Text>
          {exercise.category || part ? (
            <View style={styles.selectedSub}>
              {exercise.category ? <CategoryMark category={exercise.category} /> : null}
              {part ? <Text style={styles.part}>Part {part}</Text> : null}
            </View>
          ) : null}
        </View>
        {editable && canPair ? (
          isSource ? (
            <TextAction label="Cancel" onPress={onCancelPair} />
          ) : pairing ? (
            <TextAction label="Pair" tone="accent" onPress={onPair} />
          ) : (
            <TextAction label="Superset" tone="accent" onPress={onSuperset} />
          )
        ) : null}
        {editable && canPair && exercise.supersetId && !pairing ? <TextAction label="Unlink" onPress={onUnlink} /> : null}
        <TrainButton label="Details" disabled={!detailsReady} onPress={onDetails} />
        {editable ? <IconButton label={`Remove ${exerciseTitle(exercise.name)}`} glyph="×" tone="remove" compact onPress={onRemove} /> : null}
      </View>
      <View style={styles.targets}>
        <LabeledSlot label="Sets" editable={editable} keyboard="decimal-pad" value={String(exercise.targetSets)} onChangeText={onSets} width={78} />
        <Text style={styles.times}>×</Text>
        <LabeledSlot label="Reps" editable={editable} value={exercise.targetReps ?? ''} onChangeText={onReps} width={78} />
        <LabeledSlot label="kg" editable={editable} value={exercise.targetWeight ?? ''} onChangeText={onWeight} width={72} />
      </View>
      <NoteLine label="Note" value={exercise.note} editable={editable} onSave={onNote} />
      {onPersonalNote ? <NoteLine label="Mine" value={exercise.personalNote} editable maxLength={280} onSave={onPersonalNote} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdropDesktop: { justifyContent: 'center' },
  card: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardDesktop: { borderRadius: radius.lg },
  cardMobile: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  column: { flex: 1, minHeight: 0, gap: 10 },
  columnModal: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.md },
  split: { flex: 1, flexDirection: 'row', minHeight: 0, gap: 20 },
  stack: { flex: 1, minHeight: 0, gap: 10 },
  pane: { flex: 1, minWidth: 0, minHeight: 0, gap: 10 },
  paneStacked: { flexGrow: 0, flexShrink: 1, gap: 10 },
  paneLeft: { borderRightWidth: 1, borderRightColor: colors.border, paddingRight: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filters: { zIndex: 20 },
  section: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  count: { color: colors.textDim, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  selectedBlock: { gap: 8, flexShrink: 1 },
  selectedBlockSplit: { flex: 1, minHeight: 0, flexShrink: 1 },
  selectedScroll: { maxHeight: 280 },
  selectedScrollSplit: { flex: 1 },
  selectedContent: { gap: 6 },
  selectedRow: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  selectedRowActive: { borderColor: colors.accent },
  superset: {
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 6,
  },
  supersetLabel: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  selectedTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedCopy: { flex: 1, minWidth: 0, gap: 2 },
  selectedName: { flexGrow: 0, flexBasis: 'auto' },
  selectedSub: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targets: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  times: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  slot: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
  },
  slotFill: { flex: 1, minWidth: 120 },
  slotLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  slotInput: {
    flex: 1,
    minWidth: 18,
    height: 30,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  slotInputFill: { textAlign: 'left' },
  part: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  listWrap: { flex: 1, minHeight: 180 },
  listWrapSplit: { gap: 10 },
  previewDock: { flex: 1, minHeight: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { flex: 1 },
  listContent: { paddingBottom: 8 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  libraryCopy: { flex: 1, minWidth: 0, gap: 2, justifyContent: 'center', paddingVertical: 4 },
  libraryTaken: { opacity: 0.45 },
  takenName: { color: colors.textDim },
  exerciseName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerActions: { flex: 1, flexDirection: 'row', gap: 8 },
  mark: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  markLabel: { fontSize: 11, fontWeight: '800' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: { width: 28, height: 28 },
  iconAdd: { backgroundColor: colors.accentSoft },
  iconInfo: { backgroundColor: colors.bgHover },
  iconRemove: { backgroundColor: colors.dangerBg },
  iconGlyph: { color: colors.textMuted, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  iconGlyphAdd: { color: colors.accent },
  iconGlyphRemove: { color: colors.danger },
  pressed: { opacity: 0.82 },
  preview: { flex: 1 },
  previewContent: { gap: space.md, paddingBottom: space.md },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: { color: colors.textDim, fontSize: 12 },
});
