import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LABELS, MEAL_SLOTS } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import {
  DayPicker,
  GenerateAudiencePicker,
  GenerateModePicker,
  GoalsEditor,
  MealPrepControls,
  SlotPicker,
  WeeklyBudgetField,
} from '@/src/features/meals/generate/controls';
import type { GenerateViewProps } from '@/src/features/meals/generate/GenerateDesktop';
import { WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { weekApplyLabel } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export function GenerateMobile(props: GenerateViewProps) {
  const insets = useSafeAreaInsets();
  const canGenerate = props.selected.size > 0 && props.fillableCount > 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Generate</Text>
      <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />
      <GenerateModePicker mode={props.mode} onChange={props.onChangeMode} />

      <View style={styles.form}>
        <GenerateAudiencePicker
          people={props.people}
          selectedIds={props.audienceIds}
          onChange={props.onChangeAudience}
        />
        {props.mode === 'meal_prep' ? (
          <MealPrepControls
            style={props.prepStyle}
            onChangeStyle={props.onChangePrepStyle}
            cookDay={props.cookDay}
            onChangeCookDay={props.onChangeCookDay}
            dishCount={props.dishCount}
            onChangeDishCount={props.onChangeDishCount}
            daysToCover={props.daysToCover}
            onChangeDaysToCover={props.onChangeDaysToCover}
            maxDaysToCover={props.maxDaysToCover}
          />
        ) : (
          <DayPicker
            availableDays={props.availableDays}
            selected={props.selectedDays}
            onToggle={props.onToggleDay}
            onSelectAll={props.onSelectAllDays}
          />
        )}
        <SlotPicker selected={props.selected} onToggle={props.onToggleSlot} />
        <WeeklyBudgetField
          value={props.weeklyBudget}
          onChange={props.onChangeWeeklyBudget}
          lines={props.budgetLines}
        />
        <GoalsEditor goals={props.goals} onChange={props.onChangeGoals} desktop={false} />
      </View>

      <Text style={styles.meta}>
        {props.recipeCount} recipes · {props.dietarySummary}
      </Text>

      <Btn
        label={props.mode === 'meal_prep' ? `Prep ${props.fillableCount}` : `Generate ${props.fillableCount}`}
        onPress={props.onGenerate}
        disabled={!canGenerate}
      />
      <ErrorText message={props.error} />
      {props.cookSummary ? <Text style={styles.cookSummary}>{props.cookSummary}</Text> : null}

      {props.preview ? (
        <>
          <View style={styles.stats}>
            <Text style={styles.stat}>~{props.avgCal} kcal</Text>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.stat}>~{props.avgProt}g protein</Text>
            {props.previewSpend ? (
              <>
                <Text style={styles.statDot}>·</Text>
                <Text style={[styles.stat, props.previewOverBudget && styles.statWarn]}>{props.previewSpend}</Text>
              </>
            ) : null}
          </View>
          <Btn label={weekApplyLabel(props.weekStart)} onPress={props.onApply} busy={props.applying} />
          {props.planDays.map((day) => {
            const rows = props.preview?.filter((row) => row.day === day) ?? [];
            if (rows.length === 0) return null;
            return (
              <View key={day} style={styles.day}>
                <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                {rows.map((row) => (
                  <View key={row.slot} style={styles.row}>
                    <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size={48} />
                    <View style={styles.rowBody}>
                      <Text style={styles.slotKey}>{MEAL_SLOTS.find((s) => s.key === row.slot)?.label}</Text>
                      <Text style={styles.recipe} numberOfLines={2}>
                        {row.recipe.name}
                      </Text>
                      <View style={styles.cellActions}>
                        <Pressable onPress={() => props.onOpenRecipe(row.recipe.id, row.day, row.slot)}>
                          <Text style={styles.swap}>View</Text>
                        </Pressable>
                        <Pressable onPress={() => props.onSwap(row.day, row.slot)}>
                          <Text style={styles.swap}>Swap</Text>
                        </Pressable>
                        <Pressable onPress={() => props.onRandom(row.day, row.slot)}>
                          <Text style={styles.swap}>Random</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.emptyHint}>
          {props.mode === 'meal_prep'
            ? 'Set cook day and style, then generate. Nothing saves until you apply.'
            : 'Pick days and meals, then generate. Nothing saves until you apply.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  form: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  meta: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  cookSummary: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  stat: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  statDot: { color: colors.textDim, fontSize: 13 },
  statWarn: { color: colors.warning },
  day: { gap: 8 },
  dayName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  slotKey: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recipe: { color: colors.text, fontWeight: '700', fontSize: 14 },
  cellActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  swap: { color: colors.accent, fontWeight: '700', fontSize: 12 },
});
