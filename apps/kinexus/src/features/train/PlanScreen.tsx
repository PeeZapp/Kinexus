import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  canPublishTrainGlobal,
  normalizeTrainShare,
  TRAIN_GLOBAL_EQUIPMENT,
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  trainGlobalEquipmentLabel,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
  trainVisibilityOptions,
  type TrainGlobalEquipment,
  type TrainGlobalGoal,
  type TrainGlobalLevel,
  type TrainVisibility,
} from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import {
  loadMyTrainPlan,
  loadWorkouts,
  saveMyTrainPlan,
  type TrainPlanDraft,
  type WorkoutDraft,
} from '@/src/features/train/api';
import {
  loadPlanTrainTogether,
  loadTrainBuddies,
  type TrainTogetherInvite,
} from '@/src/features/train/buddies-api';
import { Choice, Field, Pill, TextAction, TrainButton, TrainPage, VisibilityPicker } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people } = useHousehold();
  const creator = useCreator();
  const userId = user && !user.isDevBypass ? user.id : null;

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('My plan');
  const [visibility, setVisibility] = useState<TrainVisibility>('private');
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [buddyUserIds, setBuddyUserIds] = useState<string[]>([]);
  const [level, setLevel] = useState<TrainGlobalLevel | null>(null);
  const [goal, setGoal] = useState<TrainGlobalGoal | null>(null);
  const [equipment, setEquipment] = useState<TrainGlobalEquipment[]>([]);
  const [days, setDays] = useState<{ weekday: number; workoutId: string | null; label: string }[]>(
    WEEKDAYS.map((_, weekday) => ({ weekday, workoutId: null, label: '' })),
  );
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);
  const [together, setTogether] = useState<TrainTogetherInvite[]>([]);
  const [pickingDay, setPickingDay] = useState<number | null>(null);

  const visibilityOptions = useMemo(
    () => trainVisibilityOptions({ isApprovedCreator: creator.isApprovedCreator, current: visibility }),
    [creator.isApprovedCreator, visibility],
  );

  const refresh = useCallback(async () => {
    if (!userId || !activeHousehold) {
      setWorkouts([]);
      setBuddies([]);
      return;
    }
    const [plan, workoutRows, buddyRows, togetherRows] = await Promise.all([
      loadMyTrainPlan(userId, activeHousehold.id),
      loadWorkouts(activeHousehold.id),
      loadTrainBuddies(userId),
      loadPlanTrainTogether(userId),
    ]);
    setWorkouts(workoutRows);
    setBuddies(
      buddyRows
        .filter((row) => row.status === 'accepted')
        .map((row) => ({
          id: row.otherUserId,
          name: row.profile.username || row.profile.globalHandle || 'Buddy',
        })),
    );
    setTogether(togetherRows);
    applyPlan(plan);
  }, [activeHousehold, userId]);

  function applyPlan(plan: TrainPlanDraft | null) {
    if (!plan) {
      setName('My plan');
      setVisibility('private');
      setPersonIds([]);
      setBuddyUserIds([]);
      setLevel(null);
      setGoal(null);
      setEquipment([]);
      setDays(WEEKDAYS.map((_, weekday) => ({ weekday, workoutId: null, label: '' })));
      return;
    }
    setName(plan.name);
    setVisibility(plan.visibility);
    setPersonIds(plan.personIds);
    setBuddyUserIds(plan.buddyUserIds);
    setLevel(plan.level);
    setGoal(plan.goal);
    setEquipment(plan.equipment);
    setDays(
      WEEKDAYS.map((_, weekday) => {
        const match = plan.days.find((day) => day.weekday === weekday);
        return { weekday, workoutId: match?.workoutId ?? null, label: match?.label ?? '' };
      }),
    );
  }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load plan');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  useEffect(() => {
    if (visibility === 'global' && !creator.isApprovedCreator) setVisibility('private');
  }, [creator.isApprovedCreator, visibility]);

  async function save() {
    if (!userId || !activeHousehold || busy) return;
    if (visibility === 'global' && !canPublishTrainGlobal({ level, goal, equipment })) {
      setError('Everyone publish requires level, goal, and equipment');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const share = normalizeTrainShare(visibility, personIds, buddyUserIds);
      await saveMyTrainPlan({
        householdId: activeHousehold.id,
        userId,
        name,
        visibility: share.visibility,
        level,
        goal,
        equipment,
        personIds: share.personIds,
        buddyUserIds: share.buddyUserIds,
        days: days
          .filter((day) => day.workoutId || day.label.trim())
          .map((day, index) => ({
            weekday: day.weekday,
            position: index,
            workoutId: day.workoutId,
            label: day.label.trim(),
          })),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save plan');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <TrainPage>
        <LoadingState label="Loading plan" />
      </TrainPage>
    );
  }

  return (
    <TrainPage>
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorBanner message={error} />
        <Field value={name} onChangeText={setName} placeholder="Plan name" title />
        <VisibilityPicker value={visibility} options={visibilityOptions} onChange={setVisibility} />
        {visibility === 'people' ? (
          <View style={styles.picks}>
            {people.map((person) => {
              const on = personIds.includes(person.id);
              return (
                <Choice
                  key={person.id}
                  label={person.name}
                  active={on}
                  onPress={() =>
                    setPersonIds((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]))
                  }
                />
              );
            })}
          </View>
        ) : null}
        {visibility === 'buddies_selected' ? (
          <View style={styles.picks}>
            {buddies.map((buddy) => {
              const on = buddyUserIds.includes(buddy.id);
              return (
                <Choice
                  key={buddy.id}
                  label={buddy.name}
                  active={on}
                  onPress={() =>
                    setBuddyUserIds((current) =>
                      on ? current.filter((id) => id !== buddy.id) : [...current, buddy.id],
                    )
                  }
                />
              );
            })}
          </View>
        ) : null}
        {visibility === 'global' ? (
          <View style={styles.tags}>
            <View style={styles.picks}>
              {TRAIN_GLOBAL_LEVELS.map((value) => (
                <Choice
                  key={value}
                  label={trainGlobalLevelLabel(value)}
                  active={level === value}
                  onPress={() => setLevel(value)}
                />
              ))}
            </View>
            <View style={styles.picks}>
              {TRAIN_GLOBAL_GOALS.map((value) => (
                <Choice
                  key={value}
                  label={trainGlobalGoalLabel(value)}
                  active={goal === value}
                  onPress={() => setGoal(value)}
                />
              ))}
            </View>
            <View style={styles.picks}>
              {TRAIN_GLOBAL_EQUIPMENT.map((value) => {
                const on = equipment.includes(value);
                return (
                  <Choice
                    key={value}
                    label={trainGlobalEquipmentLabel(value)}
                    active={on}
                    onPress={() =>
                      setEquipment((current) =>
                        on ? current.filter((item) => item !== value) : [...current, value],
                      )
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {together.length > 0 ? (
          <View style={styles.together}>
            <Text style={styles.togetherTitle}>Train together</Text>
            {together.map((row) => (
              <View key={row.id} style={styles.togetherRow}>
                <View style={styles.togetherCopy}>
                  <Text style={styles.dayWorkout}>{row.workoutName}</Text>
                  <Text style={styles.togetherMeta}>
                    {row.otherProfile.username || row.otherProfile.globalHandle}
                    {row.scheduledAt ? ` · ${new Date(row.scheduledAt).toLocaleString()}` : ''}
                  </Text>
                  <Pill label={row.status === 'pending' ? 'Pending' : 'Accepted'} />
                </View>
                <TextAction label="Open" onPress={() => router.push(`/train/${row.workoutId}` as Href)} />
              </View>
            ))}
          </View>
        ) : null}

        {days.map((day) => {
          const workout = workouts.find((item) => item.id === day.workoutId);
          return (
            <View key={day.weekday} style={styles.day}>
              <Text style={styles.dayLabel}>{WEEKDAYS[day.weekday]}</Text>
              <View style={styles.dayBody}>
                <Text style={styles.dayWorkout}>{workout?.name || day.label || 'Rest'}</Text>
                <TextAction
                  label={pickingDay === day.weekday ? 'Close' : 'Set'}
                  onPress={() => setPickingDay((current) => (current === day.weekday ? null : day.weekday))}
                />
              </View>
              {pickingDay === day.weekday ? (
                <View style={styles.picks}>
                  <Choice
                    label="Rest"
                    active={!day.workoutId}
                    onPress={() => {
                      setDays((current) =>
                        current.map((item) =>
                          item.weekday === day.weekday ? { ...item, workoutId: null, label: '' } : item,
                        ),
                      );
                      setPickingDay(null);
                    }}
                  />
                  {workouts.map((item) => (
                    <Choice
                      key={item.id}
                      label={item.name}
                      active={day.workoutId === item.id}
                      onPress={() => {
                        setDays((current) =>
                          current.map((entry) =>
                            entry.weekday === day.weekday
                              ? { ...entry, workoutId: item.id, label: item.name }
                              : entry,
                          ),
                        );
                        setPickingDay(null);
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <TrainButton label={busy ? 'Saving…' : 'Save plan'} onPress={() => void save()} disabled={busy} fill />
      </ScrollView>
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingBottom: space.lg },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tags: { gap: 8 },
  together: { gap: space.sm },
  togetherTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  togetherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  togetherCopy: { flex: 1, gap: 4 },
  togetherMeta: { color: colors.textDim, fontSize: 12 },
  day: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  dayLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  dayBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayWorkout: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
});
