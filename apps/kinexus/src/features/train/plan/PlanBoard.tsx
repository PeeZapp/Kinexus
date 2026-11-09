import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, DAYS, mondayWeekStart, type Day } from '@kinexus/domain';

import { DayStrip, WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { PlanVisibilityBar } from '@/src/features/train/plan/PlanVisibilityBar';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import type { TrainPlanViewProps } from '@/src/features/train/plan/PlanDesktop';
import { Pill, TextAction, TrainButton } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

function SessionCard({
  card,
  canManage,
  sharedWithMe,
  onStart,
  onOpenWorkoutMenu,
  onTrainTogether,
  onMarkDone,
  onMarkSkipped,
  onUndo,
}: {
  card: PlanDayCardModel;
  canManage: boolean;
  sharedWithMe: boolean;
  onStart: () => void;
  onOpenWorkoutMenu: () => void;
  onTrainTogether: () => void;
  onMarkDone: () => void;
  onMarkSkipped: () => void;
  onUndo: () => void;
}) {
  if (card.restDay) {
    return (
      <View style={styles.slot}>
        <Text style={styles.slotTitle}>Rest</Text>
        {canManage && card.status === 'planned' ? (
          <TextAction label="Set type" onPress={onOpenWorkoutMenu} tone="accent" />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.slot}>
      <View style={styles.slotTop}>
        <Text style={styles.slotTitle}>{card.focus.join(' · ') || 'Train'}</Text>
        <Pill label={card.status === 'planned' ? 'Planned' : card.status === 'done' ? 'Done' : 'Skipped'} />
      </View>
      <Text style={styles.slotMeta}>
        {[
          card.scheduledTime?.slice(0, 5) ?? null,
          card.durationMin != null ? `${card.durationMin} min` : null,
          card.workoutName ?? (card.workoutId ? 'Workout ready' : 'No workout yet'),
        ]
          .filter(Boolean)
          .join(' · ') || '—'}
      </Text>
      {canManage ? (
        <View style={styles.slotActions}>
          {card.status === 'planned' ? (
            <>
              <TrainButton label="Start" onPress={onStart} fill />
              <View style={styles.rowActions}>
                <TextAction label="Workout" onPress={onOpenWorkoutMenu} />
                <TextAction label="Done" onPress={onMarkDone} tone="accent" />
                <TextAction label="Skip" onPress={onMarkSkipped} />
              </View>
            </>
          ) : (
            <TextAction label="Undo" onPress={onUndo} />
          )}
        </View>
      ) : null}
      {sharedWithMe && card.workoutId ? (
        <TrainButton label="Train together" onPress={onTrainTogether} fill />
      ) : null}
    </View>
  );
}

export function PlanBoard(props: TrainPlanViewProps & { compact?: boolean }) {
  const thisWeek = props.weekStart === mondayWeekStart();
  const today = thisWeek ? todayDay() : null;
  const dateNums = new Map(DAYS.map((day) => [day, isoDayNumber(weekDayIso(props.weekStart, day))] as const));
  const owned = props.ownedRows[0] ?? null;
  const manage = owned ? props.canManagePlan(owned.plan) : false;
  const dayCards = (owned?.cards ?? []).filter((card) => card.day === props.selectedDay);
  const dayLabel =
    thisWeek && props.selectedDay === today ? 'Today' : DAY_LABELS[props.selectedDay];
  const fillable = Boolean(
    owned?.cards.some(
      (card) => !card.restDay && card.status === 'planned' && !card.workoutId && card.focus.length > 0,
    ),
  );

  return (
    <View style={styles.root}>
      <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />
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
        <TextAction
          label={owned ? 'Replace with blank' : 'Blank week'}
          onPress={props.onBlankWeek}
          tone="accent"
        />
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

      {!owned && props.sharedRows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No plan this week</Text>
          <TrainButton label="Generate week" onPress={props.onGenerate} fill />
          <TextAction label="Start blank week" onPress={props.onBlankWeek} tone="accent" />
        </View>
      ) : null}

      {owned ? (
        <View style={styles.dayBoard}>
          <Text style={styles.dayHeading}>{dayLabel}</Text>
          {manage ? (
            <View style={styles.planChrome}>
              <PlanVisibilityBar
                visibility={owned.plan.visibility}
                buddyUserIds={owned.plan.buddyUserIds}
                buddies={props.buddies}
                isApprovedCreator={props.isApprovedCreator}
                editable={!props.busy}
                onChangeVisibility={(next) => props.onChangeVisibility(owned.plan, next)}
                onToggleBuddy={(buddyId) => props.onToggleBuddy(owned.plan, buddyId)}
              />
              <View style={styles.chromeActions}>
                <TextAction label="Share" onPress={() => props.onShareLink(owned.plan)} tone="accent" />
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

          <View style={[styles.slotGrid, props.compact && styles.slotStack]}>
            {dayCards.map((card) => (
              <SessionCard
                key={card.id}
                card={card}
                canManage={manage}
                sharedWithMe={owned.sharedWithMe}
                onStart={() => props.onStart(card)}
                onOpenWorkoutMenu={() => props.onOpenWorkoutMenu(card)}
                onTrainTogether={() => props.onTrainTogether(owned.plan, card)}
                onMarkDone={() => props.onMarkDone(card)}
                onMarkSkipped={() => props.onMarkSkipped(card)}
                onUndo={() => props.onUndo(card)}
              />
            ))}
            {manage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => props.onAddToDay(owned.plan, props.selectedDay)}
                style={styles.addTile}
                disabled={props.busy}>
                <Text style={styles.addTileLabel}>Add to {DAY_LABELS[props.selectedDay].slice(0, 3)}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {props.sharedRows.map((row: PlanAudienceRow) => {
        const sharedCards = row.cards.filter((card) => card.day === props.selectedDay);
        if (sharedCards.length === 0) return null;
        return (
          <View key={row.plan.id} style={styles.sharedBlock}>
            <Text style={styles.sharedTitle}>{row.label}</Text>
            <View style={[styles.slotGrid, props.compact && styles.slotStack]}>
              {sharedCards.map((card) => (
                <SessionCard
                  key={card.id}
                  card={card}
                  canManage={false}
                  sharedWithMe
                  onStart={() => undefined}
                  onOpenWorkoutMenu={() => undefined}
                  onTrainTogether={() => props.onTrainTogether(row.plan, card)}
                  onMarkDone={() => undefined}
                  onMarkSkipped={() => undefined}
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
  error: { color: colors.danger, fontSize: 13 },
  empty: { gap: space.md, paddingVertical: space.lg },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  dayBoard: { gap: space.md },
  dayHeading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  planChrome: { gap: 8 },
  chromeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slotStack: { flexDirection: 'column' },
  slot: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  slotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  slotTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  slotMeta: { color: colors.textDim, fontSize: 13 },
  slotActions: { gap: 8 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  addTile: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    minHeight: 96,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  addTileLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
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
