import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  trainGlobalEquipmentLabel,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
  type TrainGlobalEquipment,
  type TrainGlobalGoal,
  type TrainGlobalLevel,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { loadTrainPrefs, saveTrainPrefs } from '@/src/features/train/api';
import {
  DEFAULT_TRAIN_GENERATE_PREFS,
  parseGeneratePrefs,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';
import { Segmented } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

const PROFILE_EQUIPMENT = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'cable',
  'machines',
  'bands',
] as const satisfies readonly TrainGlobalEquipment[];

function OptionTile({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && styles.tilePressed]}>
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TrainSettingsPanel() {
  const { user } = useAuth();
  const { mode } = useExperienceMode();
  const mobile = mode === 'mobile';
  const userId = user && !user.isDevBypass ? user.id : null;
  const [profile, setProfile] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadTrainPrefs(userId)
      .then((prefs) => {
        if (cancelled) return;
        setProfile(parseGeneratePrefs(prefs.generatePrefs));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load Train settings');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  function toggleEquipment(item: (typeof PROFILE_EQUIPMENT)[number]) {
    const active = profile.equipment.includes(item);
    patchProfile({
      equipment: active
        ? profile.equipment.filter((value) => value !== item)
        : [...profile.equipment, item],
    });
  }

  if (!userId) return null;

  if (mobile) {
    return (
      <View style={[styles.card, styles.cardMobile]}>
        <Text style={styles.heading}>Training profile</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Goal</Text>
          <View style={styles.grid}>
            {TRAIN_GLOBAL_GOALS.map((goal: TrainGlobalGoal) => (
              <OptionTile
                key={goal}
                label={trainGlobalGoalLabel(goal)}
                active={profile.goal === goal}
                onPress={() => patchProfile({ goal })}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Experience</Text>
          <Segmented
            value={profile.level}
            options={TRAIN_GLOBAL_LEVELS.map((level: TrainGlobalLevel) => ({
              value: level,
              label: trainGlobalLevelLabel(level),
            }))}
            onChange={(level) => patchProfile({ level })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Equipment</Text>
          <View style={styles.grid}>
            {PROFILE_EQUIPMENT.map((item) => (
              <OptionTile
                key={item}
                label={trainGlobalEquipmentLabel(item)}
                active={profile.equipment.includes(item)}
                onPress={() => toggleEquipment(item)}
              />
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Training profile</Text>

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

      <Text style={styles.label}>Experience</Text>
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

      <Text style={styles.label}>Equipment</Text>
      <View style={styles.row}>
        {PROFILE_EQUIPMENT.map((item) => (
          <Chip
            key={item}
            label={trainGlobalEquipmentLabel(item)}
            active={profile.equipment.includes(item)}
            onPress={() => toggleEquipment(item)}
          />
        ))}
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
  cardMobile: { gap: space.md },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  section: { gap: 8 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tileActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tilePressed: { opacity: 0.82 },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileLabelActive: { color: colors.accent },
  error: { color: colors.danger, fontSize: 13 },
});
