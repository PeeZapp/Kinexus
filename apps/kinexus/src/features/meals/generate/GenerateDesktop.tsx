import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DAY_LABELS,
  formatCostPerServe,
  MEAL_SLOTS,
  mondayWeekStart,
  scaleRecipeToServings,
  type Day,
  type GeneratedSlot,
  type MealPrepStyle,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import {
  DayPicker,
  GenerateAudiencePicker,
  GenerateModePicker,
  GoalsEditor,
  MealPrepControls,
  ServesPicker,
  SlotPicker,
  WeeklyBudgetField,
  type GenerateMode,
} from '@/src/features/meals/generate/controls';
import { GenerateMealFooter } from '@/src/features/meals/generate/GenerateMealFooter';
import { WeekSwitcher, slotTitle } from '@/src/features/meals/plan/PlanShared';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { isoDayNumber, todayDay, weekApplyLabel, weekDayIso } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export type GenerateViewProps = {
  weekStart: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  mode: GenerateMode;
  onChangeMode: (mode: GenerateMode) => void;
  people: readonly { id: string; name: string }[];
  audienceIds: readonly string[];
  onChangeAudience: (ids: string[]) => void;
  selected: Set<MealSlotKey>;
  onToggleSlot: (slot: MealSlotKey) => void;
  goals: NutritionGoals;
  onChangeGoals: (next: NutritionGoals) => void;
  dietarySummary: string;
  recipeCount: number;
  planDays: readonly Day[];
  availableDays: readonly Day[];
  selectedDays: ReadonlySet<Day>;
  onToggleDay: (day: Day) => void;
  onSelectAllDays: () => void;
  hiddenSlotKeys: ReadonlySet<string>;
  fillableCount: number;
  weeklyBudget: string;
  onChangeWeeklyBudget: (value: string) => void;
  budgetLines: string[];
  prepStyle: MealPrepStyle;
  onChangePrepStyle: (style: MealPrepStyle) => void;
  cookDay: Day;
  onChangeCookDay: (day: Day) => void;
  dishCount: number;
  onChangeDishCount: (count: number) => void;
  daysToCover: number;
  onChangeDaysToCover: (days: number) => void;
  maxDaysToCover: number;
  serves: number | null;
  onChangeServes: (serves: number | null) => void;
  cookSummary: string | null;
  onGenerate: () => void;
  preview: GeneratedSlot[] | null;
  avgCal: number;
  avgProt: number;
  previewSpend: string | null;
  previewOverBudget: boolean;
  onSwap: (day: Day, slot: MealSlotKey) => void;
  onRandom: (day: Day, slot: MealSlotKey) => void;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  onOpenRecipe: (id: string, day: Day, slot: MealSlotKey) => void;
  onOpenSide: (id: string, day: Day, slot: MealSlotKey) => void;
  onRemoveSide: (id: string, day: Day, slot: MealSlotKey) => void;
  onAddSide: (day: Day, slot: MealSlotKey) => void;
};

