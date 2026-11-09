import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DAYS,
  DAY_LABELS,
  REMIX_DURATIONS,
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  allowedFamilyPlanShares,
  resolveDefaultWorkoutVisibility,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
  trainVisibilityOptions,
  type Day,
  type FamilyPlanShare,
  type TrainGlobalGoal,
  type TrainGlobalLevel,
  type TrainVisibility,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { useCreator } from '@/src/features/creators/use-creator';
import { loadTrainPrefs, saveTrainPrefs } from '@/src/features/train/api';
import {
  DEFAULT_TRAIN_GENERATE_PREFS,
  TRAIN_SPLIT_STYLE_OPTIONS,
  parseGeneratePrefs,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';
import { Segmented, VisibilityPicker } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FAMILY_LABELS: Record<FamilyPlanShare, string> = {
  off: 'Off',
  plan: 'Plan only',
  plan_activity: 'Plan + activity',
};

const PROFILE_EQUIPMENT = ['bodyweight', 'dumbbells', 'barbell', 'cable', 'machines', 'bands'] as const;
const PROFILE_LENGTHS = REMIX_DURATIONS.filter((value) => value === 30 || value === 40 || value === 50 || value === 60);

export function TrainSettingsPanel() {
  const { user } = useAuth();
  const { role } = useHousehold();
  const creator = useCreator();
  const userId = user && !user.isDevBypass ? user.id : null;
  const [defaultVisibility, setDefaultVisibility] = useState<TrainVisibility>('private');
  const [familyShare, setFamilyShare] = useState<FamilyPlanShare>('off');
  const [profile, setProfile] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [error, setError] = useState<string | null>(null);

  const visibilityOptions = useMemo(
    () => trainVisibilityOptions({ isApprovedCreator: creator.isApprovedCreator, current: defaultVisibility }),
    [creator.isApprovedCreator, defaultVisibility],
  );
  const familyOptions = useMemo(
    () =>
      allowedFamilyPlanShares(role).map((value) => ({
        value,
        label: FAMILY_LABELS[value],
      })),
    [role],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadTrainPrefs(userId)
      .then((prefs) => {
        if (cancelled) return;
        setDefaultVisibility(
          resolveDefaultWorkoutVisibility({
            preferred: prefs.defaultWorkoutVisibility,
            isApprovedCreator: creator.isApprovedCreator,
          }),
        );
        setFamilyShare(prefs.familyPlanShare);
        setProfile(parseGeneratePrefs(prefs.generatePrefs));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load Train settings');
      });
    return () => {
      cancelled = true;
    };
  }, [creator.isApprovedCreator, userId]);

  function patchProfile(patch: Partial<TrainGeneratePrefs>) {
    if (!userId) return;
    setError(null);
    setProfile((current) => {
      const next = { ...current, ...patch };
      void saveTrainPrefs(userId, { generatePrefs: next as unknown as Record<string, unknown> }).catch(
        (err: unknown) => {
          setError(err instanceof Error ? err.message : 'Could not save train profile');
        },
      );
      return next;
    });
  }

  if (!userId) return null;

  const selectedDays = new Set(profile.days);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Train settings</Text>
      <Text style={styles.label}>New workouts</Text>
      <VisibilityPicker
        value={defaultVisibility}
        options={visibilityOptions}
        onChange={(next) => {
          setError(null);
          setDefaultVisibility(next);
          void saveTrainPrefs(userId, { defaultWorkoutVisibility: next }).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not save default');
          });
        }}
      />
      <Text style={styles.label}>Share my training plan with family</Text>
      <Segmented
        value={familyShare}
        options={familyOptions}
        onChange={(next) => {
          setError(null);
          setFamilyShare(next);
          void saveTrainPrefs(userId, { familyPlanShare: next }).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not save family sharing');
          });
        }}
      />

      <Text style={styles.heading}>Train profile</Text>
      <Text style={styles.hint}>Optional defaults for Generate</Text>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.row}>
        {TRAIN_GLOBAL_GOALS.map((goal: TrainGlobalGoal) => (
          <Chip
            key={goal}
            label={trainGlobalGoalLabel(goal)}
            active={profile.goal === goal}
            onPress={() => patchProfile({ goal })}
          />
        ))}
      </View>

      <Text style={styles.label}>Level</Text>
      <View style={styles.row}>
        {TRAIN_GLOBAL_LEVELS.map((level: TrainGlobalLevel) => (
          <Chip
            key={level}
            label={trainGlobalLevelLabel(level)}
            active={profile.level === level}
            onPress={() => patchProfile({ level })}
          />
        ))}
      </View>

      <Text style={styles.label}>Preferred days</Text>
      <View style={styles.row}>
        {DAYS.map((day: Day) => {
          const active = selectedDays.has(day);
          return (
            <Chip
              key={day}
              label={DAY_LABELS[day].slice(0, 3)}
              active={active}
              onPress={() => {
                const next = new Set(profile.days);
                if (active) {
                  if (next.size <= 1) return;
                  next.delete(day);
                } else next.add(day);
                const days = DAYS.filter((item) => next.has(item));
                patchProfile({ days, daysPerWeek: days.length });
              }}
            />
          );
        })}
      </View>

      <Text style={styles.label}>Split</Text>
      <View style={styles.row}>
        {TRAIN_SPLIT_STYLE_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            active={profile.splitStyle === option.id}
            onPress={() => patchProfile({ splitStyle: option.id })}
          />
        ))}
      </View>

      <Text style={styles.label}>Session length</Text>
      <View style={styles.row}>
        {PROFILE_LENGTHS.map((value) => (
          <Chip
            key={value}
            label={`${value}m`}
            active={profile.durationMin === value}
            onPress={() => patchProfile({ durationMin: value })}
          />
        ))}
      </View>

      <Text style={styles.label}>Equipment</Text>
      <View style={styles.row}>
        {PROFILE_EQUIPMENT.map((item) => {
          const active = profile.equipment.includes(item);
          return (
            <Chip
              key={item}
              label={item}
              active={active}
              onPress={() =>
                patchProfile({
                  equipment: active
                    ? profile.equipment.filter((value) => value !== item)
                    : [...profile.equipment, item],
                })
              }
            />
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: space.md,
  },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: space.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: -4 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: { color: colors.danger, fontSize: 13 },
});
