import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  exerciseSearchScore,
  filterTrainGlobalLibrary,
  TRAIN_GLOBAL_EQUIPMENT,
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  TRAIN_GLOBAL_SORTS,
  trainGlobalEquipmentLabel,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
  type TrainGlobalEquipment,
  type TrainGlobalGoal,
  type TrainGlobalLevel,
  type TrainGlobalSort,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { PublicName } from '@/src/features/shell/PublicName';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import {
  copyGlobalWorkoutToMine,
  loadGlobalWorkouts,
  loadLibrary,
  rateGlobalWorkout,
  type GlobalWorkoutCard,
  type LibraryExercise,
} from '@/src/features/train/api';
import { exerciseFacts, exerciseTitle } from '@/src/features/train/format';
import { ExerciseSteps, MediaGallery, Pill, SearchField, Segmented, TextAction, TrainPage } from '@/src/features/train/ui';

const PARTS = [
  ['all', 'All'],
  ['chest', 'Chest'],
  ['back', 'Back'],
  ['legs', 'Legs'],
  ['shoulders', 'Shoulders'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['core', 'Core'],
  ['forearms', 'Forearms'],
  ['cardio', 'Cardio'],
  ['neck', 'Neck'],
] as const;

type Pane = 'exercises' | 'global';

export function LibraryScreen() {
  const [pane, setPane] = useState<Pane>('exercises');

  return (
    <TrainPage>
      <Segmented
        value={pane}
        options={[
          { value: 'exercises', label: 'Exercises' },
          { value: 'global', label: 'Global' },
        ]}
        onChange={setPane}
      />
      {pane === 'exercises' ? <ExerciseLibraryPane /> : <GlobalLibraryPane />}
    </TrainPage>
  );
}

function ExerciseLibraryPane() {
  const [rows, setRows] = useState<LibraryExercise[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<(typeof PARTS)[number][0]>('all');
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const partLabel = PARTS.find(([id]) => id === part)?.[1] ?? 'All';

  useEffect(() => {
    loadLibrary()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load exercises'))
      .finally(() => setReady(true));
  }, []);

  const visible = useMemo(() => {
    const ranked: { row: LibraryExercise; score: number }[] = [];
    for (const row of rows) {
      if (part !== 'all' && row.bodyPart !== part) continue;
      const score = exerciseSearchScore(query, `${row.name} ${row.equipment} ${row.targetMuscle} ${row.bodyPart}`);
      if (score === null) continue;
      ranked.push({ row, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map((item) => item.row);
  }, [part, query, rows]);

  const facts = selected ? exerciseFacts(selected) : [];
  const credit = selected ? creditFor(selected) : '';

  return (
    <>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search exercises" />
      <View style={styles.filters}>
        <FilterBar>
          <FilterDropdown
            id="part"
            label="Body"
            value={part}
            valueLabel={partLabel}
            open={openMenu === 'part'}
            options={PARTS.map(([value, label]) => ({ value, label }))}
            active={part !== 'all'}
            onToggle={toggleMenu}
            onSelect={pick(setPart)}
          />
        </FilterBar>
        {ready ? <Text style={styles.count}>{visible.length.toLocaleString()}</Text> : null}
      </View>
      <ErrorBanner message={error} />
      {!ready && !error ? (
        <LoadingState label="Loading exercises" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(row) => row.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No exercises</Text>}
          renderItem={({ item }) => {
            const meta = exerciseFacts(item).join(' · ');
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <Text style={styles.name}>{exerciseTitle(item.name)}</Text>
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </Pressable>
            );
          }}
        />
      )}
      <Sheet visible={selected !== null} title={selected ? exerciseTitle(selected.name) : ''} wide onClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.detail}>
            {selected.mediaUrls.length > 0 ? <MediaGallery urls={selected.mediaUrls} /> : null}
            {facts.length > 0 ? (
              <View style={styles.pills}>
                {facts.map((fact) => (
                  <Pill key={fact} label={fact} />
                ))}
              </View>
            ) : null}
            <ExerciseSteps instructions={selected.instructions} />
            {credit ? <Text style={styles.credit}>{credit}</Text> : null}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function GlobalLibraryPane() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;
  const [rows, setRows] = useState<GlobalWorkoutCard[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<TrainGlobalLevel | 'all'>('all');
  const [goal, setGoal] = useState<TrainGlobalGoal | 'all'>('all');
  const [equipment, setEquipment] = useState<TrainGlobalEquipment | 'all'>('all');
  const [sort, setSort] = useState<TrainGlobalSort>('top_rated');
  const [selected, setSelected] = useState<GlobalWorkoutCard | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { openMenu, toggleMenu, pick } = useFilterMenus();

  const refresh = useCallback(async () => {
    const next = await loadGlobalWorkouts(userId);
    setRows(next);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load global workouts');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  const visible = useMemo(
    () =>
      filterTrainGlobalLibrary(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          level: row.level,
          goal: row.goal,
          equipment: row.equipment,
          updatedAt: row.updatedAt,
          avgScore: row.avgScore,
          ratingCount: row.ratingCount,
          creatorId: row.createdBy,
        })),
        {
          query,
          level: level === 'all' ? null : level,
          goal: goal === 'all' ? null : goal,
          equipment: equipment === 'all' ? null : equipment,
          sort,
        },
      )
        .map((item) => rows.find((row) => row.id === item.id))
        .filter((row): row is GlobalWorkoutCard => Boolean(row)),
    [equipment, goal, level, query, rows, sort],
  );

  async function onRate(workout: GlobalWorkoutCard, score: number) {
    if (!userId) return;
    const nextScore = workout.myScore === score ? null : score;
    setBusyId(workout.id);
    setError(null);
    try {
      await rateGlobalWorkout({ workoutId: workout.id, userId, score: nextScore });
      const next = await loadGlobalWorkouts(userId);
      setRows(next);
      setSelected((current) => (current?.id === workout.id ? next.find((row) => row.id === workout.id) ?? null : current));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save rating');
    } finally {
      setBusyId(null);
    }
  }

  async function onCopy(workout: GlobalWorkoutCard) {
    if (!userId || !activeHousehold || busyId) return;
    setBusyId(workout.id);
    setError(null);
    try {
      const id = await copyGlobalWorkoutToMine({
        workout,
        householdId: activeHousehold.id,
        userId,
      });
      setSelected(null);
      router.push(`/train/${id}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not copy workout');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search creator workouts" />
      <View style={styles.filters}>
        <FilterBar>
          <FilterDropdown
            id="level"
            label="Level"
            value={level}
            valueLabel={level === 'all' ? 'All' : trainGlobalLevelLabel(level)}
            open={openMenu === 'level'}
            options={[
              { value: 'all', label: 'All' },
              ...TRAIN_GLOBAL_LEVELS.map((value) => ({ value, label: trainGlobalLevelLabel(value) })),
            ]}
            active={level !== 'all'}
            onToggle={toggleMenu}
            onSelect={pick(setLevel)}
          />
          <FilterDropdown
            id="goal"
            label="Goal"
            value={goal}
            valueLabel={goal === 'all' ? 'All' : trainGlobalGoalLabel(goal)}
            open={openMenu === 'goal'}
            options={[
              { value: 'all', label: 'All' },
              ...TRAIN_GLOBAL_GOALS.map((value) => ({ value, label: trainGlobalGoalLabel(value) })),
            ]}
            active={goal !== 'all'}
            onToggle={toggleMenu}
            onSelect={pick(setGoal)}
          />
          <FilterDropdown
            id="equipment"
            label="Gear"
            value={equipment}
            valueLabel={equipment === 'all' ? 'All' : trainGlobalEquipmentLabel(equipment)}
            open={openMenu === 'equipment'}
            options={[
              { value: 'all', label: 'All' },
              ...TRAIN_GLOBAL_EQUIPMENT.map((value) => ({ value, label: trainGlobalEquipmentLabel(value) })),
            ]}
            active={equipment !== 'all'}
            onToggle={toggleMenu}
            onSelect={pick(setEquipment)}
          />
          <FilterDropdown
            id="sort"
            label="Sort"
            value={sort}
            valueLabel={sort === 'top_rated' ? 'Top rated' : 'New'}
            open={openMenu === 'sort'}
            options={TRAIN_GLOBAL_SORTS.map((value) => ({
              value,
              label: value === 'top_rated' ? 'Top rated' : 'New',
            }))}
            active={sort !== 'top_rated'}
            onToggle={toggleMenu}
            onSelect={pick(setSort)}
          />
        </FilterBar>
        {ready ? <Text style={styles.count}>{visible.length.toLocaleString()}</Text> : null}
      </View>
      <ErrorBanner message={error} />
      {!ready && !error ? (
        <LoadingState label="Loading global workouts" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(row) => row.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No creator workouts</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.name}>{item.name}</Text>
              {item.creator ? <PublicName user={item.creator} /> : null}
              <Text style={styles.meta}>
                {[
                  item.level ? trainGlobalLevelLabel(item.level) : null,
                  item.goal ? trainGlobalGoalLabel(item.goal) : null,
                  item.avgScore != null ? `${item.avgScore}/10` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          )}
        />
      )}
      <Sheet visible={selected !== null} title={selected?.name ?? ''} wide onClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.detail}>
            {selected.creator ? <PublicName user={selected.creator} /> : null}
            <View style={styles.pills}>
              {selected.level ? <Pill label={trainGlobalLevelLabel(selected.level)} /> : null}
              {selected.goal ? <Pill label={trainGlobalGoalLabel(selected.goal)} /> : null}
              {selected.equipment.map((item) => (
                <Pill key={item} label={trainGlobalEquipmentLabel(item)} />
              ))}
            </View>
            <Text style={styles.meta}>
              {selected.avgScore != null
                ? `${selected.avgScore}/10 · ${selected.ratingCount} rating${selected.ratingCount === 1 ? '' : 's'}`
                : 'No ratings yet'}
            </Text>
            {userId ? (
              <View style={styles.rateRow}>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                  <Pressable
                    key={score}
                    disabled={busyId === selected.id}
                    onPress={() => void onRate(selected, score)}
                    accessibilityRole="button"
                    style={[styles.scoreChip, selected.myScore === score && styles.scoreChipOn]}>
                    <Text style={[styles.scoreLabel, selected.myScore === score && styles.scoreLabelOn]}>{score}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.exerciseList}>
              {selected.exercises.map((exercise) => (
                <Text key={exercise.id} style={styles.exerciseLine}>
                  {exercise.name}
                </Text>
              ))}
            </View>
            {userId && activeHousehold ? (
              <TextAction
                label={busyId === selected.id ? 'Copying…' : 'Copy to my workouts'}
                onPress={() => void onCopy(selected)}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function creditFor(exercise: LibraryExercise): string {
  if (exercise.source === 'exercisedb') return 'AscendAPI';
  if (exercise.source === 'wger') return `CC BY-SA${exercise.licenseAuthor ? ` · ${exercise.licenseAuthor}` : ''}`;
  return '';
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: 20 },
  count: { color: colors.textDim, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: space.lg },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  pressed: { backgroundColor: colors.bgHover },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: space.lg },
  detail: { gap: space.md, paddingTop: 4, paddingBottom: space.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: { color: colors.textDim, fontSize: 12 },
  rateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scoreChip: {
    minWidth: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  scoreChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  scoreLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  scoreLabelOn: { color: colors.accent },
  exerciseList: { gap: 6 },
  exerciseLine: { color: colors.text, fontSize: 14 },
});