export function generatedMealFacts(
  recipe: Pick<Recipe, 'calories' | 'servings' | 'cost' | 'ingredients'>,
  viewServings?: number | null,
): string {
  const shown = scaleRecipeToServings(recipe, viewServings);
  const servings = shown.servings && shown.servings > 0 ? shown.servings : shown.cost?.servingsBasis;
  return [
    recipe.calories != null ? `${recipe.calories} kcal` : null,
    formatCostPerServe(shown.cost),
    servings != null && servings > 0 ? `${servings} ${servings === 1 ? 'serving' : 'servings'}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

export function GenerateDesktop(props: GenerateViewProps) {
  const thisWeek = props.weekStart === mondayWeekStart();
  const today = todayDay();
  const slotKeys = MEAL_SLOTS.map((slot) => slot.key).filter((key) => props.selected.has(key));
  const previewByKey = new Map((props.preview ?? []).map((row) => [`${row.day}_${row.slot}`, row] as const));
  const canGenerate = props.selected.size > 0 && props.fillableCount > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate</Text>
        <Text style={styles.meta}>
          {props.recipeCount} recipes · {props.dietarySummary}
        </Text>
      </View>

      <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />

      <View style={styles.controls}>
        <View style={styles.panel}>
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
            <ServesPicker value={props.serves} onChange={props.onChangeServes} />
            <WeeklyBudgetField
              value={props.weeklyBudget}
              onChange={props.onChangeWeeklyBudget}
              lines={props.budgetLines}
            />
          </View>
        </View>
        <View style={[styles.panel, styles.goalsPanel]}>
          <GoalsEditor goals={props.goals} onChange={props.onChangeGoals} desktop defaultOpen />
          <View style={styles.goalsActions}>
            <Btn
              label={props.mode === 'meal_prep' ? `Prep ${props.fillableCount}` : `Generate ${props.fillableCount}`}
              onPress={props.onGenerate}
              disabled={!canGenerate}
            />
            {props.preview ? (
              <Btn label={weekApplyLabel(props.weekStart)} onPress={props.onApply} busy={props.applying} />
            ) : null}
          </View>
        </View>
      </View>

      <ErrorText message={props.error} />
      {props.cookSummary ? <Text style={styles.cookSummary}>{props.cookSummary}</Text> : null}

      {props.preview ? (
        <View style={styles.stats}>
          <Text style={styles.stat}>~{props.avgCal} kcal / day</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.stat}>~{props.avgProt}g protein</Text>
          {props.previewSpend ? (
            <>
              <Text style={styles.statDot}>·</Text>
              <Text style={[styles.stat, props.previewOverBudget && styles.statWarn]}>{props.previewSpend}</Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyHint}>
          {props.mode === 'meal_prep'
            ? 'Set cook day and style, then generate a preview. Nothing saves until you apply.'
            : 'Pick days and meals, then generate a preview. Nothing saves until you apply.'}
        </Text>
      )}

      <View style={styles.week}>
        {props.planDays.map((day) => {
          const iso = weekDayIso(props.weekStart, day);
          const highlight = thisWeek && day === today;
          const kcal = slotKeys.reduce((sum, slot) => {
            const row = previewByKey.get(`${day}_${slot}`);
            if (!row) return sum;
            const sides = (row.sides ?? []).reduce((sideSum, side) => sideSum + (side.calories ?? 0), 0);
            return sum + (row.recipe.calories ?? 0) + sides;
          }, 0);
          return (
            <View key={day} style={[styles.day, highlight && styles.dayToday]}>
              <View style={styles.dayHead}>
                <Text style={[styles.dow, highlight && styles.dowToday]}>
                  {highlight ? 'Today' : DAY_LABELS[day].slice(0, 3)}
                </Text>
                <Text style={[styles.dateNum, highlight && styles.dateToday]}>{isoDayNumber(iso)}</Text>
                <Text style={styles.kcal}>{kcal > 0 ? `${Math.round(kcal).toLocaleString()} kcal` : ' '}</Text>
              </View>
              {slotKeys
                .filter((slot) => !props.hiddenSlotKeys.has(`${day}_${slot}`))
                .map((slot) => {
                  const row = previewByKey.get(`${day}_${slot}`);
                  return (
                    <View key={slot} style={[styles.meal, row ? styles.mealFilled : styles.mealEmpty]}>
                      {row ? (
                        <>
                          <Pressable
                            onPress={() => props.onOpenRecipe(row.recipe.id, row.day, row.slot)}
                            style={styles.mealHit}>
                            <View style={styles.mealPhoto}>
                              <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size="fill" radius={0} />
                            </View>
                            <View style={styles.mealBody}>
                              <Text style={styles.slotLabel}>{slotTitle(slot)}</Text>
                              <Text style={styles.mealName} numberOfLines={2}>
                                {row.recipe.name}
                              </Text>
                              <Text style={styles.mealKcal}>{generatedMealFacts(row.recipe, props.serves) || ' '}</Text>
                            </View>
                          </Pressable>
                          <GenerateMealFooter
                            sides={row.sides ?? []}
                            onOpenSide={(id) => props.onOpenSide(id, day, slot)}
                            onRemoveSide={(id) => props.onRemoveSide(id, day, slot)}
                            onAddSide={() => props.onAddSide(day, slot)}
                            onSwap={() => props.onSwap(day, slot)}
                            onRandom={() => props.onRandom(day, slot)}
                          />
                        </>
                      ) : (
                        <View style={styles.mealBody}>
                          <Text style={[styles.slotLabel, styles.slotEmpty]}>{slotTitle(slot)}</Text>
                          <Text style={styles.mealPlaceholder}>{props.preview ? '—' : 'Empty'}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 32, paddingBottom: 48, gap: 16 },
  header: { gap: 4 },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    width: '100%',
  },
  panel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 14,
  },
  goalsPanel: {
    justifyContent: 'space-between',
  },
  goalsActions: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  form: { gap: 0 },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  cookSummary: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
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
  statDot: {
    color: colors.textDim,
    fontSize: 13,
  },
  statWarn: {
    color: colors.warning,
  },
  week: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  day: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 8,
  },
  dayToday: { borderColor: colors.accent },
  dayHead: { height: 72, paddingHorizontal: 6, paddingTop: 4, justifyContent: 'flex-start' },
  dow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dowToday: { color: colors.accent },
  dateNum: { color: colors.text, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  dateToday: { color: colors.accent },
  kcal: { color: colors.textDim, fontSize: 11, fontWeight: '600', height: 16 },
  meal: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 88,
    minWidth: 0,
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mealPhoto: { height: 72, width: '100%' },
  mealHit: { flexGrow: 1 },
  mealFilled: { borderColor: colors.border },
  mealEmpty: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  mealBody: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  slotEmpty: { color: colors.textDim },
  mealName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    width: '100%',
  },
  mealPlaceholder: {
    color: colors.textDim,
    fontSize: 12,
  },
  mealKcal: { color: colors.textDim, fontSize: 11, lineHeight: 15, minHeight: 14 },
});
