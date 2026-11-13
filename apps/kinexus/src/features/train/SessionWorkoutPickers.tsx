import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  clusterExercises,
  estimateWorkout,
  TRAIN_SESSION_KINDS,
  TRAIN_SESSION_TYPES,
  type TrainSessionKind,
} from '@kinexus/domain';

import { colors, radius, space } from '@/src/features/shell/theme';
import type { InviteWorkoutOption } from '@/src/features/train/joint-sessions-api';
import { BodyMap } from '@/src/features/train/plan/BodyMap';

const SESSION_KIND_LABEL: Record<TrainSessionKind, string> = {
  strength: 'Strength',
  conditioning: 'Conditioning',
  recovery: 'Recovery',
  other: 'Other',
};

export const SESSION_TYPES_BY_KIND = TRAIN_SESSION_KINDS.map((kind) => ({
  kind,
  label: SESSION_KIND_LABEL[kind],
  rows: TRAIN_SESSION_TYPES.filter((row) => row.kind === kind),
})).filter((group) => group.rows.length > 0);

export function workoutPickerFocuses(workout: InviteWorkoutOption): string[] {
  return estimateWorkout(
    workout.exercises.map((exercise) => ({
      name: exercise.name,
      targetSets: exercise.targetSets,
      category: null,
    })),
  ).focuses;
}

