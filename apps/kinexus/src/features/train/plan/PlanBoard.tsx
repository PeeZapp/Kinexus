import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAYS, mondayWeekStart, trainingPlanDayVisibility } from '@kinexus/domain';

import { DayStrip, WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { AddWorkoutModal, type AddWorkoutChoice } from '@/src/features/train/plan/AddWorkoutModal';
import { BodyMap } from '@/src/features/train/plan/BodyMap';
import { PlanVisibilityBar } from '@/src/features/train/plan/PlanVisibilityBar';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import type { TrainPlanViewProps } from '@/src/features/train/plan/PlanDesktop';
import { TextAction, TrainButton } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

function PlannedWorkoutCard({
  card,
  canManage,
  sharedWithMe,
  onStart,
  onViewWorkout,
  onMarkDone,
  onRemoveWorkout,
  onTrainTogether,
  onUndo,
}: {
  card: PlanDayCardModel;
  canManage: boolean;
  sharedWithMe: boolean;
  onStart: () => void;
  onViewWorkout: () => void;
  onMarkDone: () => void;
  onRemoveWorkout: () => void;
  onTrainTogether: () => void;
  onUndo: () => void;
}) {
  const title = card.workoutName || card.focus.join(' · ') || 'Workout';
  const meta = [
    card.durationMin != null ? `${card.durationMin} min` : null,
    card.scheduledTime?.slice(0, 5) ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  const muscles = card.muscleGroups.slice(0, 4).join(' · ');
  const listedExercises = card.exerciseNames.slice(0, 5);
  const extraExercises = Math.max(0, card.exerciseNames.length - listedExercises.length);

  return (
    <View style={styles.slot}>
      {canManage && card.status === 'planned' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove workout"
          onPress={onRemoveWorkout}
          hitSlop={10}
          style={styles.removeBtn}>
          <Text style={styles.removeIcon}>×</Text>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={onViewWorkout} style={styles.slotBody}>
        <BodyMap muscleGroups={card.muscleGroups} />
        <View style={styles.slotCopy}>
          <Text style={styles.slotTitle} numberOfLines={1}>
            {title}
          </Text>
          {meta ? <Text style={styles.slotMeta}>{meta}</Text> : null}
          {muscles ? <Text style={styles.slotMuscles} numberOfLines={1}>{muscles}</Text> : null}
          {listedExercises.length > 0 ? (
            <View style={styles.exerciseList}>
              {listedExercises.map((name, index) => (
                <View key={`${index}-${name}`} style={styles.exerciseRow}>
                  <Text style={styles.exerciseDot}>•</Text>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
              {extraExercises > 0 ? (
                <Text style={styles.exerciseMore}>+{extraExercises} more</Text>
              ) : null}
            </View>
          ) : null}
          {card.status !== 'planned' ? (
            <Text style={styles.slotStatus}>{card.status === 'done' ? 'Done' : 'Skipped'}</Text>
          ) : null}
        </View>
      </Pressable>

      {canManage ? (
        <View style={styles.slotActions}>
          {card.status === 'planned' ? (
            <View style={styles.equalRow}>
              <TrainButton label="Start" onPress={onStart} fill compact />
              <TrainButton label="Done" onPress={onMarkDone} tone="ghost" fill compact />
            </View>
          ) : (
            <TextAction label="Undo" onPress={onUndo} />
          )}
        </View>
      ) : null}

      {sharedWithMe && card.workoutId ? (
        <TrainButton label="Train together" onPress={onTrainTogether} fill compact />
      ) : null}
    </View>
  );
}

export function PlanBoard(props: TrainPlanViewProps & { compact?: boolean }) {
  const [addOpen, setAddOpen] = useState(false);
  const thisWeek = props.weekStart === mondayWeekStart();
  const today = thisWeek ? todayDay() : null;
  const dateNums = new Map(DAYS.map((day) => [day, isoDayNumber(weekDayIso(props.weekStart, day))] as const));
  const owned = props.ownedRows[0] ?? null;
  const manage = owned ? props.canManagePlan(owned.plan) : false;
  const canAdd = !props.busy && (manage || !owned);
  const dayCards = (owned?.cards ?? []).filter((card) => card.day === props.selectedDay);
  const plannedWorkouts = dayCards.filter((card) => !card.restDay && card.workoutId);
  const dayShare = owned ? trainingPlanDayVisibility(owned.plan, props.selectedDay) : null;
  const fillable = Boolean(
    owned?.cards.some(
      (card) => !card.restDay && card.status === 'planned' && !card.workoutId && card.focus.length > 0,
    ),
  );

  function chooseAdd(choice: AddWorkoutChoice) {
    setAddOpen(false);
    if (choice === 'start') props.onStartBlankDay(props.selectedDay);
    else if (choice === 'pick') props.onPickForDay(props.selectedDay);
    else props.onBuildForDay(props.selectedDay);
  }

  return (
    <View style={styles.root}>
      {!props.compact ? (
        <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />
      ) : null}
      {!thisWeek ? <TextAction label="This week" onPress={props.onThisWeek} tone="accent" /> : null}
      <DayStrip
        days={DAYS}
        selected={props.selectedDay}
        today={today}
        dateNums={dateNums}
        onSelect={props.onSelectDay}
      />

      <View style={styles.actions}>
        <TrainButton label="Generate" onPress={props.onGenerate} fill />
        {owned && manage ? (
          <TextAction label="Clear week" onPress={() => props.onClearWeek(owned.plan)} />
        ) : null}
      </View>

      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}

      {props.regenPreview ? (
        <View style={styles.regenBox}>
          <Text style={styles.regenTitle}>Regenerate remaining</Text>
          <Text style={styles.regenBody}>{props.regenPreview.summary}</Text>
          <TrainButton
            label={props.busy ? 'Saving…' : 'Confirm'}
            onPress={props.onConfirmRegen}
            disabled={props.busy}
            fill
          />
          <TextAction label="Cancel" onPress={props.onCancelRegen} />
        </View>
      ) : null}

      {owned && manage && dayShare ? (
        <View style={styles.planChrome}>
          <PlanVisibilityBar
            visibility={dayShare.visibility}
            buddyUserIds={dayShare.buddyUserIds}
            buddies={props.buddies}
            isApprovedCreator={props.isApprovedCreator}
            editable={!props.busy}
            onChangeVisibility={(next) =>
              props.onChangeVisibility(owned.plan, props.selectedDay, next)
            }
            onToggleBuddy={(buddyId) => props.onToggleBuddy(owned.plan, props.selectedDay, buddyId)}
            onShare={() => props.onShareLink(owned.plan)}
          />
          <View style={styles.chromeActions}>
            {fillable ? (
              <TextAction
                label="Fill remaining"
                onPress={() => props.onFillRemaining(owned.plan)}
                tone="accent"
              />
            ) : null}
            <TextAction label="Duplicate week" onPress={() => props.onDuplicate(owned.plan)} />
          </View>
        </View>
      ) : null}

      <View style={styles.dayBoard}>
        <Text style={styles.dayHeading}>Planned workouts</Text>
        <View style={[styles.slotGrid, props.compact && styles.slotStack]}>
          {plannedWorkouts.map((card) => (
            <PlannedWorkoutCard
              key={card.id}
              card={card}
              canManage={manage}
              sharedWithMe={Boolean(owned?.sharedWithMe)}
              onStart={() => props.onStart(card)}
              onViewWorkout={() => props.onViewWorkout(card)}
              onMarkDone={() => props.onMarkDone(card)}
              onRemoveWorkout={() => props.onRemoveWorkout(card)}
              onTrainTogether={() => owned && props.onTrainTogether(owned.plan, card)}
              onUndo={() => props.onUndo(card)}
            />
          ))}
          {canAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add workout"
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [styles.addTile, pressed && styles.addTilePressed]}
              disabled={props.busy}>
              <Text style={styles.addTileLabel}>+</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <AddWorkoutModal visible={addOpen} onClose={() => setAddOpen(false)} onChoose={chooseAdd} />

      {props.sharedRows.map((row: PlanAudienceRow) => {
        const sharedCards = row.cards.filter(
          (card) => card.day === props.selectedDay && !card.restDay && card.workoutId,
        );
        if (sharedCards.length === 0) return null;
        return (
          <View key={row.plan.id} style={styles.sharedBlock}>
            <Text style={styles.sharedTitle}>{row.label}</Text>
            <View style={[styles.slotGrid, props.compact && styles.slotStack]}>
              {sharedCards.map((card) => (
                <PlannedWorkoutCard
                  key={card.id}
                  card={card}
                  canManage={false}
                  sharedWithMe
                  onStart={() => undefined}
                  onViewWorkout={() => props.onViewWorkout(card)}
                  onMarkDone={() => undefined}
                  onRemoveWorkout={() => undefined}
                  onTrainTogether={() => props.onTrainTogether(row.plan, card)}
                  onUndo={() => undefined}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  equalRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  error: { color: colors.danger, fontSize: 13 },
  dayBoard: { gap: space.sm },
  dayHeading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  planChrome: { gap: 8, zIndex: 20, overflow: 'visible' },
  chromeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'flex-start' },
  slotStack: { flexDirection: 'column' },
  slot: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    position: 'relative',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  removeIcon: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -1,
  },
  slotBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 24,
  },
  slotCopy: { flex: 1, gap: 2, minWidth: 0 },
  slotTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  slotMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  slotMuscles: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  exerciseList: { gap: 1, marginTop: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  exerciseDot: { color: colors.textDim, fontSize: 12, lineHeight: 16, width: 8 },
  exerciseName: { color: colors.textDim, fontSize: 12, lineHeight: 16, flex: 1 },
  exerciseMore: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2, marginLeft: 14 },
  slotStatus: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  slotActions: { gap: 0 },
  addTile: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 72,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  addTilePressed: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  addTileLabel: { color: colors.accent, fontSize: 28, fontWeight: '300', lineHeight: 32 },
  sharedBlock: { gap: space.sm },
  sharedTitle: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  regenBox: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  regenTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  regenBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
