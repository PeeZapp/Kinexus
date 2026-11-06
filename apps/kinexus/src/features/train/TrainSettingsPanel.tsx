import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  allowedFamilyPlanShares,
  resolveDefaultWorkoutVisibility,
  trainVisibilityOptions,
  type FamilyPlanShare,
  type TrainVisibility,
} from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import { loadTrainPrefs, saveTrainPrefs } from '@/src/features/train/api';
import { Segmented, VisibilityPicker } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FAMILY_LABELS: Record<FamilyPlanShare, string> = {
  off: 'Off',
  plan: 'Plan only',
  plan_activity: 'Plan + activity',
};

export function TrainSettingsPanel() {
  const { user } = useAuth();
  const { role } = useHousehold();
  const creator = useCreator();
  const userId = user && !user.isDevBypass ? user.id : null;
  const [defaultVisibility, setDefaultVisibility] = useState<TrainVisibility>('private');
  const [familyShare, setFamilyShare] = useState<FamilyPlanShare>('off');
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
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load Train settings');
      });
    return () => {
      cancelled = true;
    };
  }, [creator.isApprovedCreator, userId]);

  if (!userId) return null;

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
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
});
