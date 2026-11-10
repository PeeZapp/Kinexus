import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, DAYS, type Day } from '@kinexus/domain';

import type { PreviewDay } from '@/src/features/train/generate/types';
import { colors, radius, space } from '@/src/features/shell/theme';
import { TextAction, TrainButton } from '@/src/features/train/ui';

export type GeneratePreviewWorkoutRef = {
  id: string;
  name: string;
  durationMin: number | null;
  exerciseCount: number;
};

export function dayIsFilled(row: PreviewDay): boolean {
  return !row.restDay && (row.exercises.length > 0 || Boolean(row.workoutId));
}

export function previewWorkoutLabel(
  row: PreviewDay,
  workouts: readonly GeneratePreviewWorkoutRef[],
): { name: string; summary: string } | null {
  if (!dayIsFilled(row)) return null;
  if (row.workoutId) {
    const saved = workouts.find((item) => item.id === row.workoutId);
    const count = row.exercises.length > 0 ? row.exercises.length : (saved?.exerciseCount ?? 0);
    const minutes = row.durationMin || saved?.durationMin || 0;
    return {
      name: row.workoutName?.trim() || saved?.name || 'Saved workout',
      summary: `${count} exercise${count === 1 ? '' : 's'} · ~${minutes || '—'} min`,
    };
  }
  const count = row.exercises.length;
  const minutes = row.durationMin || 0;
  return {
    name: row.workoutName?.trim() || row.focus[0] || 'Workout',
    summary: `${count} exercise${count === 1 ? '' : 's'} · ~${minutes || '—'} min`,
  };
}

export function GeneratePreviewDays({
  preview,
  workouts,
  onViewDay,
  onOpenDayMenu,
  cardWidth,
}: {
  preview: PreviewDay[];
  workouts: readonly GeneratePreviewWorkoutRef[];
  onViewDay: (day: Day) => void;
  onOpenDayMenu: (day: Day) => void;
  cardWidth?: `${number}%` | number;
}) {
  return (
    <View style={[styles.grid, cardWidth ? styles.gridWrap : null]}>
      {DAYS.map((day) => {
        const row = preview.find((item) => item.day === day);
        if (!row) return null;
        const filled = dayIsFilled(row);
        const label = previewWorkoutLabel(row, workouts);
        return (
          <View key={day} style={[styles.card, cardWidth ? { width: cardWidth } : null]}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadText}>
                <Text style={styles.cardDay}>{DAY_LABELS[day].slice(0, 3)}</Text>
                <Text style={styles.cardFocus}>{row.restDay ? 'Rest' : row.focus[0] ?? 'Train'}</Text>
              </View>
              {!row.restDay ? <TextAction label="⋯" onPress={() => onOpenDayMenu(day)} /> : null}
            </View>
            {filled && label ? (
              <Pressable accessibilityRole="button" onPress={() => onViewDay(day)} hitSlop={6}>
                <Text style={styles.cardWorkout} numberOfLines={1}>
                  {label.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {label.summary}
                </Text>
              </Pressable>
            ) : !row.restDay ? (
              <Text style={styles.cardMeta}>Intent only</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function GeneratePreviewApply({
  applying,
  onApply,
}: {
  applying: boolean;
  onApply: () => void;
}) {
  return <TrainButton label={applying ? 'Saving…' : 'Apply plan'} onPress={onApply} disabled={applying} fill />;
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    padding: space.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardHeadText: { flex: 1, gap: 2 },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardWorkout: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  cardMeta: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
});
