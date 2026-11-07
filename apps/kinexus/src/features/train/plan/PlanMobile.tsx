import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LABELS, DAYS, mondayWeekStart } from '@kinexus/domain';

import { Pill, TextAction, TrainButton } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { weekRangeLabel } from '@/src/features/meals/week-labels';

import type { PlanDayCardModel } from '@/src/features/train/plan/types';
import type { TrainPlanViewProps } from '@/src/features/train/plan/PlanDesktop';

function DayCard({
  card,
  isToday,
  canManage,
  onStart,
  onMarkDone,
  onMarkSkipped,
  onUndo,
  onAddToCalendar,
  onExportIcs,
}: {
  card: PlanDayCardModel;
  isToday: boolean;
  canManage: boolean;
  onStart: () => void;
  onMarkDone: () => void;
  onMarkSkipped: () => void;
  onUndo: () => void;
  onAddToCalendar: () => void;
  onExportIcs: () => void;
}) {
  return (
    <View style={[styles.card, isToday && styles.cardToday]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardDay}>{DAY_LABELS[card.day]}</Text>
        {isToday ? <Pill label="Today" /> : null}
      </View>
      {card.restDay ? (
        <Text style={styles.cardRest}>Rest</Text>
      ) : (
        <>
          <Text style={styles.cardFocus}>{card.focus.join(' · ') || 'Train'}</Text>
          <Text style={styles.cardMeta}>
            {[
              card.scheduledTime?.slice(0, 5) ?? (card.usedDefaultTime ? '07:00*' : null),
              card.durationMin != null ? `${card.durationMin} min` : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </Text>
          {card.usedDefaultTime ? <Text style={styles.cardHint}>07:00 default</Text> : null}
          <Pill label={card.status === 'planned' ? 'Planned' : card.status === 'done' ? 'Done' : 'Skipped'} />
        </>
      )}
      {canManage && !card.restDay ? (
        <View style={styles.cardActions}>
          {card.status === 'planned' && card.workoutId ? (
            <TrainButton label="Start" onPress={onStart} fill />
          ) : null}
          {card.status === 'planned' ? (
            <View style={styles.rowActions}>
              <TextAction label="Done" onPress={onMarkDone} tone="accent" />
              <TextAction label="Skip" onPress={onMarkSkipped} />
            </View>
          ) : (
            <TextAction label="Undo" onPress={onUndo} />
          )}
          <View style={styles.rowActions}>
            <TextAction label="Calendar" onPress={onAddToCalendar} />
            <TextAction label=".ics" onPress={onExportIcs} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function PlanMobile(props: TrainPlanViewProps) {
  const insets = useSafeAreaInsets();
  const thisWeek = props.weekStart === mondayWeekStart();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.weekBar}>
        <Pressable onPress={props.onPrevWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{weekRangeLabel(props.weekStart)}</Text>
        <Pressable onPress={props.onNextWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>›</Text>
        </Pressable>
      </View>
      {!thisWeek ? <TextAction label="This week" onPress={props.onThisWeek} tone="accent" /> : null}

      <TrainButton label="Generate" onPress={props.onGenerate} fill />
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}

      {props.regenPreview ? (
        <View style={styles.regenBox}>
          <Text style={styles.regenTitle}>Regenerate remaining</Text>
          <Text style={styles.regenBody}>{props.regenPreview.summary}</Text>
          <TrainButton label={props.busy ? 'Saving…' : 'Confirm'} onPress={props.onConfirmRegen} disabled={props.busy} fill />
          <TextAction label="Cancel" onPress={props.onCancelRegen} />
        </View>
      ) : null}

      {props.rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No plan this week</Text>
          <TrainButton label="Generate week" onPress={props.onGenerate} fill />
        </View>
      ) : (
        props.rows.map((row) => (
          <View key={row.plan.id} style={styles.audience}>
            <Text style={styles.audienceName}>{row.label}</Text>
            {props.canManagePlan(row.plan) ? (
              <View style={styles.audienceActions}>
                <TextAction label="Duplicate to next week" onPress={() => props.onDuplicate(row.plan)} tone="accent" />
                <TextAction label="Regenerate remaining" onPress={() => props.onRegenerate(row.plan)} />
                <TextAction label="Add to calendar" onPress={() => props.onAddPlanToCalendar(row.plan)} />
                <TextAction label="Export .ics" onPress={() => props.onExportPlanIcs(row.plan)} />
                <TextAction
                  label={row.plan.calendarAutoSync ? 'Auto-sync on' : 'Auto-sync off'}
                  onPress={() => props.onToggleAutoSync(row.plan)}
                  tone={row.plan.calendarAutoSync ? 'accent' : undefined}
                />
              </View>
            ) : null}
            {DAYS.map((day) => {
              const card = row.cards.find((item) => item.day === day);
              if (!card) return null;
              return (
                <DayCard
                  key={card.id}
                  card={card}
                  isToday={props.today === day}
                  canManage={props.canManagePlan(row.plan)}
                  onStart={() => props.onStart(card)}
                  onMarkDone={() => props.onMarkDone(card)}
                  onMarkSkipped={() => props.onMarkSkipped(card)}
                  onUndo={() => props.onUndo(card)}
                  onAddToCalendar={() => props.onAddDayToCalendar(card)}
                  onExportIcs={() => props.onExportDayIcs(row.plan, card)}
                />
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: space.md, padding: space.md },
  weekBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  weekBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  weekBtnText: { color: colors.text, fontSize: 24, lineHeight: 26 },
  weekLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
  empty: { gap: space.md, paddingVertical: space.xl },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  audience: { gap: space.sm },
  audienceName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  audienceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  cardToday: { borderColor: colors.accent, borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 13 },
  cardHint: { color: colors.textMuted, fontSize: 12 },
  cardRest: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  cardActions: { gap: 8 },
  rowActions: { flexDirection: 'row', gap: 16 },
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
