import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ListImportWizard } from '@/src/features/lists/ListImportWizard';
import { type ListImportWriters, workoutWeightToKg } from '@/src/features/lists/list-io-adapters';
import { shareOrDownloadExport } from '@/src/features/lists/list-file-io';
import {
  createWorkout,
  deleteFinishedSessions,
  displayWeight,
  importFinishedSession,
  loadFinishedSessions,
  loadHistoryDedupeKeys,
  loadLibrary,
  loadLiveSession,
  loadWorkouts,
  saveWorkout,
  type FinishedSessionRow,
  type SessionSet,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { confirmAction } from '@/src/features/train/confirm';
import { createCustomExercise } from '@/src/features/train/custom-exercises-api';
import { exerciseTitle } from '@/src/features/train/format';
import { buildHistoryCsv } from '@/src/features/train/history-export';
import { SearchField, TrainButton, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useUnits } from '@/src/lib/use-units';

type WeekBucket = {
  key: string;
  label: string;
  rows: FinishedSessionRow[];
};

function startOfLocalWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

function weekKey(date: Date): string {
  const start = startOfLocalWeek(date);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function weekLabel(key: string, thisWeekKey: string, lastWeekKey: string): string {
  if (key === thisWeekKey) return 'This week';
  if (key === lastWeekKey) return 'Last week';
  const [year, month, day] = key.split('-').map((part) => Number(part));
  const start = new Date(year!, (month ?? 1) - 1, day ?? 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${startText}–${endText}`;
}

function groupByWeek(rows: FinishedSessionRow[]): WeekBucket[] {
  const thisWeek = startOfLocalWeek(new Date());
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const thisKey = weekKey(thisWeek);
  const lastKey = weekKey(lastWeek);
  const map = new Map<string, FinishedSessionRow[]>();
  for (const row of rows) {
    const key = weekKey(new Date(row.finishedAt));
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, weekRows]) => ({
      key,
      label: weekLabel(key, thisKey, lastKey),
      rows: weekRows,
    }));
}

function sessionMinutes(row: FinishedSessionRow): number {
  if (row.durationMin != null && row.durationMin > 0) return row.durationMin;
  const start = Date.parse(row.startedAt);
  const end = Date.parse(row.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

function bestSetDetail(sets: SessionSet[]): string {
  const working = sets.filter((set) => set.durationSec == null && set.distanceKm == null);
  let best: SessionSet | null = null;
  let bestW = 0;
  for (const set of working) {
    const w = Number.parseFloat(String(set.weight || '').replace(/,/g, '')) || 0;
    if (!best || w > bestW) {
      best = set;
      bestW = w;
    } else if (w === bestW && w > 0) {
      const rb = Number.parseInt(String(best.reps || '').split(/[-–]/)[0] ?? '', 10) || 0;
      const r = Number.parseInt(String(set.reps || '').split(/[-–]/)[0] ?? '', 10) || 0;
      if (r > rb) best = set;
    }
  }
  if (best && (best.weight.trim() || best.reps.trim())) {
    const w = best.weight.trim();
    const r = best.reps.trim();
    if (w && r) return `${w} × ${r}`;
    if (w) return w;
    if (r) return `${r} reps`;
  }
  const timed = sets.find((set) => set.durationSec != null && set.durationSec > 0);
  if (timed?.durationSec != null) {
    if (timed.durationSec >= 60 && timed.durationSec % 60 === 0) return `${timed.durationSec / 60} min`;
    return `${timed.durationSec}s`;
  }
  const distance = sets.find((set) => set.distanceKm != null && set.distanceKm > 0);
  if (distance?.distanceKm != null) return `${distance.distanceKm} km`;
  return `${sets.length} set${sets.length === 1 ? '' : 's'}`;
}

function groupSessionExercises(sets: SessionSet[]): { name: string; detail: string; setCount: number }[] {
  const order: number[] = [];
  const byPosition = new Map<number, SessionSet[]>();
  for (const set of sets) {
    const list = byPosition.get(set.position) ?? [];
    if (!byPosition.has(set.position)) order.push(set.position);
    list.push(set);
    byPosition.set(set.position, list);
  }
  return order.map((position) => {
    const group = byPosition.get(position) ?? [];
    return {
      name: group[0]?.exerciseName ?? 'Exercise',
      detail: bestSetDetail(group),
      setCount: group.length,
    };
  });
}

export function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const { weightUnit } = useUnits();
  const userId = user && !user.isDevBypass ? user.id : null;
  const [rows, setRows] = useState<FinishedSessionRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [historyKeys, setHistoryKeys] = useState<{ name: string; startedAt: string }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, { name: string; detail: string; setCount: number }[]>>(
    {},
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !activeHousehold) {
      setRows([]);
      setWorkouts([]);
      return;
    }
    const [sessions, libraryWorkouts] = await Promise.all([
      loadFinishedSessions(userId, activeHousehold.id),
      loadWorkouts(activeHousehold.id),
    ]);
    setRows(sessions);
    setWorkouts(libraryWorkouts);
  }, [activeHousehold, userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load history');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [query, rows]);

  const thisWeekRows = useMemo(() => {
    const start = startOfLocalWeek(new Date()).getTime();
    return rows.filter((row) => Date.parse(row.finishedAt) >= start);
  }, [rows]);

  const thisWeekWorkouts = thisWeekRows.length;
  const thisWeekMinutes = thisWeekRows.reduce((sum, row) => sum + sessionMinutes(row), 0);

  const weeks = useMemo(() => groupByWeek(visible), [visible]);
  const selectedCount = selectedIds.size;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleExpand(row: FinishedSessionRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (detailById[row.id]) return;
    setDetailLoadingId(row.id);
    try {
      const live = await loadLiveSession(row.id);
      const exercises = groupSessionExercises(live?.sets ?? []);
      setDetailById((current) => ({ ...current, [row.id]: exercises }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load workout');
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function clearSelected() {
    if (!userId || !activeHousehold || selectedCount === 0 || busy) return;
    const ok = await confirmAction(
      'Clear selected?',
      `Remove ${selectedCount} workout${selectedCount === 1 ? '' : 's'} from history.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const ids = [...selectedIds];
    try {
      await deleteFinishedSessions({ userId, householdId: activeHousehold.id, sessionIds: ids });
      const removed = new Set(ids);
      setRows((current) => current.filter((row) => !removed.has(row.id)));
      setSelectedIds(new Set());
      setExpandedId((current) => (current && removed.has(current) ? null : current));
      setDetailById((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not clear workouts');
    } finally {
      setBusy(false);
    }
  }

  async function exportHistory() {
    if (busy) return;
    const exportRows = selectedCount > 0 ? rows.filter((row) => selectedIds.has(row.id)) : rows;
    if (exportRows.length === 0) {
      setError('Nothing to export');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await shareOrDownloadExport(buildHistoryCsv(exportRows));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not export history');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TrainPage>
        <View style={styles.toolbar}>
          <View style={styles.search}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search history" />
          </View>
          {userId && activeHousehold ? (
            <>
              <TrainButton label="Export" tone="ghost" disabled={busy || rows.length === 0} onPress={() => void exportHistory()} />
              {selectedCount > 0 ? (
                <TrainButton
                  label={`Clear (${selectedCount})`}
                  tone="ghost"
                  disabled={busy}
                  onPress={() => void clearSelected()}
                />
              ) : (
                <TrainButton
                  label="Import"
                  tone="ghost"
                  disabled={busy}
                  onPress={() => {
                    void loadHistoryDedupeKeys(userId, activeHousehold.id)
                      .then(setHistoryKeys)
                      .catch(() => setHistoryKeys([]));
                    setImportOpen(true);
                  }}
                />
              )}
            </>
          ) : null}
        </View>
        <ErrorBanner message={error} />
        {!ready && !error ? (
          <LoadingState label="Loading history" />
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            <View style={styles.weekStrip}>
              <Text style={styles.weekStripText}>
                {thisWeekWorkouts === 0
                  ? 'No workouts this week'
                  : `${thisWeekWorkouts} workout${thisWeekWorkouts === 1 ? '' : 's'} · ${thisWeekMinutes} min`}
              </Text>
            </View>
            {visible.length === 0 ? (
              <Text style={styles.empty}>{rows.length === 0 ? 'No finished workouts yet' : 'No matches'}</Text>
            ) : (
              weeks.map((week) => (
                <View key={week.key} style={styles.weekBlock}>
                  <Text style={styles.weekHeading}>{week.label}</Text>
                  {week.rows.map((row) => {
                    const when = new Date(row.finishedAt).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    const minutes = sessionMinutes(row);
                    const open = expandedId === row.id;
                    const detail = detailById[row.id];
                    const checked = selectedIds.has(row.id);
                    return (
                      <View key={row.id} style={styles.row}>
                        <View style={styles.rowMain}>
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            accessibilityLabel={`Select ${row.name}`}
                            onPress={() => toggleSelected(row.id)}
                            hitSlop={8}
                            style={[styles.check, checked && styles.checkOn]}>
                            <Text style={[styles.checkMark, checked && styles.checkMarkOn]}>{checked ? '✓' : ''}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => void toggleExpand(row)}
                            style={({ pressed }) => [styles.rowCopy, pressed && styles.pressed]}>
                            <Text style={styles.name}>{row.name}</Text>
                            <Text style={styles.meta}>
                              {when}
                              {minutes ? ` · ${minutes} min` : ''}
                            </Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" onPress={() => void toggleExpand(row)} hitSlop={8}>
                            <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                          </Pressable>
                        </View>
                        {open ? (
                          <View style={styles.detail}>
                            {detailLoadingId === row.id && !detail ? (
                              <Text style={styles.detailMuted}>Loading</Text>
                            ) : detail && detail.length > 0 ? (
                              detail.map((exercise, index) => (
                                <View key={`${row.id}-${index}`} style={styles.detailRow}>
                                  <Text style={styles.detailName} numberOfLines={1}>
                                    {exerciseTitle(exercise.name)}
                                  </Text>
                                  <Text style={styles.detailMeta} numberOfLines={1}>
                                    {exercise.setCount} set{exercise.setCount === 1 ? '' : 's'}
                                    {exercise.detail ? ` · ${formatDetailWeight(exercise.detail, weightUnit)}` : ''}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.detailMuted}>No exercises recorded</Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </TrainPage>
      <ListImportWizard
        visible={importOpen}
        kind="workout"
        existingLists={workouts.map((workout) => ({ id: workout.id, name: workout.name }))}
        existingItems={workouts.flatMap((workout) => workout.exercises.map((exercise) => ({ title: exercise.name })))}
        existingHistory={historyKeys}
        existingWorkoutFingerprints={workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          exerciseNames: workout.exercises.map((exercise) => exercise.name),
        }))}
        weightUnit={weightUnit}
        loadExerciseCatalog={async () =>
          (await loadLibrary()).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
          }))
        }
        writers={
          {
            ensureTargetList: async (target) => {
              if (!activeHousehold || !userId) throw new Error('Sign in to import workouts');
              if (target.mode === 'existing') return target.listId;
              return createWorkout({
                householdId: activeHousehold.id,
                userId,
                name: target.name,
                visibility: 'private',
                splitId: null,
                durationMin: null,
                personIds: [],
                exercises: [],
              });
            },
            writeRow: async (listId, row) => {
              if (!listId || !activeHousehold) return;
              const current = (await loadWorkouts(activeHousehold.id)).find((workout) => workout.id === listId);
              if (!current) return;
              await saveWorkout(listId, activeHousehold.id, {
                name: current.name,
                visibility: current.visibility,
                splitId: current.splitId,
                durationMin: current.durationMin,
                level: current.level,
                goal: current.goal,
                equipment: current.equipment,
                personIds: current.personIds,
                buddyUserIds: current.buddyUserIds,
                exercises: [
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
                  {
                    exerciseId: null,
                    name: row.title,
                    targetSets: row.sets ?? 3,
                    targetReps: row.reps ?? '8',
                    targetWeight: workoutWeightToKg(row.weight, weightUnit),
                    note: row.notes ?? '',
                    supersetId: null,
                  },
                ],
              });
              await refresh();
            },
            workoutExport:
              activeHousehold && userId
                ? {
                    createRoutine: async (routine) => {
                      const id = await createWorkout({
                        householdId: activeHousehold.id,
                        userId,
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
                            targetSets: exercise.targetSets,
                            targetReps: exercise.targetReps,
                            targetWeight: exercise.targetWeightKg,
                            targetEffort: exercise.targetEffort ?? null,
                            targetRpe: exercise.targetRpe,
                            note: exercise.note ?? '',
                            supersetId: null,
                          })),
                      });
                      await refresh();
                      return id;
                    },
                    findRoutineId: async (name) => {
                      const hit = workouts.find(
                        (workout) => workout.name.trim().toLowerCase() === name.trim().toLowerCase(),
                      );
                      return hit?.id ?? null;
                    },
                    createCustomExercise: async (name) =>
                      createCustomExercise({
                        userId,
                        draft: {
                          name,
                          bodyPart: 'other',
                          equipment: 'bodyweight',
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
                        userId,
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
                          })),
                        })),
                      });
                      setHistoryKeys(await loadHistoryDedupeKeys(userId, activeHousehold.id));
                      await refresh();
                    },
                  }
                : undefined,
          } satisfies ListImportWriters
        }
        onOpenExistingWorkout={(workoutId) => {
          setImportOpen(false);
          router.push(`/train/${workoutId}` as Href);
        }}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}

/** Best-set labels store kg; show user unit when the detail looks like `weight × reps`. */
function formatDetailWeight(detail: string, weightUnit: 'kg' | 'lb'): string {
  const match = detail.match(/^(\d+(?:\.\d+)?)\s*×\s*(.+)$/);
  if (!match) return detail;
  const shown = displayWeight(match[1], weightUnit);
  return shown ? `${shown} × ${match[2]}` : detail;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, minWidth: 0 },
  list: { flex: 1 },
  listContent: { gap: 14, paddingBottom: space.lg },
  weekStrip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  weekStripText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  weekBlock: { gap: 8 },
  weekHeading: { color: colors.textMuted, fontSize: 13, fontWeight: '700', paddingHorizontal: 2 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 3, borderRadius: radius.sm, paddingVertical: 2 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: 'transparent', fontSize: 14, fontWeight: '800' },
  checkMarkOn: { color: colors.bg },
  pressed: { backgroundColor: colors.bgHover },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  chevron: { color: colors.textDim, fontSize: 16, fontWeight: '700' },
  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  detailRow: { gap: 2 },
  detailName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detailMeta: { color: colors.textMuted, fontSize: 13 },
  detailMuted: { color: colors.textDim, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: space.lg },
});
