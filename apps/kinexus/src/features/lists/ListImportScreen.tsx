import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  defaultTargetFor,
  trackingCompatTargets,
  watchlistEntries,
  type ExistingDedupeItem,
  type HistoryDedupeItem,
  type KinexusListKind,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { ListImportWizard } from '@/src/features/lists/ListImportWizard';
import { workoutWeightToKg, type ListImportWriters } from '@/src/features/lists/list-import-apply';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { CookShell } from '@/src/features/cook/CookShell';
import { colors, space } from '@/src/features/shell/theme';
import { useStashSync } from '@/src/features/stash/use-stash-sync';
import { useWatchlistSync } from '@/src/features/stash/use-watchlist-sync';
import {
  createWorkout,
  importFinishedSession,
  loadHistoryDedupeKeys,
  loadLibrary,
  loadWorkouts,
  saveWorkout,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { createCustomExercise } from '@/src/features/train/custom-exercises-api';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useUnits } from '@/src/lib/use-units';

const KINDS: KinexusListKind[] = ['watchlist', 'wishlist', 'checklist', 'shopping', 'workout'];

function asKind(value: string | string[] | undefined): KinexusListKind | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (KINDS as string[]).includes(raw) ? (raw as KinexusListKind) : null;
}

export function ListImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; linkUrl?: string | string[] }>();
  const linkUrlParam = typeof params.linkUrl === 'string' ? params.linkUrl : params.linkUrl?.[0] ?? null;
  const [kind, setKind] = useState<KinexusListKind | null>(asKind(params.kind));
  const [wizardOpen, setWizardOpen] = useState(Boolean(asKind(params.kind)));
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const { weightUnit } = useUnits();
  const watchlist = useWatchlistSync();
  const stash = useStashSync();
  const meals = useMealsSync();
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [historyKeys, setHistoryKeys] = useState<HistoryDedupeItem[]>([]);

  useEffect(() => {
    if (kind !== 'workout' || !activeHousehold || !user || user.isDevBypass) return;
    void loadWorkouts(activeHousehold.id).then(setWorkouts).catch(() => setWorkouts([]));
    void loadHistoryDedupeKeys(user.id, activeHousehold.id).then(setHistoryKeys).catch(() => setHistoryKeys([]));
  }, [activeHousehold, kind, user]);

  const existingLists = useMemo(() => {
    if (!kind) return [];
    if (kind === 'watchlist') {
      return watchlist.lists.filter((list) => list.kind === 'custom').map((list) => ({ id: list.id, name: list.name }));
    }
    if (kind === 'wishlist') {
      return stash.lists.filter((list) => list.kind === 'wishlist').map((list) => ({ id: list.id, name: list.name }));
    }
    if (kind === 'checklist') {
      return stash.lists.filter((list) => list.kind === 'checklist').map((list) => ({ id: list.id, name: list.name }));
    }
    if (kind === 'workout') {
      return workouts.map((workout) => ({ id: workout.id, name: workout.name }));
    }
    return [];
  }, [kind, stash.lists, watchlist.lists, workouts]);

  const existingItems: ExistingDedupeItem[] = useMemo(() => {
    if (!kind) return [];
    if (kind === 'watchlist') {
      return watchlistEntries(watchlist.lists, watchlist.titles, watchlist.items).map((entry) => ({
        title: entry.title.title,
        tmdbId: entry.title.tmdbId,
      }));
    }
    if (kind === 'wishlist') {
      return stash.products.map((product) => ({ title: product.title, url: product.sourceUrl }));
    }
    if (kind === 'checklist') {
      return stash.items.map((item) => ({ title: item.title }));
    }
    if (kind === 'shopping') {
      return meals.shoppingItems.map((item) => ({ title: item.name }));
    }
    if (kind === 'workout') {
      return workouts.flatMap((workout) => workout.exercises.map((exercise) => ({ title: exercise.name })));
    }
    return [];
  }, [kind, meals.shoppingItems, stash.items, stash.products, watchlist.items, watchlist.lists, watchlist.titles, workouts]);

  const writers: ListImportWriters = useMemo(() => {
    return {
      ensureTargetList: async (target) => {
        if (!kind) throw new Error('Pick a list type');
        if (kind === 'shopping') return null;
        if (target.mode === 'existing') return target.listId;
        if (kind === 'watchlist') {
          return watchlist.createList(target.name, { visibility: 'private', personIds: [] });
        }
        if (kind === 'wishlist' || kind === 'checklist') {
          return stash.createList(target.name, { visibility: 'private', personIds: [] }, { kind });
        }
        if (kind === 'workout') {
          if (!activeHousehold || !user || user.isDevBypass) throw new Error('Sign in to import workouts');
          return createWorkout({
            householdId: activeHousehold.id,
            userId: user.id,
            name: target.name,
            visibility: 'private',
            splitId: null,
            durationMin: null,
            personIds: [],
            exercises: [],
          });
        }
        throw new Error('Unsupported list type');
      },
      writeRow: async (listId, row) => {
        if (!kind) return;
        if (kind === 'watchlist') {
          if (!listId || row.tmdbId == null) return;
          const hit: WatchlistSearchHit = {
            tmdbId: row.tmdbId,
            mediaType: row.mediaType ?? 'movie',
            title: row.title,
            year: row.year,
            overview: null,
            posterPath: null,
            backdropPath: null,
            imdbId: row.imdbId,
          };
          await watchlist.addTitleToList(listId, hit, {
            sourceUrl: row.url,
            status: row.itemStatus ?? 'want',
          });
          return;
        }
        if (kind === 'wishlist') {
          if (!listId) return;
          await stash.createProduct({
            title: row.title,
            sourceUrl: row.url ?? '',
            currentPrice: row.price ?? undefined,
            notes: row.notes ?? undefined,
            listId,
            priceSource: 'manual',
            detailStatus: 'ready',
          });
          return;
        }
        if (kind === 'checklist') {
          if (!listId) return;
          await stash.createItem(listId, { title: row.title, notes: row.notes });
          return;
        }
        if (kind === 'shopping') {
          await meals.addShoppingItem(row.title, row.quantity ?? undefined);
          return;
        }
        if (kind === 'workout') {
          if (!listId || !activeHousehold) return;
          const current = (await loadWorkouts(activeHousehold.id)).find((workout) => workout.id === listId);
          if (!current) return;
          const exercises = [
            ...current.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              name: exercise.name,
              tracking: exercise.tracking,
              targetUnit: exercise.targetUnit,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
              targetDurationSec: exercise.targetDurationSec,
              targetDistanceKm: exercise.targetDistanceKm,
              targetWeight: exercise.targetWeight,
              targetEffort: exercise.targetEffort,
              targetRpe: exercise.targetRpe,
              note: exercise.note,
              supersetId: exercise.supersetId,
            })),
            (() => {
              const hasLoad =
                (row.reps != null && String(row.reps).trim() !== '') ||
                (row.weight != null && row.weight > 0);
              const durationSec = row.durationSec;
              const distanceKm = row.distanceKm;
              if (!hasLoad && ((durationSec != null && durationSec > 0) || (distanceKm != null && distanceKm > 0))) {
                const sets = Math.max(1, row.sets ?? 1);
                const fromDistance =
                  distanceKm != null && distanceKm > 0
                    ? trackingCompatTargets({
                        tracking: 'distance',
                        targetUnit: distanceKm < 1 ? 'm' : 'km',
                        targetSets: sets,
                        targetReps: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`,
                        targetDurationSec: null,
                        targetDistanceKm: distanceKm,
                      })
                    : null;
                const fromDuration =
                  !fromDistance && durationSec != null && durationSec > 0
                    ? trackingCompatTargets({
                        tracking: durationSec < 120 ? 'intervals' : 'time',
                        targetUnit: durationSec < 120 ? 'sec' : 'min',
                        targetSets: sets,
                        targetReps:
                          durationSec < 120
                            ? `${durationSec} s`
                            : `${Math.max(1, Math.round(durationSec / 60))} min`,
                        targetDurationSec:
                          durationSec < 120 ? durationSec : Math.max(1, Math.round(durationSec / 60)) * 60,
                        targetDistanceKm: null,
                      })
                    : null;
                const targets = fromDistance ?? fromDuration!;
                return {
                  exerciseId: null as string | null,
                  name: row.title,
                  tracking: targets.tracking,
                  targetUnit: targets.targetUnit,
                  targetSets: targets.targetSets,
                  targetReps: targets.targetReps,
                  targetDurationSec: targets.targetDurationSec,
                  targetDistanceKm: targets.targetDistanceKm,
                  targetWeight: null as number | null,
                  note: row.notes ?? '',
                  supersetId: null as string | null,
                };
              }
              const defaults = defaultTargetFor({
                name: row.title,
                targetSets: row.sets ?? 3,
                targetReps: row.reps ?? '8',
              });
              return {
                exerciseId: null as string | null,
                name: row.title,
                tracking: defaults.tracking,
                targetUnit: defaults.targetUnit,
                targetSets: defaults.targetSets,
                targetReps: defaults.targetReps,
                targetDurationSec: defaults.targetDurationSec,
                targetDistanceKm: defaults.targetDistanceKm,
                targetWeight: workoutWeightToKg(row.weight, weightUnit),
                note: row.notes ?? '',
                supersetId: null as string | null,
              };
            })(),
          ];
          await saveWorkout(listId, activeHousehold.id, {
            name: current.name,
            visibility: current.visibility,
            splitId: current.splitId,
            durationMin: current.durationMin,
            personIds: current.personIds,
            exercises,
          });
        }
      },
            workoutExport:
        kind === 'workout' && activeHousehold && user && !user.isDevBypass
          ? {
              createRoutine: async (routine) => {
                const id = await createWorkout({
                  householdId: activeHousehold.id,
                  userId: user.id,
                  name: routine.name,
                  visibility: 'private',
                  splitId: null,
                  durationMin: routine.durationMin,
                  personIds: [],
                  exercises: routine.exercises
                    .filter((exercise) => exercise.status === 'ready' || exercise.status === 'needsMatch')
                    .map((exercise) => ({
                      exerciseId: exercise.exerciseId,
                      name: exercise.name,
                      tracking: exercise.tracking,
                      targetUnit: exercise.targetUnit,
                      targetSets: exercise.targetSets,
                      targetReps: exercise.targetReps,
                      targetDurationSec: exercise.targetDurationSec,
                      targetDistanceKm: exercise.targetDistanceKm,
                      targetWeight: exercise.targetWeightKg,
                      targetEffort: exercise.targetEffort ?? null,
                      targetRpe: exercise.targetRpe,
                      note: exercise.note ?? '',
                      supersetId: null,
                    })),
                });
                setWorkouts(await loadWorkouts(activeHousehold.id));
                return id;
              },
              findRoutineId: async (name) => {
                const rows = await loadWorkouts(activeHousehold.id);
                const hit = rows.find((workout) => workout.name.trim().toLowerCase() === name.trim().toLowerCase());
                return hit?.id ?? null;
              },
              createCustomExercise: async (name) =>
                createCustomExercise({
                  userId: user.id,
                  draft: {
                    name,
                    bodyPart: 'other',
                    equipment: 'body weight',
                    targetMuscle: 'other',
                    secondaryMuscles: [],
                    instructions: [],
                    category: null,
                    difficulty: null,
                    isCompound: null,
                    mediaUrl: null,
                    mediaUrls: [],
                    mediaKind: null,
                    scope: 'private',
                    householdId: null,
                    groupId: null,
                  },
                }),
              createHistorySession: async (session, workoutId) => {
                if (!session.startedAt) return;
                await importFinishedSession({
                  householdId: activeHousehold.id,
                  userId: user.id,
                  workoutId,
                  name: session.name,
                  startedAt: session.startedAt,
                  finishedAt: session.endedAt,
                  durationMin: session.durationMin,
                  exercises: session.exercises.map((exercise) => ({
                    exerciseId: exercise.exerciseId,
                    name: exercise.name,
                    sets: exercise.sets.map((set) => ({
                      weightKg: set.weightKg,
                      reps: set.reps,
                      durationSec: set.durationSec,
                      distanceKm: set.distanceM != null ? set.distanceM / 1000 : null,
                    })),
                  })),
                });
                setHistoryKeys(await loadHistoryDedupeKeys(user.id, activeHousehold.id));
              },
            }
          : undefined,
    };
  }, [activeHousehold, kind, meals, stash, user, watchlist, weightUnit]);

  function openKind(next: KinexusListKind) {
    setKind(next);
    if (next === 'workout' && activeHousehold && user && !user.isDevBypass) {
      void loadWorkouts(activeHousehold.id).then(setWorkouts).catch(() => setWorkouts([]));
      void loadHistoryDedupeKeys(user.id, activeHousehold.id).then(setHistoryKeys).catch(() => setHistoryKeys([]));
    }
    setWizardOpen(true);
  }

  return (
    <CookShell title="Import list" showInstall={false}>
      <View style={styles.root}>
        <Text style={styles.hint}>What are you importing?</Text>
        <View style={styles.wrap}>
          {KINDS.map((item) => (
            <Pill key={item} label={item} active={kind === item} onPress={() => openKind(item)} />
          ))}
        </View>
        <Btn label="Close" variant="ghost" onPress={() => router.back()} />
      </View>
      {kind ? (
        <ListImportWizard
          visible={wizardOpen}
          kind={kind}
          existingLists={existingLists}
          existingItems={existingItems}
          existingHistory={historyKeys}
          existingWorkoutFingerprints={workouts.map((workout) => ({
            id: workout.id,
            name: workout.name,
            exerciseNames: workout.exercises.map((exercise) => exercise.name),
          }))}
          weightUnit={weightUnit}
          writers={writers}
          initialLinkUrl={kind === 'watchlist' || kind === 'workout' ? linkUrlParam : null}
          loadExerciseCatalog={
            kind === 'workout'
              ? async () =>
                  (await loadLibrary()).map((exercise) => ({
                    id: exercise.id,
                    name: exercise.name,
                    category: exercise.category,
                  }))
              : undefined
          }
          onOpenExistingWorkout={(workoutId) => router.replace(`/train/${workoutId}`)}
          onClose={() => {
            setWizardOpen(false);
            if (params.kind) router.back();
          }}
        />
      ) : null}
    </CookShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  hint: { color: colors.textMuted, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
