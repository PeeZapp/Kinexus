import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, DAYS, mondayWeekStart, type Day } from '@kinexus/domain';

import type { TrainingPlanWeekRow } from '@/src/features/train/api';
import { Pill, TextAction, TrainButton } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { weekRangeLabel } from '@/src/features/meals/week-labels';

import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';

export type TrainPlanViewProps = {
  weekStart: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  rows: PlanAudienceRow[];
  today: Day | null;
  busy: boolean;
  error: string | null;
  regenPreview: { planId: string; summary: string } | null;
  onGenerate: () => void;
  onDuplicate: (plan: TrainingPlanWeekRow) => void;
  onRegenerate: (plan: TrainingPlanWeekRow) => void;
  onConfirmRegen: () => void;
  onCancelRegen: () => void;
  onStart: (card: PlanDayCardModel) => void;
  onMarkDone: (card: PlanDayCardModel) => void;
  onMarkSkipped: (card: PlanDayCardModel) => void;
  onUndo: (card: PlanDayCardModel) => void;
  onAddPlanToCalendar: (plan: TrainingPlanWeekRow) => void;
  onAddDayToCalendar: (card: PlanDayCardModel) => void;
  onExportPlanIcs: (plan: TrainingPlanWeekRow) => void;
  onExportDayIcs: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void;
  onToggleAutoSync: (plan: TrainingPlanWeekRow) => void;
  canManagePlan: (plan: TrainingPlanWeekRow) => boolean;
};

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
    <View style={[styles.card, isToday && styles.cardToday, card.restDay && styles.cardRest]}>
      <Text style={styles.cardDay}>{DAY_LABELS[card.day].slice(0, 3)}</Text>
      {card.restDay ? (
        <Text style={styles.cardRestLabel}>Rest</Text>
      ) : (
        <>
          <Text style={styles.cardFocus} numberOfLines={2}>
            {card.focus[0] ?? 'Train'}
          </Text>
          <Text style={styles.cardMeta}>
            {[
              card.scheduledTime?.slice(0, 5) ?? (card.usedDefaultTime ? '07:00*' : null),
              card.durationMin != null ? `${card.durationMin}m` : null,
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
            <TrainButton label="Start" onPress={onStart} />
          ) : null}
          {card.status === 'planned' ? (
            <>
              <TextAction label="Done" onPress={onMarkDone} tone="accent" />
              <TextAction label="Skip" onPress={onMarkSkipped} />
            </>
          ) : (
            <TextAction label="Undo" onPress={onUndo} />
          )}
          <TextAction label="Calendar" onPress={onAddToCalendar} />
          <TextAction label=".ics" onPress={onExportIcs} />
        </View>
      ) : null}
    </View>
  );
}

export function PlanDesktop(props: TrainPlanViewProps) {
  const thisWeek = props.weekStart === mondayWeekStart();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{thisWeek ? 'This week' : 'Training plan'}</Text>
          <Text style={styles.title}>Plan</Text>
        </View>
        <View style={styles.headerActions}>
          <TrainButton label="Generate" onPress={props.onGenerate} />
        </View>
      </View>

      <View style={styles.weekBar}>
        <Pressable onPress={props.onPrevWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.weekLabel}>{weekRangeLabel(props.weekStart)}</Text>
        <Pressable onPress={props.onNextWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekBtnText}>›</Text>
        </Pressable>
        {!thisWeek ? <TextAction label="This week" onPress={props.onThisWeek} tone="accent" /> : null}
      </View>

      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}

      {props.regenPreview ? (
        <View style={styles.regenBox}>
          <Text style={styles.regenTitle}>Regenerate remaining</Text>
          <Text style={styles.regenBody}>{props.regenPreview.summary}</Text>
          <View style={styles.regenActions}>
            <TrainButton label="Cancel" tone="ghost" onPress={props.onCancelRegen} />
            <TrainButton label={props.busy ? 'Saving…' : 'Confirm'} onPress={props.onConfirmRegen} disabled={props.busy} />
          </View>
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
            <View style={styles.audienceHead}>
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
            </View>
            <View style={styles.weekGrid}>
              {DAYS.map((day) => {
                const card = row.cards.find((item) => item.day === day);
                if (!card) {
                  return (
                    <View key={day} style={[styles.card, styles.cardEmpty]}>
                      <Text style={styles.cardDay}>{DAY_LABELS[day].slice(0, 3)}</Text>
                    </View>
                  );
                }
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
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: space.md, padding: space.lg, paddingBottom: space.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  kicker: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  weekBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  weekBtnText: { color: colors.text, fontSize: 22, lineHeight: 24 },
  weekLabel: { color: colors.text, fontSize: 15, fontWeight: '600', minWidth: 140 },
  error: { color: colors.danger, fontSize: 13 },
  empty: { gap: space.md, paddingVertical: space.xl },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  audience: { gap: space.sm },
  audienceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  audienceName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  audienceActions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: 132,
    minHeight: 150,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.sm,
  },
  cardToday: { borderColor: colors.accent, borderWidth: 2 },
  cardRest: { opacity: 0.85 },
  cardEmpty: { opacity: 0.4 },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 12 },
  cardHint: { color: colors.textMuted, fontSize: 11 },
  cardRestLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 8 },
  cardActions: { gap: 6, marginTop: 'auto' as never },
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
  regenActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