export function SessionTypePickerList({
  selectedIds,
  onToggle,
}: {
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {SESSION_TYPES_BY_KIND.map((group) => (
        <View key={group.kind} style={styles.pickerSection}>
          <Text style={styles.pickerSectionLabel}>{group.label}</Text>
          <View style={styles.pickerSectionBody}>
            {group.rows.map((row, index) => {
              const on = selectedIds.includes(row.id);
              const last = index === group.rows.length - 1;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onToggle(row.id)}
                  style={({ pressed }) => [
                    styles.listRow,
                    last && styles.listRowLast,
                    on && styles.listRowOn,
                    pressed && styles.listRowPressed,
                  ]}>
                  <Text style={[styles.listRowLabel, on && styles.listRowLabelOn]}>{row.label}</Text>
                  {on ? <Text style={styles.listCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

export type WorkoutPickerRow = InviteWorkoutOption & {
  hidden?: boolean;
};

export function sortWorkoutPickerRows(rows: readonly WorkoutPickerRow[]): WorkoutPickerRow[] {
  return [...rows].sort((a, b) => {
    const aYours = a.origin === 'yours' ? 0 : 1;
    const bYours = b.origin === 'yours' ? 0 : 1;
    if (aYours !== bYours) return aYours - bYours;
    const aHidden = a.hidden ? 1 : 0;
    const bHidden = b.hidden ? 1 : 0;
    if (aHidden !== bHidden) return aHidden - bHidden;
    return a.name.localeCompare(b.name);
  });
}

export function WorkoutPickerList({
  workouts,
  selectedIds,
  selectionMode = 'multi',
  includeLabel = 'Include in invite',
  includedLabel = 'Included in invite',
  emptyLabel = 'No matching workouts',
  onToggle,
}: {
  workouts: readonly WorkoutPickerRow[];
  selectedIds: readonly string[];
  selectionMode?: 'multi' | 'single';
  includeLabel?: string;
  includedLabel?: string;
  emptyLabel?: string;
  onToggle: (id: string) => void;
}) {
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  const focusById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const workout of workouts) {
      map.set(workout.id, workoutPickerFocuses(workout));
    }
    return map;
  }, [workouts]);

  return (
    <>
      {workouts.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
      {workouts.map((workout) => {
        const on = selectedIds.includes(workout.id);
        const expanded = expandedWorkoutId === workout.id;
        const focuses = focusById.get(workout.id) ?? [];
        const focusLabel = focuses.slice(0, 3).join(' · ');
        const preview = workout.exercises
          .slice(0, 3)
          .map((exercise) => exercise.name)
          .join(' · ');
        const extra = Math.max(0, workout.exercises.length - 3);
        const originBits = [
          workout.origin === 'yours' ? 'Yours' : null,
          workout.hidden ? 'Hidden' : null,
        ].filter(Boolean);
        return (
          <View key={workout.id} style={[styles.workoutCard, on && styles.workoutCardOn]}>
            <View style={styles.workoutCardTop}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpandedWorkoutId(expanded ? null : workout.id)}
                style={({ pressed }) => [styles.workoutCardHit, pressed && styles.listRowPressed]}>
                <Text style={styles.workoutName} numberOfLines={1}>
                  {workout.name}
                </Text>
                <Text style={styles.workoutMeta}>
                  {originBits.length > 0 ? `${originBits.join(' · ')} · ` : ''}
                  {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'}
                  {focusLabel ? ` · ${focusLabel}` : ''}
                </Text>
                {!expanded && preview ? (
                  <Text style={styles.workoutPreview} numberOfLines={1}>
                    {preview}
                    {extra > 0 ? ` · +${extra}` : ''}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole={selectionMode === 'single' ? 'button' : 'checkbox'}
                accessibilityState={selectionMode === 'single' ? undefined : { checked: on }}
                accessibilityLabel={
                  selectionMode === 'single' ? `Pick ${workout.name}` : `Include ${workout.name}`
                }
                hitSlop={8}
                onPress={() => onToggle(workout.id)}
                style={({ pressed }) => [
                  styles.workoutCheck,
                  on && styles.workoutCheckOn,
                  pressed && styles.listRowPressed,
                ]}>
                {on ? <Text style={styles.workoutCheckMark}>✓</Text> : null}
              </Pressable>
            </View>
            {expanded ? (
              <View style={styles.workoutExpanded}>
                <View style={styles.workoutExpandedHero}>
                  <BodyMap muscleGroups={focuses} />
                  <View style={styles.workoutExpandedCopy}>
                    {focusLabel ? <Text style={styles.workoutFocus}>{focusLabel}</Text> : null}
                    <Pressable
                      accessibilityRole={selectionMode === 'single' ? 'button' : 'checkbox'}
                      accessibilityState={selectionMode === 'single' ? undefined : { checked: on }}
                      onPress={() => onToggle(workout.id)}
                      style={({ pressed }) => [
                        styles.workoutIncludeRow,
                        on && styles.workoutIncludeRowOn,
                        pressed && styles.listRowPressed,
                      ]}>
                      <View style={[styles.workoutCheck, on && styles.workoutCheckOn]}>
                        {on ? <Text style={styles.workoutCheckMark}>✓</Text> : null}
                      </View>
                      <Text style={styles.workoutIncludeLabel}>
                        {selectionMode === 'single'
                          ? 'Use this workout'
                          : on
                            ? includedLabel
                            : includeLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.workoutExerciseList}>
                  {clusterExercises(
                    workout.exercises.map((exercise) => ({
                      ...exercise,
                      supersetId: exercise.supersetId ?? null,
                    })),
                  ).map((cluster, clusterIndex) => {
                    const rows = cluster.indices.map((index) => {
                      const exercise = workout.exercises[index]!;
                      return (
                        <View
                          key={`${workout.id}-${exercise.name}-${index}`}
                          style={[
                            styles.workoutExerciseRow,
                            cluster.type === 'single' && styles.workoutExerciseRowBordered,
                          ]}>
                          <Text style={styles.workoutExerciseIndex}>{index + 1}</Text>
                          <Text style={styles.workoutExerciseName} numberOfLines={2}>
                            {exercise.name}
                          </Text>
                          <Text style={styles.workoutExerciseSets}>{exercise.targetSets} sets</Text>
                        </View>
                      );
                    });
                    if (cluster.type === 'superset') {
                      return (
                        <View key={`${workout.id}-ss-${clusterIndex}`} style={styles.workoutSuperset}>
                          <Text style={styles.workoutSupersetLabel}>Superset</Text>
                          {rows}
                        </View>
                      );
                    }
                    return <View key={`${workout.id}-solo-${clusterIndex}`}>{rows}</View>;
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

/** Shared styles also used by picker sheet chrome in parent modals. */
export const sessionWorkoutPickerStyles = StyleSheet.create({
  pickerList: { gap: space.md, paddingBottom: space.lg },
  pickerSection: { gap: 8 },
  pickerSectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pickerSectionBody: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listRowLast: { borderBottomWidth: 0 },
  listRowOn: { backgroundColor: colors.accentSoft },
  listRowPressed: { opacity: 0.88 },
  listRowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  listRowLabelOn: { color: colors.text },
  listCheck: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  workoutCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  workoutCardOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  workoutCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  workoutCardHit: { flex: 1, gap: 4, minWidth: 0 },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  workoutMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  workoutPreview: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
  workoutCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  workoutCheckOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  workoutCheckMark: { color: colors.bg, fontSize: 14, fontWeight: '800', lineHeight: 16 },
  workoutExpanded: { gap: 12, paddingTop: 2 },
  workoutExpandedHero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workoutExpandedCopy: { flex: 1, gap: 8, minWidth: 0 },
  workoutFocus: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  workoutIncludeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
  },
  workoutIncludeRowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  workoutIncludeLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  workoutExerciseList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  workoutSuperset: {
    gap: 0,
    margin: 6,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingTop: 4,
    paddingBottom: 2,
  },
  workoutSupersetLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  workoutExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  workoutExerciseRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  workoutExerciseIndex: {
    width: 18,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  workoutExerciseName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  workoutExerciseSets: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});

const styles = sessionWorkoutPickerStyles;
