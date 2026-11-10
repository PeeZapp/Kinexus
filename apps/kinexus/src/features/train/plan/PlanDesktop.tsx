import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { mondayWeekStart, type Day, type TrainVisibility } from '@kinexus/domain';

import type { TrainingPlanWeekRow } from '@/src/features/train/api';
import { PlanBoard } from '@/src/features/train/plan/PlanBoard';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import { colors, space } from '@/src/features/shell/theme';

export type TrainPlanViewProps = {
  weekStart: string;
  selectedDay: Day;
  onSelectDay: (day: Day) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  ownedRows: PlanAudienceRow[];
  sharedRows: PlanAudienceRow[];
  today: Day | null;
  busy: boolean;
  error: string | null;
  regenPreview: { planId: string; summary: string } | null;
  buddies: readonly { id: string; name: string }[];
  isApprovedCreator: boolean;
  onGenerate: () => void;
  onClearWeek: (plan: TrainingPlanWeekRow) => void;
  onAddToDay: (plan: TrainingPlanWeekRow, day: Day) => void;
  onDuplicate: (plan: TrainingPlanWeekRow) => void;
  onRegenerate: (plan: TrainingPlanWeekRow) => void;
  onFillRemaining: (plan: TrainingPlanWeekRow) => void;
  onConfirmRegen: () => void;
  onCancelRegen: () => void;
  onStart: (card: PlanDayCardModel) => void;
  onStartBlank: (card: PlanDayCardModel) => void;
  onPickWorkout: (card: PlanDayCardModel) => void;
  onBuildWorkout: (card: PlanDayCardModel) => void;
  onSuggestWorkout: (card: PlanDayCardModel) => void;
  onStartBlankDay: (day: Day) => void;
  onPickForDay: (day: Day) => void;
  onBuildForDay: (day: Day) => void;
  onViewWorkout: (card: PlanDayCardModel) => void;
  onOpenWorkoutMenu: (card: PlanDayCardModel) => void;
  onTrainTogether: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void;
  onMarkDone: (card: PlanDayCardModel) => void;
  onMarkSkipped: (card: PlanDayCardModel) => void;
  onRemoveWorkout: (card: PlanDayCardModel) => void;
  onUndo: (card: PlanDayCardModel) => void;
  onAddPlanToCalendar: (plan: TrainingPlanWeekRow) => void;
  onAddDayToCalendar: (card: PlanDayCardModel) => void;
  onExportPlanIcs: (plan: TrainingPlanWeekRow) => void;
  onExportDayIcs: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void;
  onToggleAutoSync: (plan: TrainingPlanWeekRow) => void;
  onChangeVisibility: (plan: TrainingPlanWeekRow, visibility: TrainVisibility) => void;
  onToggleBuddy: (plan: TrainingPlanWeekRow, buddyId: string) => void;
  onShareLink: (plan: TrainingPlanWeekRow) => void;
  canManagePlan: (plan: TrainingPlanWeekRow) => boolean;
};

export function PlanDesktop(props: TrainPlanViewProps) {
  const thisWeek = props.weekStart === mondayWeekStart();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{thisWeek ? 'This week' : 'Training plan'}</Text>
          <Text style={styles.title}>Plan</Text>
        </View>
      </View>
      <PlanBoard {...props} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: space.lg, padding: space.lg },
  header: { gap: 4 },
  kicker: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
});
